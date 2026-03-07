/**
 * Veil text by scanning against existing dictionary entries.
 * Longest-match-first ordering to prevent prefix collision.
 * MUST NOT import from detection/, document/, node:fs, node:crypto, onnxruntime-node.
 */
import type { Dictionary } from '../dictionary/dictionary.js';
import type { VeilResult } from './types.js';

/**
 * Scan text against all dictionary entries and replace matches.
 * Uses longest-match-first to prevent prefix collisions
 * (e.g. "삼성전자" matched before "삼성").
 */
export function veilTextFromDictionary(text: string, dictionary: Dictionary): VeilResult {
  // Collect all entries sorted by original length DESC (longest first)
  const entries = [...dictionary.entries()].sort(
    (a, b) => b.original.length - a.original.length,
  );

  if (entries.length === 0) {
    return { text, substitutions: 0 };
  }

  let result = text;
  let substitutions = 0;

  // For each entry (longest first), replace all occurrences
  // We track substituted ranges to avoid double-substitution
  for (const entry of entries) {
    const { original, token } = entry;
    if (!result.includes(original)) continue;

    // Replace all non-overlapping occurrences of original with token
    let newResult = '';
    let lastIndex = 0;
    let idx = result.indexOf(original, lastIndex);

    while (idx !== -1) {
      newResult += result.slice(lastIndex, idx) + token;
      lastIndex = idx + original.length;
      substitutions++;
      idx = result.indexOf(original, lastIndex);
    }

    newResult += result.slice(lastIndex);
    result = newResult;
  }

  return { text: result, substitutions };
}
