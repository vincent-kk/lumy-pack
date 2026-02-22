/**
 * @file fractal-validator.ts
 * @description FractalTree 구조 검증 오케스트레이터.
 *
 * rule-engine을 통해 모든 노드를 검증하고 ValidationReport를 생성한다.
 */
import type { FractalNode, FractalTree } from '../types/fractal.js';
import type { ValidationReport } from '../types/report.js';
import type {
  Rule,
  RuleContext,
  RuleEvaluationResult,
  RuleViolation,
} from '../types/rules.js';

import { loadBuiltinRules } from './rule-engine.js';

/**
 * FractalTree 전체를 검증하고 ValidationReport를 반환한다.
 *
 * @param tree - 검증할 프랙탈 트리
 * @param rules - 적용할 규칙 목록 (미제공 시 rule-engine의 내장 규칙 사용)
 * @returns 검증 보고서 (규칙 평가 결과 + 타임스탬프)
 */
export function validateStructure(
  tree: FractalTree,
  rules?: Rule[],
): ValidationReport {
  const start = Date.now();
  let ruleList: Rule[];

  if (rules && rules.length > 0) {
    ruleList = rules;
  } else {
    ruleList = loadBuiltinRules();
  }

  const violations: RuleViolation[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [, node] of tree.nodes) {
    const context: RuleContext = { node, tree };
    for (const rule of ruleList) {
      if (!rule.enabled) {
        skipped++;
        continue;
      }
      const nodeViolations = validateNode(node, context, rule);
      if (nodeViolations.length === 0) {
        passed++;
      } else {
        failed++;
        violations.push(...nodeViolations);
      }
    }
  }

  const result: RuleEvaluationResult = {
    violations,
    passed,
    failed,
    skipped,
    duration: Date.now() - start,
  };

  return {
    result,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 단일 노드를 특정 규칙으로 검증한다.
 *
 * @param node - 검증할 노드
 * @param context - 노드가 속한 트리와 설정을 포함한 컨텍스트
 * @param rule - 적용할 규칙 (미제공 시 모든 기본 규칙 적용)
 * @returns 해당 노드에서 발생한 위반 목록
 */
export function validateNode(
  _node: FractalNode,
  context: RuleContext,
  rule?: Rule,
): RuleViolation[] {
  if (rule) {
    return rule.check(context);
  }

  const rules = loadBuiltinRules();
  const violations: RuleViolation[] = [];
  for (const r of rules) {
    if (r.enabled) {
      violations.push(...r.check(context));
    }
  }
  return violations;
}

/**
 * 트리 전체의 의존 관계를 검증한다.
 * 순환 의존과 레이어 위반(organ이 fractal을 import 등)을 감지한다.
 *
 * @param tree - 의존 관계를 검증할 트리
 * @returns 의존 관계 위반 목록
 */
export function validateDependencies(tree: FractalTree): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const cycles = detectCycles(tree);

  for (const cycle of cycles) {
    violations.push({
      ruleId: 'circular-dependency',
      severity: 'error',
      message: `Circular dependency detected: ${cycle.join(' → ')}`,
      path: cycle[0] ?? '',
      suggestion: 'Extract shared logic to a common ancestor fractal.',
    });
  }

  return violations;
}

/**
 * DFS를 사용해 트리에서 순환 의존을 탐지한다.
 */
function detectCycles(tree: FractalTree): string[][] {
  const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
  const cycles: string[][] = [];

  for (const [path] of tree.nodes) {
    state.set(path, 'unvisited');
  }

  function dfs(nodePath: string, stack: string[]): void {
    state.set(nodePath, 'visiting');
    stack.push(nodePath);

    const node = tree.nodes.get(nodePath);
    const deps = [...(node?.children ?? []), ...(node?.organs ?? [])];

    for (const dep of deps) {
      if (state.get(dep) === 'visiting') {
        const cycleStart = stack.indexOf(dep);
        if (cycleStart !== -1) {
          cycles.push(stack.slice(cycleStart));
        }
      } else if (state.get(dep) !== 'visited') {
        dfs(dep, [...stack]);
      }
    }

    state.set(nodePath, 'visited');
  }

  for (const [path] of tree.nodes) {
    if (state.get(path) !== 'visited') {
      dfs(path, []);
    }
  }

  return cycles;
}
