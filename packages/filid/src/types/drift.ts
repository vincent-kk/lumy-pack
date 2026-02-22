/**
 * @file drift.ts
 * @description 프랙탈 구조 이격(drift) 감지 및 보정 계획 타입.
 *
 * "이격"이란 현재 코드베이스의 실제 구조와 filid v2 규칙이 기대하는
 * 이상적인 구조 사이의 괴리를 말한다.
 */

export type DriftSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SyncAction =
  | 'move'
  | 'rename'
  | 'create-index'
  | 'create-main'
  | 'reclassify'
  | 'split'
  | 'merge';

export interface DriftItem {
  path: string;
  rule: string;
  expected: string;
  actual: string;
  severity: DriftSeverity;
  suggestedAction: SyncAction;
}

export interface DriftResult {
  items: DriftItem[];
  totalDrifts: number;
  bySeverity: Record<DriftSeverity, number>;
  scanTimestamp: string;
}

export interface SyncPlanAction {
  action: SyncAction;
  source: string;
  target?: string;
  reason: string;
  riskLevel: DriftSeverity;
  reversible: boolean;
}

export interface SyncPlan {
  actions: SyncPlanAction[];
  estimatedChanges: number;
  riskLevel: DriftSeverity;
}

export interface DetectDriftOptions {
  criticalOnly?: boolean;
  generatePlan?: boolean;
}
