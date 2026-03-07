/**
 * Veil text using pre-computed detection spans.
 * MUST NOT import from detection/, document/, node:fs, node:crypto, onnxruntime-node.
 */
import type { Dictionary } from '../dictionary/dictionary.js';
import type { DictionaryEntry } from '../dictionary/entry.js';
import type { DetectionMethod } from '../types.js';
import type { VeilResult } from './types.js';

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
 * Reverse-offset substitution: process right-to-left to preserve offsets.
 */
export function veilTextFromSpans(
  text: string,
  spans: Span[],
  dictionary: Dictionary,
  sourceDocument = 'unknown',
): VeilResult {
  if (spans.length === 0) {
    return { text, substitutions: 0 };
  }

  // Sort by start ASC (caller should guarantee non-overlapping)
  const sorted = [...spans].sort((a, b) => a.start - b.start);

  // Process right-to-left to maintain correct offsets
  let result = text;
  let substitutions = 0;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const span = sorted[i];
    const entry: DictionaryEntry = dictionary.addEntity(
      span.text,
      span.category,
      span.method,
      span.confidence,
      sourceDocument,
    );
    result = result.slice(0, span.start) + entry.token + result.slice(span.end);
    substitutions++;
  }

  return { text: result, substitutions };
}
