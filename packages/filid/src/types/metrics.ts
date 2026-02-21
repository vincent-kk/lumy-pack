/**
 * Software engineering metric type definitions
 */

/** LCOM4 calculation result */
export interface LCOM4Result {
  /** LCOM4 value (1 = highly cohesive, >=2 = fragmented) */
  value: number;
  /** Connected component groups */
  components: string[][];
  /** Number of methods analyzed */
  methodCount: number;
  /** Number of fields analyzed */
  fieldCount: number;
}

/** Cyclomatic complexity calculation result */
export interface CyclomaticComplexityResult {
  /** CC value */
  value: number;
  /** Per-function CC map */
  perFunction: Map<string, number>;
  /** File-level total CC */
  fileTotal: number;
}

/** Test case count result */
export interface TestCaseCount {
  /** File path */
  filePath: string;
  /** File classification */
  fileType: 'spec' | 'test';
  /** Total test case count */
  total: number;
  /** Basic behavior test count (top-level it/test in describe) */
  basic: number;
  /** Complex behavior test count (it/test in nested describe) */
  complex: number;
}

/** 3+12 rule check result */
export interface ThreePlusTwelveResult {
  /** Whether violated */
  violated: boolean;
  /** Per-file results for spec.ts files */
  files: TestCaseCount[];
  /** List of violating file paths */
  violatingFiles: string[];
}

/** Decision action */
export type DecisionAction = 'split' | 'compress' | 'parameterize' | 'ok';

/** Decision tree result */
export interface DecisionResult {
  /** Recommended action */
  action: DecisionAction;
  /** Reasoning */
  reason: string;
  /** Related metrics */
  metrics: {
    testCount: number;
    lcom4: number;
    cyclomaticComplexity: number;
  };
}

/** Test promotion candidate */
export interface PromotionCandidate {
  /** test.ts file path */
  testFilePath: string;
  /** Corresponding spec.ts file path */
  specFilePath: string;
  /** Stabilization period (days) */
  stableDays: number;
  /** Last failure timestamp */
  lastFailure: string | null;
  /** Whether eligible for promotion */
  eligible: boolean;
  /** Test case count */
  caseCount: number;
}
