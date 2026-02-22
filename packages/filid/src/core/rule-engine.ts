/**
 * @file rule-engine.ts
 * @description 내장 규칙 로드 및 평가 엔진.
 *
 * 7개의 내장 규칙을 제공하고 FractalTree에 대해 규칙을 평가한다.
 * config-loader 의존 없이 동작한다.
 */

import type { Rule, RuleContext, RuleViolation, RuleEvaluationResult } from '../types/rules.js';
import type { FractalTree } from '../types/fractal.js';
import type { ScanOptions } from '../types/scan.js';
import { BUILTIN_RULE_IDS } from '../types/rules.js';
import { DEFAULT_SCAN_OPTIONS } from '../types/scan.js';

// kebab-case: 소문자, 숫자, 하이픈으로만 구성
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// camelCase: 소문자로 시작, 대문자 혼용 가능
const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;

function isValidNaming(name: string): boolean {
  return KEBAB_CASE_RE.test(name) || CAMEL_CASE_RE.test(name);
}

/**
 * 7개 내장 규칙 인스턴스를 생성하여 반환한다.
 */
export function loadBuiltinRules(): Rule[] {
  return [
    // 1. naming-convention: 디렉토리명이 kebab-case 또는 camelCase여야 한다
    {
      id: BUILTIN_RULE_IDS.NAMING_CONVENTION,
      name: 'Naming Convention',
      description: '디렉토리/파일명이 kebab-case 또는 camelCase를 따라야 한다.',
      category: 'naming',
      severity: 'warning',
      enabled: true,
      check(context: RuleContext): RuleViolation[] {
        const { node } = context;
        if (!isValidNaming(node.name)) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.NAMING_CONVENTION,
              severity: 'warning',
              message: `디렉토리명 "${node.name}"이 kebab-case 또는 camelCase 규칙을 따르지 않습니다.`,
              path: node.path,
              suggestion: `"${node.name}"을 kebab-case(예: my-module) 또는 camelCase(예: myModule)로 변경하세요.`,
            },
          ];
        }
        return [];
      },
    },

    // 2. organ-no-claudemd: organ 노드에 CLAUDE.md가 없어야 한다
    {
      id: BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
      name: 'Organ No CLAUDE.md',
      description: 'organ 노드에 CLAUDE.md가 존재하면 안 된다.',
      category: 'structure',
      severity: 'error',
      enabled: true,
      check(context: RuleContext): RuleViolation[] {
        const { node } = context;
        if (node.type === 'organ' && node.hasClaudeMd) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
              severity: 'error',
              message: `organ 디렉토리 "${node.name}"에 CLAUDE.md가 존재합니다. organ은 독립 문서화가 금지됩니다.`,
              path: node.path,
              suggestion: 'CLAUDE.md를 제거하거나 해당 디렉토리를 fractal로 재분류하세요.',
            },
          ];
        }
        return [];
      },
    },

    // 3. index-barrel-pattern: fractal 노드의 index.ts가 순수 barrel이어야 한다
    {
      id: BUILTIN_RULE_IDS.INDEX_BARREL_PATTERN,
      name: 'Index Barrel Pattern',
      description: 'fractal 노드의 index.ts는 순수 barrel(re-export만) 패턴을 따라야 한다.',
      category: 'index',
      severity: 'warning',
      enabled: true,
      check(context: RuleContext): RuleViolation[] {
        const { node } = context;
        // fractal/hybrid 노드에만 적용, index가 있어야 함
        if (node.type !== 'fractal' && node.type !== 'hybrid') return [];
        if (!node.hasIndex) return [];

        // metadata에 barrelPattern이 있으면 활용
        const barrelPattern = node.metadata['barrelPattern'] as
          | { isPureBarrel: boolean; declarationCount: number }
          | undefined;

        if (barrelPattern && !barrelPattern.isPureBarrel && barrelPattern.declarationCount > 0) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.INDEX_BARREL_PATTERN,
              severity: 'warning',
              message: `"${node.name}/index.ts"에 ${barrelPattern.declarationCount}개의 직접 선언이 있습니다. 순수 barrel 패턴을 따르지 않습니다.`,
              path: node.path,
              suggestion: '직접 선언을 별도 파일로 분리하고 index.ts에서 re-export하세요.',
            },
          ];
        }
        return [];
      },
    },

    // 4. module-entry-point: 모든 fractal 노드에 index.ts 또는 main.ts가 있어야 한다
    {
      id: BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
      name: 'Module Entry Point',
      description: '모든 fractal 노드에 index.ts 또는 main.ts가 존재해야 한다.',
      category: 'module',
      severity: 'warning',
      enabled: true,
      check(context: RuleContext): RuleViolation[] {
        const { node } = context;
        if (node.type !== 'fractal' && node.type !== 'hybrid') return [];
        if (!node.hasIndex && !node.hasMain) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
              severity: 'warning',
              message: `fractal 모듈 "${node.name}"에 진입점(index.ts 또는 main.ts)이 없습니다.`,
              path: node.path,
              suggestion: 'index.ts 또는 main.ts를 생성하여 모듈의 공개 API를 정의하세요.',
            },
          ];
        }
        return [];
      },
    },

    // 5. max-depth: 트리 깊이가 maxDepth를 초과하면 안 된다
    {
      id: BUILTIN_RULE_IDS.MAX_DEPTH,
      name: 'Max Depth',
      description: '프랙탈 트리의 깊이가 최대 허용 깊이를 초과하면 안 된다.',
      category: 'structure',
      severity: 'error',
      enabled: true,
      check(context: RuleContext): RuleViolation[] {
        const { node, scanOptions } = context;
        const maxDepth = scanOptions?.maxDepth ?? DEFAULT_SCAN_OPTIONS.maxDepth;
        if (node.depth > maxDepth) {
          return [
            {
              ruleId: BUILTIN_RULE_IDS.MAX_DEPTH,
              severity: 'error',
              message: `"${node.name}"의 깊이(${node.depth})가 최대 허용 깊이(${maxDepth})를 초과합니다.`,
              path: node.path,
              suggestion: '디렉토리 구조를 평탄화하거나 관련 모듈을 병합하세요.',
            },
          ];
        }
        return [];
      },
    },

    // 6. circular-dependency: 순환 의존 감지 (placeholder - 빈 배열 반환)
    {
      id: BUILTIN_RULE_IDS.CIRCULAR_DEPENDENCY,
      name: 'Circular Dependency',
      description: '모듈 간 순환 의존이 없어야 한다.',
      category: 'dependency',
      severity: 'error',
      enabled: true,
      check(_context: RuleContext): RuleViolation[] {
        // Phase 2 placeholder: 순환 의존 감지는 project-analyzer 레벨에서 수행
        // 개별 노드 컨텍스트에서는 전체 의존 그래프가 없으므로 빈 배열 반환
        return [];
      },
    },

    // 7. pure-function-isolation: pure-function 노드는 부작용이 없어야 한다
    {
      id: BUILTIN_RULE_IDS.PURE_FUNCTION_ISOLATION,
      name: 'Pure Function Isolation',
      description: 'pure-function 노드는 상위 fractal 모듈을 import하면 안 된다.',
      category: 'dependency',
      severity: 'error',
      enabled: true,
      check(context: RuleContext): RuleViolation[] {
        const { node, tree } = context;
        if (node.type !== 'pure-function') return [];

        // metadata에 dependencies가 있으면 확인
        const deps = node.metadata['dependencies'] as string[] | undefined;
        if (!deps || deps.length === 0) return [];

        const violations: RuleViolation[] = [];

        for (const dep of deps) {
          // 의존 대상이 트리에 있고 fractal 타입이면 위반
          const depNode = tree.nodes.get(dep);
          if (depNode && (depNode.type === 'fractal' || depNode.type === 'hybrid')) {
            violations.push({
              ruleId: BUILTIN_RULE_IDS.PURE_FUNCTION_ISOLATION,
              severity: 'error',
              message: `pure-function 노드 "${node.name}"이 fractal 모듈 "${depNode.name}"을 의존합니다.`,
              path: node.path,
              suggestion: `"${depNode.name}"의 하위 organ으로 이동하거나 의존을 제거하세요.`,
            });
          }
        }

        return violations;
      },
    },
  ];
}

