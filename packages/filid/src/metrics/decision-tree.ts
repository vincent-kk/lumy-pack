import type { DecisionResult } from '../types/metrics.js';

/** 3+12 rule threshold */
const TEST_THRESHOLD = 15;

/** Cyclomatic complexity threshold */
const CC_THRESHOLD = 15;

/** LCOM4 threshold for split */
const LCOM4_SPLIT_THRESHOLD = 2;

/** Input metrics for the decision tree */
export interface DecisionInput {
  testCount: number;
  lcom4: number;
  cyclomaticComplexity: number;
}

/**
 * FCA-AI decision tree algorithm.
 *
 * Pipeline:
 * 1. testCount <= 15 → ok (no action needed)
 * 2. LCOM4 >= 2 → split (SRP violation, extract to sub-fractals)
 * 3. LCOM4 = 1, CC > 15 → compress (high cohesion but complex control flow)
 * 4. LCOM4 = 1, CC <= 15 → parameterize (merge redundant test cases)
 */
export function decide(input: DecisionInput): DecisionResult {
  const { testCount, lcom4, cyclomaticComplexity } = input;
  const metrics = { testCount, lcom4, cyclomaticComplexity };

  // Phase 1: Check if threshold is exceeded
  if (testCount <= TEST_THRESHOLD) {
    return {
      action: 'ok',
      reason: `Test count (${testCount}) is within the 3+12 limit.`,
      metrics,
    };
  }

  // Phase 2: LCOM4 >= 2 → split
  if (lcom4 >= LCOM4_SPLIT_THRESHOLD) {
    return {
      action: 'split',
      reason: `LCOM4 = ${lcom4} indicates multiple responsibilities. Extract into sub-fractals along component boundaries.`,
      metrics,
    };
  }

  // Phase 3: CC > 15 → compress
  if (cyclomaticComplexity > CC_THRESHOLD) {
    return {
      action: 'compress',
      reason: `High cyclomatic complexity (${cyclomaticComplexity}) with good cohesion. Extract methods, apply strategy pattern, or flatten conditionals.`,
      metrics,
    };
  }

  // Phase 4: parameterize
  return {
    action: 'parameterize',
    reason: `Logic and cohesion are healthy but test count (${testCount}) exceeds limit. Merge redundant edge-case tests into data-driven parameterized tests.`,
    metrics,
  };
}
