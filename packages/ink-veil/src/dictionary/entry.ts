import type { DetectionMethod } from '../types.js';

/** A single entry in the veil dictionary. */
export interface DictionaryEntry {
  /** Plain token ID, e.g. "PER_001" */
  id: string;
  /** Original PII text, e.g. "홍길동" */
  original: string;
  /** Entity category, e.g. "PER" */
  category: string;
  /** Assigned token string (mode-dependent), e.g. `<iv-per id="001">PER_001</iv-per>` */
  token: string;
  /** Plain token ID regardless of mode, e.g. "PER_001" */
  tokenPlain: string;
  /** Detection method that first discovered this entity. */
  method: DetectionMethod;
  /** Confidence score (0.0–1.0). */
  confidence: number;
  /** ISO 8601 timestamp when entry was first added. */
  addedAt: string;
  /** Source document identifier. */
  addedFromDocument: string;
  /** Number of times this entity has been seen. */
  occurrenceCount: number;
  /** ISO 8601 timestamp when entity was last seen. */
  lastSeenAt: string;
}

/**
 * Builds the composite key used for forward index lookup.
 * Format: `${original}::${category}`
 */
export function compositeKey(original: string, category: string): string {
  return `${original}::${category}`;
}
