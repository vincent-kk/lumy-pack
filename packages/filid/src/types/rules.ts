/**
 * @file rules.ts
 * @description rule-engine의 규칙 정의 및 평가 결과 타입.
 *
 * Rule은 순수 함수 `check`를 통해 RuleViolation[] 을 반환하는 구조이다.
 */

import type { FractalNode, FractalTree } from './fractal.js';
import type { ScanOptions } from './scan.js';

/** 규칙 위반의 심각도 수준. */
export type RuleSeverity = 'error' | 'warning' | 'info';

/** 규칙이 다루는 관심 영역 분류. */
export type RuleCategory = 'naming' | 'structure' | 'dependency' | 'documentation' | 'index' | 'module';

/** 단일 규칙의 검사 컨텍스트. `Rule.check` 함수에 전달된다. */
export interface RuleContext {
  node: FractalNode;
  tree: FractalTree;
  scanOptions?: ScanOptions;
}

/** 규칙 위반 항목 하나. */
export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  message: string;
  path: string;
  suggestion?: string;
}

/** 단일 규칙 정의. `check` 함수는 순수 함수여야 하며 부작용이 없어야 한다. */
export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  enabled: boolean;
  check: (context: RuleContext) => RuleViolation[];
}

/** 규칙 집합. */
export interface RuleSet {
  id: string;
  name: string;
  rules: Rule[];
}

/** 전체 규칙 평가 실행 결과. */
export interface RuleEvaluationResult {
  violations: RuleViolation[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

/** 내장 규칙 ID 상수. */
export const BUILTIN_RULE_IDS = {
  NAMING_CONVENTION: 'naming-convention',
  ORGAN_NO_CLAUDEMD: 'organ-no-claudemd',
  INDEX_BARREL_PATTERN: 'index-barrel-pattern',
  MODULE_ENTRY_POINT: 'module-entry-point',
  MAX_DEPTH: 'max-depth',
  CIRCULAR_DEPENDENCY: 'circular-dependency',
  PURE_FUNCTION_ISOLATION: 'pure-function-isolation',
} as const;

export type BuiltinRuleId = (typeof BUILTIN_RULE_IDS)[keyof typeof BUILTIN_RULE_IDS];
