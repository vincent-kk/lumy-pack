import { performance } from 'node:perf_hooks';

import { filter, map } from '@winglet/common-utils';
import { describe, expect, it } from 'vitest';

import {
  NORMALIZATION_ALPHA,
  NORMALIZATION_LOGISTIC_K,
  NORMALIZATION_MAD_COEFFICIENT,
  NORMALIZATION_MIN_SAMPLE_SIZE,
} from '../../constants.js';
import { type ScoredItem, normalizeScores } from '../../utils/math.js';

/**
 * Generate repeatable positive scores with ties using a 32-bit LCG.
 * @param count - Number of items to generate.
 * @returns Scores in deterministic input order, independent of ambient randomness.
 */
function seededScores(count: number): ScoredItem[] {
  let seed = 0x12345678;
  return Array.from({ length: count }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return { score: (seed % 10000) + 1 };
  });
}

/**
 * Compute the normalization oracle with linear first-match CDF ranks.
 * @param items - Raw scores, including invalid or nonpositive values.
 * @returns Normalized values in input order with the production arithmetic order.
 */
function referenceNormalizeScores<T extends ScoredItem>(items: T[]): number[] {
  if (items.length === 0) return [];
  const safeScores = map(items, (e) =>
    Number.isFinite(e.score) && e.score > 0 ? e.score : 0,
  );
  const positiveScores = filter(safeScores, (s) => s > 0);
  if (positiveScores.length === 0) return safeScores;
  const sorted = [...positiveScores].sort((a, b) => a - b);
  if (positiveScores.length <= NORMALIZATION_MIN_SAMPLE_SIZE) {
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    if (max === min) return map(safeScores, (s) => (s > 0 ? 1.0 : 0));
    return map(safeScores, (s) =>
      s <= 0 ? 0 : Math.max(0, Math.min((s - min) / (max - min), 1.0)),
    );
  }
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const absoluteDiffs = map(positiveScores, (v) => Math.abs(v - median));
  const mad = [...absoluteDiffs].sort((a, b) => a - b)[
    Math.floor(absoluteDiffs.length / 2)
  ]!;
  const scale = mad === 0 ? median : mad * NORMALIZATION_MAD_COEFFICIENT;
  const logisticZ = map(safeScores, (s) => {
    if (s <= 0) return 0;
    if (scale === 0) return 1.0;
    const z = (s - median) / scale;
    return 1 / (1 + Math.exp(-NORMALIZATION_LOGISTIC_K * z));
  });
  const cdf = map(safeScores, (s) => {
    if (s <= 0) return 0;
    const rank = sorted.findIndex((v) => v >= s);
    return rank / sorted.length;
  });
  return map(
    logisticZ,
    (z, i) => z * (1 - NORMALIZATION_ALPHA) + cdf[i]! * NORMALIZATION_ALPHA,
  );
}

describe('normalizeScores', () => {
  it('normalizes ten identical positive scores to 1', () => {
    expect(
      normalizeScores(Array.from({ length: 10 }, () => ({ score: 1 }))),
    ).toStrictEqual(Array(10).fill(1));
  });

  it('normalizes eleven identical positive scores to 0.3', () => {
    expect(
      normalizeScores(Array.from({ length: 11 }, () => ({ score: 1 }))),
    ).toStrictEqual(Array(11).fill(0.3));
  });

  it('keeps the maximum of twelve ascending scores below 1', () => {
    const scores = Array.from({ length: 12 }, (_, i) => ({ score: i + 1 }));
    expect(
      Math.abs(Math.max(...normalizeScores(scores)) - 0.946766),
    ).toBeLessThanOrEqual(1e-6);
  });

  it('assigns tied scores the first matching rank', () => {
    const scores = [3, 1, 2, 3, 4, 5, 3, 6, 7, 8, 9, 10];
    const normalized = normalizeScores(scores.map((score) => ({ score })));
    const logistic = 1 / (1 + Math.exp(-3 * ((3 - 5) / (2 * 1.4826))));
    const expected = logistic * 0.6 + (2 / scores.length) * 0.4;
    expect([normalized[0], normalized[3], normalized[6]]).toStrictEqual([
      expected,
      expected,
      expected,
    ]);
  });

  it('matches the linear reference exactly for 10,000 seeded scores', () => {
    const scores = seededScores(10000);
    expect(normalizeScores(scores)).toStrictEqual(
      referenceNormalizeScores(scores),
    );
  });

  it('normalizes 30,000 seeded scores within 300ms', () => {
    const scores = seededScores(30000);
    normalizeScores(seededScores(1000));
    const start = performance.now();
    const normalized = normalizeScores(scores);
    const elapsedMs = performance.now() - start;
    console.info(
      `NORMALIZATION_PERF count=${scores.length} elapsedMs=${elapsedMs.toFixed(3)} limitMs=300`,
    );
    expect(normalized).toHaveLength(scores.length);
    expect(elapsedMs).toBeLessThan(300);
  });
});
