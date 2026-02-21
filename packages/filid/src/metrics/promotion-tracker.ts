import type { PromotionCandidate } from '../types/metrics.js';

/** Default stability threshold in days (3 months) */
const DEFAULT_STABILITY_DAYS = 90;

/** Input for promotion eligibility check */
export interface PromotionInput {
  /** test.ts file path */
  testFilePath: string;
  /** Corresponding spec.ts file path */
  specFilePath: string;
  /** Number of consecutive stable days (no failures) */
  stableDays: number;
  /** Last failure timestamp (null if never failed) */
  lastFailure: string | null;
  /** Number of test cases in the file */
  caseCount: number;
}

/**
 * Check whether a test.ts file is eligible for promotion to spec.ts.
 *
 * Eligibility criteria:
 * - Stable for >= stabilityThreshold days (default 90)
 * - No recorded failures (lastFailure must be null)
 *
 * Eligible tests can be parameterized and merged into spec.ts,
 * then the original test.ts is deleted.
 */
export function checkPromotionEligibility(
  input: PromotionInput,
  stabilityThreshold = DEFAULT_STABILITY_DAYS,
): PromotionCandidate {
  const eligible =
    input.stableDays >= stabilityThreshold && input.lastFailure === null;

  return {
    testFilePath: input.testFilePath,
    specFilePath: input.specFilePath,
    stableDays: input.stableDays,
    lastFailure: input.lastFailure,
    eligible,
    caseCount: input.caseCount,
  };
}
