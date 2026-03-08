/**
 * Pure function to merge consecutive NNP tokens on the same line.
 * Extracted from KiwiEngine to reduce LCOM4.
 */

interface KiwiTokenInfo {
  str: string;
  position: number;
  length: number;
  tag: string;
  lineNumber: number;
}

export interface MergedNNP {
  start: number;
  end: number;
  text: string;
  lineNumber: number;
}

/**
 * Merge consecutive NNP tokens that are on the same line
 * and adjacent (only whitespace between them) in the original text.
 */
export function mergeConsecutiveNNP(nnpTokens: KiwiTokenInfo[], text: string): MergedNNP[] {
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
