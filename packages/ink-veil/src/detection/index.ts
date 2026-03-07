import type { DetectionSpan, DetectionConfig } from './types.js';
import { ensureModel, ensureModelAt } from './kiwi/downloader.js';
import { normalizeNFC } from './normalize.js';
import { stripTrailingParticle, KOREAN_PARTICLES } from './particles.js';
import { mergeSpans } from './merger.js';
import { RegexEngine } from './regex/engine.js';
import type { KiwiEngine } from './kiwi/engine.js';

export type { DetectionSpan, DetectionConfig, DetectionEngine } from './types.js';
export { normalizeNFC } from './normalize.js';
export { stripTrailingParticle, KOREAN_PARTICLES } from './particles.js';
export { mergeSpans } from './merger.js';
export { RegexEngine } from './regex/engine.js';

export interface ManualRule {
  pattern: string | RegExp;
  category: string;
  confidence?: number;
  priority?: number;
}

/** User-defined target word for particle-aware matching. */
export interface UserWord {
  /** Target word (e.g. "삼성전자", "홍길동") */
  text: string;
  /** Entity category (default: 'CUSTOM') */
  category?: string;
}

export interface DetectionEngineManual {
  detect(text: string): DetectionSpan[];
}

export interface DictionaryLike {
  addEntity(text: string, category: string): string;
}

export interface DetectionPipelineOptions {
  manual?: ManualRule[];
  userWords?: UserWord[];
  config?: DetectionConfig;
  noNer?: boolean;
  /** Kiwi model name (default: 'kiwi-base'). Resolved to ~/.ink-veil/models/{model}/base/ */
  nerModel?: string;
  /** Absolute path to a pre-installed model directory. Overrides nerModel name resolution. */
  nerModelPath?: string;
  /** NER confidence threshold — spans below this are discarded (default: 0.2). */
  nerThreshold?: number;
}

/**
 * DetectionPipeline — NFC normalize → MANUAL → REGEX → NER → particle strip → Merger
 *
 * Merger가 병합한 스팬에 대해 dictionary.addEntity()를 호출하는 책임을 집니다.
 */
export class DetectionPipeline {
  private readonly regexEngine: RegexEngine;
  private readonly manualEngine: DetectionEngineManual | null;
  private readonly config: DetectionConfig;
  private readonly noNer: boolean;
  private readonly nerModel: string;
  private readonly nerModelPath: string | undefined;
  private readonly nerThreshold: number;
  private kiwiEngine: KiwiEngine | null = null;
  private kiwiInitPromise: Promise<void> | null = null;

  constructor(options: DetectionPipelineOptions = {}) {
    this.regexEngine = new RegexEngine();
    this.config = options.config ?? { priorityOrder: ['MANUAL', 'REGEX', 'NER'] };
    this.noNer = options.noNer ?? false;
    this.nerModel = options.nerModel ?? 'kiwi-base';
    this.nerModelPath = options.nerModelPath;
    this.nerThreshold = options.nerThreshold ?? 0.2;

    const hasManual = options.manual && options.manual.length > 0;
    const hasUserWords = options.userWords && options.userWords.length > 0;

    if (hasManual || hasUserWords) {
      this.manualEngine = createInlineManualEngine(
        options.manual ?? [],
        options.userWords ?? [],
      );
    } else {
      this.manualEngine = null;
    }
  }

  /**
   * Kiwi 엔진을 초기화합니다.
   * noNer가 true이면 아무 작업도 하지 않습니다.
   */
  async initKiwi(): Promise<void> {
    if (this.noNer || this.kiwiEngine) return;

    if (this.kiwiInitPromise) {
      await this.kiwiInitPromise;
      return;
    }

    this.kiwiInitPromise = (async () => {
      try {
        // nerModelPath가 지정된 경우 해당 경로에 다운로드/사용, 아니면 기본 경로에 자동 다운로드
        const modelDir = this.nerModelPath
          ? await ensureModelAt(this.nerModel, this.nerModelPath)
          : await ensureModel(this.nerModel);
        if (!modelDir) {
          process.stderr.write('ink-veil: Kiwi model not available. Using regex-only detection.\n');
          return;
        }

        const { KiwiEngine: KiwiEngineClass } = await import('./kiwi/engine.js');
        this.kiwiEngine = new KiwiEngineClass();
        await this.kiwiEngine.init(modelDir);
      } catch (e) {
        process.stderr.write(`ink-veil: Kiwi init failed: ${e instanceof Error ? e.message : String(e)}. Using regex-only.\n`);
        this.kiwiEngine = null;
        this.kiwiInitPromise = null;
      }
    })();

    await this.kiwiInitPromise;
  }

