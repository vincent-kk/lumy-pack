import { countTestCases, type RawTestFile } from '../../metrics/test-counter.js';
import { check312Rule } from '../../metrics/three-plus-twelve.js';
import { decide } from '../../metrics/decision-tree.js';
import type { DecisionResult } from '../../types/metrics.js';

/** File content for test analysis */
export interface TestFileInput {
  filePath: string;
  content: string;
}

/** Decision input parameters */
export interface DecisionParams {
  testCount: number;
  lcom4: number;
  cyclomaticComplexity: number;
}

/** Input for test-metrics tool */
export interface TestMetricsInput {
  /** Action to perform */
  action: 'count' | 'check-312' | 'decide';
  /** Test files (for count/check-312) */
  files?: TestFileInput[];
  /** Decision parameters (for decide) */
  decisionInput?: DecisionParams;
}

/** Test count result */
export interface TestCountResult {
  filePath: string;
  total: number;
  basic: number;
  complex: number;
}

/** 3+12 violation */
export interface ThreePlusTwelveViolation {
  filePath: string;
  testCount: number;
  threshold: number;
}

/** Output of test-metrics tool */
export interface TestMetricsOutput {
  /** Test case counts (for 'count') */
  counts?: TestCountResult[];
  /** 3+12 violations (for 'check-312') */
  violations?: ThreePlusTwelveViolation[];
  /** Decision result (for 'decide') */
  decision?: DecisionResult;
  /** Error message */
  error?: string;
}

/**
 * Handle test-metrics MCP tool calls.
 *
 * Actions:
 * - count: Count test cases in provided file content
 * - check-312: Check 3+12 rule violations
 * - decide: Run decision tree (split/compress/parameterize)
 */
export function handleTestMetrics(input: TestMetricsInput): TestMetricsOutput {
  switch (input.action) {
    case 'count':
      return handleCount(input.files ?? []);
    case 'check-312':
      return handleCheck312(input.files ?? []);
    case 'decide':
      return handleDecide(input.decisionInput);
    default:
      return { error: `Unknown action: ${input.action}` };
  }
}

function handleCount(files: TestFileInput[]): TestMetricsOutput {
  const counts: TestCountResult[] = files.map((f) => {
    const raw: RawTestFile = { filePath: f.filePath, content: f.content };
    const result = countTestCases(raw);
    return {
      filePath: f.filePath,
      total: result.total,
      basic: result.basic,
      complex: result.complex,
    };
  });
  return { counts };
}

function handleCheck312(files: TestFileInput[]): TestMetricsOutput {
  const testCaseCounts = files.map((f) => {
    const raw: RawTestFile = { filePath: f.filePath, content: f.content };
    const count = countTestCases(raw);
    return {
      filePath: f.filePath,
      fileType: f.filePath.includes('.spec.') ? 'spec' as const : 'test' as const,
      total: count.total,
      basic: count.total,
      complex: 0,
    };
  });

  const result = check312Rule(testCaseCounts);

  const violations: ThreePlusTwelveViolation[] = result.violatingFiles.map((fp) => {
    const entry = testCaseCounts.find((c) => c.filePath === fp);
    return {
      filePath: fp,
      testCount: entry?.total ?? 0,
      threshold: 15,
    };
  });

  return { violations };
}

function handleDecide(params?: DecisionParams): TestMetricsOutput {
  if (!params) {
    return { error: 'Decision action requires decisionInput' };
  }

  const result = decide({
    testCount: params.testCount,
    lcom4: params.lcom4,
    cyclomaticComplexity: params.cyclomaticComplexity,
  });

  return { decision: result };
}
