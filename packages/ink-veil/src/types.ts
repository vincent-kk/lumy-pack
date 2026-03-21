/**
 * Veil output mode.
 * - 'tag':   XML tag format — `<iv-per id="001">PER_001</iv-per>` (default, best LLM preservation)
 * - 'bracket': Double-brace format — `{{PER_001}}`
 * - 'plain':   Plain token — `PER_001`
 */
export type TokenMode = "tag" | "bracket" | "plain";

/**
 * Fidelity tier — round-trip guarantee strength per document format.
 * - '1a': Byte-identical (TXT, MD, CSV, TSV)
 * - '1b': Semantic-identical (JSON, XML, YAML, TOML, INI)
 * - '2':  Structure-preserved (DOCX, XLSX, HTML)
 * - '3':  Text-layer extraction (PDF, PPTX, EPUB)
 * - '4':  Experimental / best-effort (HWP, LaTeX)
 */
export type FidelityTier = "1a" | "1b" | "2" | "3" | "4";

// Canonical detection types — re-exported from detection layer
import type { DetectionMethod as _DetectionMethod } from "./detection/types.js";
export type {
  DetectionMethod,
  DetectionSpan,
  DetectionConfig,
} from "./detection/types.js";
type DetectionMethod = _DetectionMethod;

/** A single entry in the veil dictionary. */
export interface DictionaryEntry {
  /** Original PII text. */
  original: string;
  /** Entity category. */
  category: string;
  /** Assigned token string. */
  token: string;
  /** Plain token ID (e.g. "PER_001") regardless of mode. */
  plain: string;
  /** Detection method that first discovered this entity. */
  method: DetectionMethod;
}

/** Forward+reverse index dictionary for veil/unveil. */
export interface DictionaryData {
  /** composite key `{original}::{category}` → DictionaryEntry */
  forwardIndex: Record<string, DictionaryEntry>;
  /** plain token (e.g. "PER_001") → DictionaryEntry */
  reverseIndex: Record<string, DictionaryEntry>;
  /** Per-category counters for sequential ID assignment. */
  counters: Record<string, number>;
  /** Dictionary schema version. */
  version: number;
}

/** A text segment extracted from a parsed document. */
export interface TextSegment {
  text: string;
  /** Format-specific position metadata (e.g. JSON path, XML xpath, row/col). */
  position: SegmentPosition;
  /** true for code blocks, formula cells, etc. — skip detection. */
  skippable: boolean;
}

/** Format-specific position descriptor for a text segment. */
export type SegmentPosition =
  | { type: "offset"; start: number; end: number }
  | { type: "jsonpath"; path: string }
  | { type: "xmlpath"; xpath: string }
  | { type: "cell"; row: number; col: number }
  | { type: "node"; nodeId: string }
  | { type: "generic"; info: Record<string, unknown> };

/** Parsed document produced by a format parser. */
export interface ParsedDocument {
  format: string;
  tier: FidelityTier;
  encoding: string;
  segments: TextSegment[];
  metadata: Record<string, unknown>;
  /** Kept for Tier 1a SHA-256 verification. */
  originalBuffer?: Buffer;
}

/** Options for a veil operation. */
export interface VeilOptions {
  /** Detection engines to enable (default: all three). */
  engines?: Array<"MANUAL" | "REGEX" | "NER">;
  /** Token output mode (default: 'tag'). */
  mode?: TokenMode;
  /** NER model name (default: 'kiwi-base'). */
  nerModel?: string;
  /** Additional entity labels for NER zero-shot detection. */
  nerLabels?: string[];
  /** NER confidence threshold (default: 0.2). */
  nerThreshold?: number;
  /** User-defined manual rules applied before other engines. */
  manualRules?: ManualRule[];
  /** Inject invisible LLM-preservation signature (default: false). */
  injectSignature?: boolean;
  /** Run round-trip verification after veiling (default: false). */
  verify?: boolean;
}

/** Options for an unveil operation. */
export interface UnveilOptions {
  /** Fail if tokenIntegrity < 1.0 (default: false). */
  strict?: boolean;
  /** Minimum acceptable tokenIntegrity (0.0–1.0, default: 0.0). */
  integrityThreshold?: number;
}

/** A manual detection rule (string literal or RegExp). */
export interface ManualRule {
  /** Literal string or regex pattern to match. */
  pattern: string | RegExp;
  /** Entity category to assign. */
  category: string;
}

/** Result of a veil operation. */
export interface VeilResult {
  /** Veiled document. */
  document: ParsedDocument;
  /** Number of unique entities discovered. */
  entitiesFound: number;
  /** Snapshot of the dictionary after veiling. */
  dictionary: DictionaryData;
  /** Whether round-trip verification passed (undefined if not run). */
  verified?: boolean;
}

/** Result of an unveil operation. */
export interface UnveilResult {
  /** Restored document. */
  document: ParsedDocument;
  /** Tokens perfectly restored via Stage 1 (exact XML match). */
  matchedTokens: string[];
  /** Tokens restored via Stage 2/3 (LLM altered format). */
  modifiedTokens: string[];
  /** Token IDs found in text but not in dictionary (hallucinated). */
  unmatchedTokens: string[];
  /** matchedTokens.length / totalTokens (0.0–1.0). */
  tokenIntegrity: number;
}

/** Per-file result in a batch operation. */
export interface BatchResult<T> {
  results: Array<{ ok: true; value: T } | { ok: false; error: Error }>;
  dictionary: DictionaryData;
  succeeded: number;
  failed: number;
}