  /**
   * 텍스트에서 PII 엔티티를 감지하고, 감지된 스팬을 반환합니다.
   * dictionary가 제공되면 각 엔티티에 대해 addEntity()를 호출합니다.
   */
  async detect(rawText: string, dictionary?: DictionaryLike): Promise<DetectionSpan[]> {
    // 1. NFC 정규화
    const text = normalizeNFC(rawText);

    // 2. 각 엔진 실행
    const manualSpans = this.manualEngine ? this.manualEngine.detect(text) : [];
    const regexSpans = this.regexEngine.detect(text, this.config);

    // Kiwi 엔진 실행 (초기화되지 않았으면 자동 초기화)
    let nerSpans: DetectionSpan[] = [];
    if (!this.noNer) {
      await this.initKiwi();
      if (this.kiwiEngine) {
        try {
          nerSpans = this.kiwiEngine.detect(text);
        } catch (e) {
          process.stderr.write(`ink-veil: Kiwi detection error: ${e instanceof Error ? e.message : String(e)}\n`);
        }
      }
    }

    // 3. nerThreshold 필터링
    const filteredNerSpans = nerSpans.filter((span) => span.confidence >= this.nerThreshold);

    // 4. 조사 제거 (NER 스팬에서 후처리)
    const processedNerSpans = filteredNerSpans.map((span) => {
      const { entity, particle } = stripTrailingParticle(span.text);
      if (particle) {
        return { ...span, text: entity, end: span.end - particle.length };
      }
      return span;
    });

    // 5. 병합
    const merged = mergeSpans(manualSpans, regexSpans, processedNerSpans);

    // 6. dictionary.addEntity() 호출
    if (dictionary) {
      for (const span of merged) {
        dictionary.addEntity(span.text, span.category);
      }
    }

    return merged;
  }

  /** Kiwi 엔진 리소스를 정리합니다. */
  async dispose(): Promise<void> {
    if (this.kiwiEngine) {
      await this.kiwiEngine.dispose();
      this.kiwiEngine = null;
    }
  }
}

function createInlineManualEngine(rules: ManualRule[], userWords: UserWord[]): DetectionEngineManual {
  return {
    detect(text: string): DetectionSpan[] {
      const spans: DetectionSpan[] = [];

      // 1. ManualRule matching (existing behavior)
      for (const rule of rules) {
        const confidence = rule.confidence ?? 1.0;
        const priority = rule.priority ?? 1;

        if (typeof rule.pattern === 'string') {
          let idx = text.indexOf(rule.pattern);
          while (idx !== -1) {
            spans.push({
              start: idx,
              end: idx + rule.pattern.length,
              text: rule.pattern,
              category: rule.category,
              method: 'MANUAL',
              confidence,
              priority,
            });
            idx = text.indexOf(rule.pattern, idx + 1);
          }
        } else {
          const re = new RegExp(
            rule.pattern.source,
            rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g',
          );
          let match: RegExpExecArray | null;
          while ((match = re.exec(text)) !== null) {
            spans.push({
              start: match.index,
              end: match.index + match[0].length,
              text: match[0],
              category: rule.category,
              method: 'MANUAL',
              confidence,
              priority,
            });
          }
        }
      }

      // 2. UserWord particle-aware matching
      for (const word of userWords) {
        let idx = text.indexOf(word.text);
        while (idx !== -1) {
          const afterEnd = idx + word.text.length;
          const rest = text.slice(afterEnd);
          const isWordBoundary = rest.length === 0
            || /^[\s,.\n;:!?)\]>}]/.test(rest)
            || KOREAN_PARTICLES.some(p => rest.startsWith(p));

          if (isWordBoundary) {
            spans.push({
              start: idx,
              end: afterEnd,
              text: word.text,
              category: word.category ?? 'CUSTOM',
              method: 'MANUAL',
              confidence: 1.0,
              priority: 1,
            });
          }
          idx = text.indexOf(word.text, idx + 1);
        }
      }

      return spans;
    },
  };
}
