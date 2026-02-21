import type { TestCaseCount, ThreePlusTwelveResult } from '../types/metrics.js';

/** 3+12 rule threshold: max 15 test cases per spec file */
const THRESHOLD = 15;

/**
 * Check the 3+12 rule across spec.ts files.
 * Only spec files are evaluated — test files are ignored.
 * A spec file with more than 15 total test cases is a violation.
 */
export function check312Rule(files: TestCaseCount[]): ThreePlusTwelveResult {
  const specFiles = files.filter((f) => f.fileType === 'spec');
  const violatingFiles = specFiles
    .filter((f) => f.total > THRESHOLD)
    .map((f) => f.filePath);

  return {
    violated: violatingFiles.length > 0,
    files: specFiles,
    violatingFiles,
  };
}
