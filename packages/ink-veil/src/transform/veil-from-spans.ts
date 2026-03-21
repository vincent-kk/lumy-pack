/**
 * Veil text using pre-computed detection spans.
 * MUST NOT import from detection/, document/, node:fs, node:crypto
 */
import type { Dictionary } from "../dictionary/dictionary.js";
import type { DictionaryEntry } from "../dictionary/entry.js";
import type { DetectionMethod } from "../types.js";
import type { VeilResult } from "./types.js";

/** A minimal span descriptor accepted by veilTextFromSpans. */
export interface Span {
  start: number;
  end: number;
  text: string;
  category: string;
  method: DetectionMethod;
  confidence: number;
}

/**
 * Substitute detected spans in text with their dictionary tokens.
 * Spans must be non-overlapping and sorted by start offset.
 * Forward array-builder: O(N+L) instead of O(N*L) string copies.
 */
export function veilTextFromSpans(
  text: string,
  spans: Span[],
  dictionary: Dictionary,
  sourceDocument = "unknown",
): VeilResult {
  if (spans.length === 0) {
    return { text, substitutions: 0 };
  }

  // Sort by start ASC (caller should guarantee non-overlapping)
  const sorted = [...spans].sort((a, b) => a.start - b.start);

  // Forward array-builder: collect text segments and tokens, join once
  const segments: string[] = [];
  let prevEnd = 0;

  for (const span of sorted) {
    const entry: DictionaryEntry = dictionary.addEntity(
      span.text,
      span.category,
      span.method,
      span.confidence,
      sourceDocument,
    );
    segments.push(text.slice(prevEnd, span.start));
    segments.push(entry.token);
    prevEnd = span.end;
  }

  segments.push(text.slice(prevEnd));

  return { text: segments.join(""), substitutions: sorted.length };
}
