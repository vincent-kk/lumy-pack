import {
  NORMALIZATION_ALPHA,
  NORMALIZATION_LOGISTIC_K,
  NORMALIZATION_MAD_COEFFICIENT,
  NORMALIZATION_MIN_SAMPLE_SIZE,
} from '../constants.js';

/**
 * Interface for objects that have a numeric score.
 */
export interface ScoredItem {
  score: number;
}

/**
 * Normalize raw scores to [0, 1] range via Robust Hybrid Normalization.
 *
 * This model combines two mathematical approaches to provide a stable "relative" threshold:
 *
 * 1. Logistic-Robust-Z (Intensity):
 *    Calculates Z-scores using Median and Median Absolute Deviation (MAD).
 *    Maps these to a sigmoid (logistic) curve. This suppresses noise (scores near median)
 *    and highlights significant signals (outliers) without letting extreme outliers
 *    crush other meaningful transitions.
 *
 * 2. CDF / Percentile Rank (Relative Position):
 *    Maps each score to its percentile rank in the sequence. This ensures that 't'
 *    always has a consistent meaning as a "relative rank" regardless of absolute values.
 *
 * The final score is a weighted sum (NORMALIZATION_ALPHA) of both.
 *
 * @param items - Array of items with scores to normalize
 * @returns normalized scores array (same length as input)
 */
export function normalizeScores<T extends ScoredItem>(items: T[]): number[] {
  if (items.length === 0) return [];

  const safeScores = items.map((e) =>
    Number.isFinite(e.score) && e.score > 0 ? e.score : 0,
  );

  const positiveScores = safeScores.filter((s) => s > 0);
  if (positiveScores.length === 0) return safeScores;

  const sorted = [...positiveScores].sort((a, b) => a - b);

  // --- Fallback for small sample sizes ---
  if (positiveScores.length <= NORMALIZATION_MIN_SAMPLE_SIZE) {
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    if (max === min) return safeScores.map((s) => (s > 0 ? 1.0 : 0));
    return safeScores.map((s) =>
      s <= 0 ? 0 : Math.max(0, Math.min((s - min) / (max - min), 1.0)),
    );
  }

  // --- Robust Hybrid Normalization for large samples ---

  // 1. Logistic-Robust-Z
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const absoluteDiffs = positiveScores.map((v) => Math.abs(v - median));
  const mad = [...absoluteDiffs].sort((a, b) => a - b)[
    Math.floor(absoluteDiffs.length / 2)
  ]!;

  // Scale coefficient for Z-score
  const scale = mad === 0 ? median : mad * NORMALIZATION_MAD_COEFFICIENT;

  const logisticZ = safeScores.map((s) => {
    if (s <= 0) return 0;
    if (scale === 0) return 1.0;
    const z = (s - median) / scale;
    return 1 / (1 + Math.exp(-NORMALIZATION_LOGISTIC_K * z));
  });

  // 2. CDF (Percentile Rank)
  const cdf = safeScores.map((s) => {
    if (s <= 0) return 0;
    const rank = sorted.findIndex((v) => v >= s);
    return rank / sorted.length;
  });

  // 3. Hybrid Combination
  return logisticZ.map(
    (z, i) => z * (1 - NORMALIZATION_ALPHA) + cdf[i]! * NORMALIZATION_ALPHA,
  );
}
