import type { TestCaseCount } from '../types/metrics.js';

/** Raw test file input for counting */
export interface RawTestFile {
  filePath: string;
  content: string;
}

/**
 * Detect file type from path: .spec.ts → 'spec', .test.ts → 'test'.
 */
function detectFileType(filePath: string): 'spec' | 'test' {
  if (filePath.includes('.spec.')) return 'spec';
  return 'test';
}

/**
 * Count test cases (it/test/it.each/test.each) in a test file.
 * Basic tests: directly inside a top-level describe.
 * Complex tests: inside nested describes (depth >= 2).
 */
export function countTestCases(file: RawTestFile): TestCaseCount {
  const { filePath, content } = file;
  const fileType = detectFileType(filePath);

  let basic = 0;
  let complex = 0;
  let describeDepth = 0;

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Track describe nesting depth
    if (/^describe[\s.(]/.test(trimmed)) {
      describeDepth++;
    }

    // Count it() / test() / it.each() / test.each()
    if (/^(it|test)[\s.(]/.test(trimmed)) {
      if (describeDepth <= 1) {
        basic++;
      } else {
        complex++;
      }
    }

    // Track closing braces to reduce depth
    // Count closing patterns: }); or }) that end a describe block
    if (/^\}\);?\s*$/.test(trimmed) && describeDepth > 0) {
      describeDepth--;
    }
  }

  return {
    filePath,
    fileType,
    total: basic + complex,
    basic,
    complex,
  };
}
