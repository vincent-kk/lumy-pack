/**
 * @lumy-pack/ink-veil — main entry point
 * Full programmatic API: InkVeil.create() factory + all re-exports.
 */

import { map } from "@winglet/common-utils";

// ── Core types ────────────────────────────────────────────────────────────────
export type {
  TokenMode,
  FidelityTier,
  DetectionMethod,
  DetectionSpan,
  DictionaryEntry,
  VeilOptions,
  UnveilOptions,
  ManualRule,
  VeilResult,
  UnveilResult,
} from "./types.js";

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  ErrorCode,
  InkVeilError,
  FileNotFoundError,
  UnsupportedFormatError,
  DictionaryError,
  NERModelError,
  VerificationError,
} from "./errors/types.js";
export { ok, err } from "./errors/result.js";
export type { Result } from "./errors/result.js";

// ── Dictionary ────────────────────────────────────────────────────────────────
export { Dictionary } from "./dictionary/dictionary.js";
export { compositeKey } from "./dictionary/entry.js";
export type { DictionaryEntry as DictionaryEntryFull } from "./dictionary/entry.js";
export { TokenGenerator } from "./dictionary/token-generator.js";
export type {
  DictionaryJSON,
  DictionaryStats,
  DocumentManifest,
} from "./dictionary/types.js";
export { saveDictionary, loadDictionary } from "./dictionary/io.js";

// ── Detection ─────────────────────────────────────────────────────────────────
export { DetectionPipeline } from "./detection/index.js";
export type {
  DetectionConfig,
  ManualRule as DetectionManualRule,
} from "./detection/index.js";
export { RegexEngine } from "./detection/regex/engine.js";
export { normalizeNFC } from "./detection/normalize.js";
export { stripTrailingParticle } from "./detection/particles.js";
export { mergeSpans } from "./detection/merger.js";

// ── Transform ─────────────────────────────────────────────────────────────────
export { veilTextFromSpans } from "./transform/veil-from-spans.js";
export type { Span } from "./transform/veil-from-spans.js";
export { veilTextFromDictionary } from "./transform/veil-from-dictionary.js";
export { unveilText } from "./transform/unveil.js";
export {
  insertSignature,
  detectSignature,
  removeSignature,
} from "./transform/signature.js";
export type {
  VeilResult as TextVeilResult,
  UnveilResult as TextUnveilResult,
  TokenIntegrity,
} from "./transform/types.js";

// ── Verification ──────────────────────────────────────────────────────────────
export { verify } from "./verification/verify.js";
export { sha256 } from "./verification/hash.js";
export type { VerificationResult } from "./verification/types.js";

// ── Document parsers ──────────────────────────────────────────────────────────
export { getParser } from "./document/parser.js";
export type {
  ParsedDocument,
  TextSegment,
  FormatParser,
} from "./document/types.js";

// ── Version ───────────────────────────────────────────────────────────────────
export const VERSION = "0.0.1";

// ── InkVeil factory ───────────────────────────────────────────────────────────
import { Dictionary } from "./dictionary/dictionary.js";
import { saveDictionary, loadDictionary } from "./dictionary/io.js";
import { DetectionPipeline } from "./detection/index.js";
import type { DetectionSpan } from "./detection/index.js";
import { veilTextFromSpans } from "./transform/veil-from-spans.js";
import { veilTextFromDictionary } from "./transform/veil-from-dictionary.js";
import { unveilText } from "./transform/unveil.js";
import { verify } from "./verification/verify.js";
import { getParser } from "./document/parser.js";
import type { TokenMode, FidelityTier, ManualRule } from "./types.js";

export interface InkVeilOptions {
  /** Token output mode (default: 'tag'). */
  tokenMode?: TokenMode;
  /** User-defined manual detection rules. */
  manualRules?: ManualRule[];
  /** Disable NER engine (default: false). */
  noNer?: boolean;
  /** Load existing dictionary from path. */
  dictionaryPath?: string;
}

/**
 * InkVeil programmatic API.
 * Use InkVeil.create() to obtain an instance.
 */
export class InkVeil {
  readonly dictionary: Dictionary;
  private readonly pipeline: DetectionPipeline;

  private constructor(dictionary: Dictionary, pipeline: DetectionPipeline) {
    this.dictionary = dictionary;
    this.pipeline = pipeline;
  }

  /** Create an InkVeil instance, optionally loading an existing dictionary. */
  static async create(options: InkVeilOptions = {}): Promise<InkVeil> {
    const dict = options.dictionaryPath
      ? await loadDictionary(options.dictionaryPath)
      : Dictionary.create(options.tokenMode ?? "tag");

    const pipeline = new DetectionPipeline({
      manual: options.manualRules
        ? map(options.manualRules, (r) => ({
            pattern: r.pattern,
            category: r.category,
          }))
        : undefined,
      noNer: options.noNer,
    });

    return new InkVeil(dict, pipeline);
  }

  /** Detect PII spans in text. */
  async detect(text: string): Promise<DetectionSpan[]> {
    return this.pipeline.detect(text);
  }

  /** Veil text using detection pipeline. */
  async veilText(text: string, sourceDocument = "unknown") {
    const spans = await this.pipeline.detect(text);
    return veilTextFromSpans(text, spans, this.dictionary, sourceDocument);
  }

  /** Dispose NER engine resources. */
  async dispose(): Promise<void> {
    await this.pipeline.dispose();
  }

  /** Veil text by scanning against all dictionary entries (no detection). */
  veilFromDictionary(text: string) {
    return veilTextFromDictionary(text, this.dictionary);
  }

  /** Unveil (restore) veiled text. */
  unveilText(text: string) {
    return unveilText(text, this.dictionary);
  }

  /** Verify round-trip fidelity. */
  verify(
    original: Buffer,
    restored: Buffer,
    tier: FidelityTier,
    format?: string,
  ) {
    return verify(original, restored, tier, format);
  }

  /** Parse a document by format. */
  parseDocument(format: string) {
    return getParser(format);
  }

  /** Save dictionary to a JSON file. */
  async saveDictionary(path: string): Promise<void> {
    await saveDictionary(this.dictionary, path);
  }
}
