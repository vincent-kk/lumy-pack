import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import type { DetectionSpan } from '../types.js';

// ── kiwi-nlp types (avoid import to keep lazy-loadable) ──
interface KiwiTokenInfo {
  str: string;
  position: number;
  length: number;
  tag: string;
  lineNumber: number;
}

interface KiwiTokenResult {
  tokens: KiwiTokenInfo[];
  score: number;
}

interface KiwiInstance {
  analyze: (str: string, matchOptions?: number) => KiwiTokenResult;
  tokenize: (str: string, matchOptions?: number) => KiwiTokenInfo[];
  ready: () => boolean;
}

interface KiwiBuilderStatic {
  create: (wasmPath: string) => Promise<{ build: (args: unknown) => Promise<KiwiInstance> }>;
}

// ── NNP Sub-classification ──

const LOC_SUFFIXES = [
  '특별시', '광역시', '특별자치시', '특별자치도',
  '시', '도', '군', '구', '읍', '면', '리', '동', '로', '길',
];

const ORG_SUFFIXES = [
  '대학교', '전자', '은행', '대학', '증권', '보험', '그룹',
  '건설', '화학', '제약', '물산', '산업', '공사', '재단',
  '협회', '법인', '주식회사', '회사',
];

/** Common nouns that Kiwi may tag as NNP — filter these out. */
const BLACKLIST = new Set([
  '주민등록번호', '운전면허', '여권', '주민번호', '등록번호',
  '전화번호', '휴대폰', '핸드폰', '이메일', '비밀번호',
  '계좌번호', '카드번호', '신용카드', '보험증', '건강보험',
  '사업자', '법인번호',
]);

/** Minimum syllable count threshold for LOC classification. */
const LOC_MIN_SYLLABLES = 4;

/** Model files required from the Kiwi model directory. */
const MODEL_FILE_NAMES = [
  'combiningRule.txt',
  'default.dict',
  'dialect.dict',
  'extract.mdl',
  'multi.dict',
  'sj.morph',
  'typo.dict',
  'cong.mdl',
];

/** Count Korean syllable characters (가-힣). */
function countSyllables(text: string): number {
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xAC00 && code <= 0xD7A3) count++;
  }
  return count;
}

/** Check if text is composed primarily of Korean characters. */
function isKorean(text: string): boolean {
  let korean = 0;
  let total = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    total++;
    if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)) korean++;
  }
  return total > 0 && korean / total >= 0.5;
}

/** Classify a merged NNP entity into PER / ORG / LOC. */
function classifyNNP(text: string): string {
  const syllables = countSyllables(text);

  // LOC: requires 4+ syllables AND a location suffix
  if (syllables >= LOC_MIN_SYLLABLES) {
    for (const suffix of LOC_SUFFIXES) {
      if (text.endsWith(suffix)) return 'LOC';
    }
  }

  // ORG: suffix match (no syllable threshold)
  for (const suffix of ORG_SUFFIXES) {
    if (text.endsWith(suffix)) return 'ORG';
  }

  // PER: 2-4 Korean syllables, not matching above rules
  if (isKorean(text) && syllables >= 2 && syllables <= 4) {
    return 'PER';
  }

  // Default: PER for short Korean, ORG for longer
  return syllables <= 4 ? 'PER' : 'ORG';
}

// ── Merged NNP span ──

interface MergedNNP {
  start: number;
  end: number;
  text: string;
  lineNumber: number;
}

/**
 * KiwiEngine — Korean NER via Kiwi morphological analyzer.
 *
 * Extracts NNP (proper noun) tokens, merges consecutive ones
 * on the same line, and sub-classifies into PER/ORG/LOC.
 */
export class KiwiEngine {
  private kiwi: KiwiInstance | null = null;

  /**
   * Initialize WASM + model. Must be called before detect().
   * @param modelDir  Directory containing Kiwi model files.
   */
  async init(modelDir: string): Promise<void> {
    if (this.kiwi) return;

    // 1. Locate kiwi-wasm.wasm
    const require = createRequire(import.meta.url);
    const kiwiPkgEntry = require.resolve('kiwi-nlp');
    const kiwiDistDir = dirname(kiwiPkgEntry);
    const wasmPath = join(kiwiDistDir, 'kiwi-wasm.wasm');

    // 2. Dynamic import to keep kiwi-nlp lazy
    const { KiwiBuilder } = (await import('kiwi-nlp')) as { KiwiBuilder: KiwiBuilderStatic };
    const builder = await KiwiBuilder.create(wasmPath);

    // 3. Read model files as Uint8Array (Node.js fetch doesn't support file://)
    const modelFiles: Record<string, Uint8Array> = {};
    await Promise.all(
      MODEL_FILE_NAMES.map(async (name) => {
        const buf = await readFile(join(modelDir, name));
        modelFiles[name] = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }),
    );

    // 4. Build Kiwi instance
    this.kiwi = await builder.build({ modelFiles });
  }

  /**
   * Detect named entities in text.
   * Synchronous after init() — Kiwi WASM inference is ~11ms.
   */
  detect(text: string): DetectionSpan[] {
    if (!this.kiwi) {
      throw new Error('KiwiEngine not initialised. Call init() first.');
    }

    if (!text.trim()) return [];

    // 1. Tokenize
    const tokens = this.kiwi.tokenize(text);

    // 2. Extract NNP tokens
    const nnpTokens = tokens.filter(
      (t) => t.tag === 'NNP' && !BLACKLIST.has(t.str),
    );

    if (nnpTokens.length === 0) return [];

    // 3. Merge consecutive NNP tokens on the same line
    const merged = this.mergeConsecutiveNNP(nnpTokens, text);

    // 4. Classify and build DetectionSpan[]
    return merged
      .filter((m) => !BLACKLIST.has(m.text))
      .map((m) => ({
        start: m.start,
        end: m.end,
        text: m.text,
        category: classifyNNP(m.text),
        method: 'NER' as const,
        confidence: 0.85,
      }));
  }

  /** Release resources. */
  async dispose(): Promise<void> {
    this.kiwi = null;
  }

  /**
   * Merge consecutive NNP tokens that are on the same line
   * and adjacent (only whitespace between them) in the original text.
   */
  private mergeConsecutiveNNP(nnpTokens: KiwiTokenInfo[], text: string): MergedNNP[] {
    const result: MergedNNP[] = [];
    let current: MergedNNP | null = null;

    for (const token of nnpTokens) {
      const tokenStart = token.position;
      const tokenEnd = token.position + token.length;

      if (!current) {
        current = {
          start: tokenStart,
          end: tokenEnd,
          text: token.str,
          lineNumber: token.lineNumber,
        };
        continue;
      }

      // Check if this token should merge with current:
      // Same line + gap is only whitespace (no newline)
      const gap = text.slice(current.end, tokenStart);
      const isAdjacent =
        token.lineNumber === current.lineNumber &&
        (gap === '' || /^[ \t]+$/.test(gap));

      if (isAdjacent) {
        // Merge: extend span to include gap + new token
        current.end = tokenEnd;
        current.text = text.slice(current.start, current.end);
      } else {
        // Push current, start new
        result.push(current);
        current = {
          start: tokenStart,
          end: tokenEnd,
          text: token.str,
          lineNumber: token.lineNumber,
        };
      }
    }

    if (current) result.push(current);
    return result;
  }
}