/**
 * 활성화된 규칙만 필터링하여 반환한다.
 *
 * @param rules - 전체 규칙 목록
 * @returns enabled가 true인 규칙 목록
 */
export function getActiveRules(rules: Rule[]): Rule[] {
  return rules.filter((r) => r.enabled);
}

/**
 * 단일 규칙을 단일 노드에 적용한다.
 *
 * @param rule - 적용할 규칙
 * @param context - 규칙 컨텍스트
 * @returns 위반 목록 (없으면 빈 배열)
 */
export function evaluateRule(rule: Rule, context: RuleContext): RuleViolation[] {
  if (!rule.enabled) return [];
  try {
    return rule.check(context);
  } catch {
    return [];
  }
}

/**
 * FractalTree의 모든 노드에 대해 활성화된 규칙을 평가한다.
 *
 * @param tree - 검증할 프랙탈 트리
 * @param rules - 평가할 규칙 목록 (생략 시 내장 규칙 사용)
 * @param options - 스캔 옵션 (maxDepth 등)
 * @returns 전체 평가 결과
 */
export function evaluateRules(
  tree: FractalTree,
  rules?: Rule[],
  options?: ScanOptions,
): RuleEvaluationResult {
  const start = Date.now();
  const activeRules = getActiveRules(rules ?? loadBuiltinRules());
  const violations: RuleViolation[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [, node] of tree.nodes) {
    const context: RuleContext = { node, tree, scanOptions: options };
    for (const rule of activeRules) {
      if (!rule.enabled) {
        skipped++;
        continue;
      }
      const nodeViolations = evaluateRule(rule, context);
      if (nodeViolations.length === 0) {
        passed++;
      } else {
        failed++;
        violations.push(...nodeViolations);
      }
    }
  }

  return {
    violations,
    passed,
    failed,
    skipped,
    duration: Date.now() - start,
  };
}
