/**
 * @file report.ts
 * @description filid v2 분석 보고서 타입 정의.
 *
 * project-analyzer는 scan → validate → drift 파이프라인을 실행하고
 * AnalysisReport를 생성한다.
 */
import type { DriftResult, SyncPlan } from './drift.js';
import type { FractalTree, ModuleInfo } from './fractal.js';
import type { RuleEvaluationResult } from './rules.js';
import type { ScanOptions } from './scan.js';

export interface ScanReport {
  tree: FractalTree;
  modules: ModuleInfo[];
  timestamp: string;
  duration: number;
}

export interface ValidationReport {
  result: RuleEvaluationResult;
  scanOptions?: ScanOptions;
  timestamp: string;
}

export interface DriftReport {
  drift: DriftResult;
  syncPlan: SyncPlan | null;
  timestamp: string;
}

export interface AnalysisReport {
  scan: ScanReport;
  validation: ValidationReport;
  drift: DriftReport;
  summary: {
    totalModules: number;
    violations: number;
    drifts: number;
    healthScore: number;
  };
}

export interface AnalyzeOptions {
  detailed?: boolean;
  includeDrift?: boolean;
  generateSyncPlan?: boolean;
}

export interface RenderedReport {
  content: string;
  format: 'text' | 'json' | 'markdown';
  duration: number;
}
