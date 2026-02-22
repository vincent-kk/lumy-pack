/**
 * @file drift-detector.ts
 * @description 프랙탈 구조 이격(drift) 감지 및 보정 계획 생성.
 *
 * RuleViolation을 DriftItem으로 변환하고 SyncPlan을 생성한다.
 */

import type { FractalTree } from '../types/fractal.js';
import type { RuleViolation, RuleEvaluationResult } from '../types/rules.js';
import type {
  DriftItem,
  DriftResult,
  DriftSeverity,
  SyncAction,
  SyncPlan,
  SyncPlanAction,
  DetectDriftOptions,
} from '../types/drift.js';


/** RuleViolation의 ruleId → SyncAction 매핑 */
const RULE_TO_ACTION: Record<string, SyncAction> = {
  'naming-convention': 'rename',
  'organ-no-claudemd': 'move',
  'index-barrel-pattern': 'create-index',
  'module-entry-point': 'create-index',
  'max-depth': 'merge',
  'circular-dependency': 'move',
  'pure-function-isolation': 'move',
};

/** RuleViolation의 ruleId → DriftSeverity 매핑 */
const RULE_TO_SEVERITY: Record<string, DriftSeverity> = {
  'circular-dependency': 'critical',
  'pure-function-isolation': 'critical',
  'max-depth': 'high',
  'organ-no-claudemd': 'high',
  'index-barrel-pattern': 'medium',
  'module-entry-point': 'medium',
  'naming-convention': 'low',
};

const SEVERITY_ORDER: Record<DriftSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * RuleViolation의 심각도를 DriftSeverity로 변환한다.
 *
 * @param violation - 변환할 규칙 위반 항목
 * @returns 대응하는 DriftSeverity
 */
export function calculateSeverity(violation: RuleViolation): DriftSeverity {
  const mapped = RULE_TO_SEVERITY[violation.ruleId];
  if (mapped) return mapped;

  // severity 기반 fallback
  switch (violation.severity) {
    case 'error': return 'high';
    case 'warning': return 'medium';
    case 'info': return 'low';
    default: return 'low';
  }
}

/**
 * 규칙 평가 결과를 DriftItem 목록으로 변환한다.
 *
 * @param tree - 참조할 프랙탈 트리
 * @param rules - 규칙 평가 결과
 * @returns DriftItem 배열 (심각도 내림차순 정렬)
 */
export function compareCurrent(_tree: FractalTree, rules: RuleEvaluationResult): DriftItem[] {
  const items: DriftItem[] = rules.violations.map((violation) => {
    const severity = calculateSeverity(violation);
    const action = RULE_TO_ACTION[violation.ruleId] ?? 'reclassify';
    return {
      path: violation.path,
      rule: violation.ruleId,
      expected: violation.suggestion ?? 'Compliant with rule',
      actual: violation.message,
      severity,
      suggestedAction: action,
    };
  });

  // 심각도 내림차순 정렬
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * FractalTree를 분석하여 구조 이격을 감지하고 DriftResult를 반환한다.
 *
 * @param tree - 이격을 감지할 프랙탈 트리
 * @param violations - 사전에 계산된 규칙 위반 목록 (미제공 시 validateStructure 실행)
 * @param options - 감지 옵션 (criticalOnly, generatePlan)
 * @returns 이격 감지 결과 (항목 목록, 심각도별 집계, 타임스탬프)
 */
export function detectDrift(
  _tree: FractalTree,
  violations: RuleViolation[],
  options?: DetectDriftOptions,
): DriftResult {
  let items = violations.map((violation) => {
    const severity = calculateSeverity(violation);
    const action = RULE_TO_ACTION[violation.ruleId] ?? 'reclassify';

    return {
      path: violation.path,
      rule: violation.ruleId,
      expected: violation.suggestion ?? 'Compliant with rule',
      actual: violation.message,
      severity,
      suggestedAction: action,
    } satisfies DriftItem;
  });

  // 심각도 내림차순 정렬
  items = items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (options?.criticalOnly) {
    items = items.filter((item) => item.severity === 'critical');
  }

  const bySeverity: Record<DriftSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const item of items) {
    bySeverity[item.severity]++;
  }

  return {
    items,
    totalDrifts: items.length,
    bySeverity,
    scanTimestamp: new Date().toISOString(),
  };
}

/**
 * DriftItem 목록을 분석하여 실행 가능한 SyncPlan을 생성한다.
 *
 * @param drifts - 보정할 이격 항목 목록
 * @returns 실행 계획 (액션 목록, 예상 변경 수, 위험도)
 */
export function generateSyncPlan(drifts: DriftItem[]): SyncPlan {
  const ACTION_ORDER: Record<SyncAction, number> = {
    move: 0,
    rename: 1,
    'create-index': 2,
    'create-main': 3,
    reclassify: 4,
    split: 5,
    merge: 6,
  };

  const actions: SyncPlanAction[] = drifts.map((item): SyncPlanAction => ({
    action: item.suggestedAction,
    source: item.path,
    reason: item.actual,
    riskLevel: item.severity,
    reversible: isReversible(item.suggestedAction),
  }));

  // 정렬: 심각도 → reversible 우선 → action 순서
  actions.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.riskLevel] - SEVERITY_ORDER[b.riskLevel];
    if (severityDiff !== 0) return severityDiff;
    // reversible 먼저
    if (a.reversible !== b.reversible) return a.reversible ? -1 : 1;
    return ACTION_ORDER[a.action] - ACTION_ORDER[b.action];
  });

  const overallRisk = computeOverallRisk(drifts);

  return {
    actions,
    estimatedChanges: actions.length,
    riskLevel: overallRisk,
  };
}

function isReversible(action: SyncAction): boolean {
  switch (action) {
    case 'rename':
    case 'create-index':
    case 'create-main':
    case 'reclassify':
      return true;
    case 'move':
    case 'split':
    case 'merge':
      return false;
  }
}

function computeOverallRisk(drifts: DriftItem[]): DriftSeverity {
  if (drifts.some((d) => d.severity === 'critical')) return 'critical';
  if (drifts.some((d) => d.severity === 'high')) return 'high';
  if (drifts.some((d) => d.severity === 'medium')) return 'medium';
  return 'low';
}
