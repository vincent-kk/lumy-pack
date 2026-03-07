/**
 * Transform module types.
 * MUST NOT import from detection/, document/, node:fs, node:crypto
 */

/** Result of a veil operation on a text string. */
export interface VeilResult {
  /** Veiled text with tokens substituted. */
  text: string;
  /** Number of substitutions made. */
  substitutions: number;
}

/** Result of an unveil operation on a text string. */
export interface UnveilResult {
  /** Restored text. */
  text: string;
  /** Tokens restored via Stage 1 (exact XML match). */
  matchedTokens: string[];
  /** Tokens restored via Stage 2/3 (LLM-altered format). */
  modifiedTokens: string[];
  /** Token IDs found in text but not in dictionary (hallucinated). */
  unmatchedTokens: string[];
  /** matchedTokens.length / totalUniqueTokensFound (0.0–1.0). */
  tokenIntegrity: number;
}

/** Result of token integrity check. */
export interface TokenIntegrity {
  /** Total unique token IDs found in the veiled text. */
  total: number;
  /** Token IDs that are present in the dictionary. */
  known: string[];
  /** Token IDs not found in the dictionary. */
  unknown: string[];
  /** known.length / total (0.0–1.0). */
  score: number;
}
