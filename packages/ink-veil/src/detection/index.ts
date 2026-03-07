import type { DetectionSpan, DetectionConfig } from './types.js';
import { normalizeNFC } from './normalize.js';
import { stripTrailingParticle } from './particles.js';
import { mergeSpans } from './merger.js';
import { RegexEngine } from './regex/engine.js';
import type { NEREngine } from './ner/engine.js';
import { ModelManager } from './ner/model-manager.js';

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

export interface DetectionEngineManual {
  detect(text: string): DetectionSpan[];
}

export interface DictionaryLike {
  addEntity(text: string, category: string): string;
}

export interface DetectionPipelineOptions {
  manual?: ManualRule[];
  config?: DetectionConfig;
  noNer?: boolean;
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
  private nerEngine: NEREngine | null = null;
  private nerInitPromise: Promise<void> | null = null;

  constructor(options: DetectionPipelineOptions = {}) {
    this.regexEngine = new RegexEngine();
    this.config = options.config ?? { priorityOrder: ['MANUAL', 'REGEX', 'NER'] };
    this.noNer = options.noNer ?? false;

    if (options.manual && options.manual.length > 0) {
      this.manualEngine = createInlineManualEngine(options.manual);
    } else {
      this.manualEngine = null;
    }
  }

  /**
   * NER 엔진을 초기화합니다. 모델 다운로드가 필요하면 자동으로 수행합니다.
   * noNer가 true이면 아무 작업도 하지 않습니다.
   */
  async initNer(): Promise<void> {
    if (this.noNer || this.nerEngine) return;

    if (this.nerInitPromise) {
      await this.nerInitPromise;
      return;
    }

    this.nerInitPromise = (async () => {
      try {
        const manager = new ModelManager();
        const result = await manager.ensureWithFallback();
        if (!result) return; // fallback to regex-only

        const { NEREngine: NEREngineClass } = await import('./ner/engine.js');
        this.nerEngine = new NEREngineClass({ modelDir: result.modelDir, modelId: result.modelId });
        await this.nerEngine.init();
      } catch (e) {
        process.stderr.write(`ink-veil: NER init failed: ${e instanceof Error ? e.message : String(e)}. Using regex-only.\n`);
        this.nerEngine = null;
      }
    })();

    await this.nerInitPromise;
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

    // NER 엔진 실행 (초기화되지 않았으면 자동 초기화)
    let nerSpans: DetectionSpan[] = [];
    if (!this.noNer) {
      await this.initNer();
      if (this.nerEngine) {
        try {
          nerSpans = await this.nerEngine.detect(text);
        } catch (e) {
          process.stderr.write(`ink-veil: NER detection error: ${e instanceof Error ? e.message : String(e)}\n`);
        }
      }
    }

    // 3. 조사 제거 (NER 스팬에서 후처리)
    const processedNerSpans = nerSpans.map((span) => {
      const { entity, particle } = stripTrailingParticle(span.text);
      if (particle) {
        return { ...span, text: entity, end: span.end - particle.length };
      }
      return span;
    });

    // 4. 병합
    const merged = mergeSpans(manualSpans, regexSpans, processedNerSpans);

    // 5. dictionary.addEntity() 호출
    if (dictionary) {
      for (const span of merged) {
        dictionary.addEntity(span.text, span.category);
      }
    }

    return merged;
  }

  /** NER 워커 스레드를 정리합니다. */
  async dispose(): Promise<void> {
    if (this.nerEngine) {
      await this.nerEngine.dispose();
      this.nerEngine = null;
    }
  }
}

function createInlineManualEngine(rules: ManualRule[]): DetectionEngineManual {
  return {
    detect(text: string): DetectionSpan[] {
      const spans: DetectionSpan[] = [];
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
      return spans;
    },
  };
}
