/**
 * @file project-analyzer.ts
 * @description 전체 분석 파이프라인 오케스트레이터.
 *
 * scan → validate → drift → report 파이프라인을 실행하고
 * AnalysisReport를 생성한다.
 */

import type { ModuleInfo } from '../types/fractal.js';
import type { AnalysisReport, AnalyzeOptions, RenderedReport, ScanReport, ValidationReport, DriftReport } from '../types/report.js';
import type { SyncPlan } from '../types/drift.js';
import { scanProject } from './fractal-tree.js';
import { validateStructure } from './fractal-validator.js';
import { detectDrift, generateSyncPlan } from './drift-detector.js';

/**
 * 프로젝트 루트에서 시작하여 전체 분석 파이프라인을 실행한다.
 *
 * 파이프라인:
 * 1. fractal-tree.scanProject() → ScanReport
 * 2. fractal-validator.validateStructure() → ValidationReport
 * 3. drift-detector.detectDrift() → DriftReport
 * 4. calculateHealthScore() → summary.healthScore
 *
 * @param root - 분석할 프로젝트 루트의 절대 경로
 * @param options - 분석 옵션 (detailed, includeDrift, generateSyncPlan)
 * @returns 종합 분석 보고서
 */
export async function analyzeProject(
  root: string,
  options?: AnalyzeOptions,
): Promise<AnalysisReport> {
  const opts: Required<AnalyzeOptions> = {
    detailed: true,
    includeDrift: true,
    generateSyncPlan: false,
    ...options,
  };

  // 1. 스캔
  const scanStart = Date.now();
  const tree = await scanProject(root);
  const modules: ModuleInfo[] = []; // module-main-analyzer는 Core B에서 구현
  const scanReport: ScanReport = {
    tree,
    modules,
    timestamp: new Date().toISOString(),
    duration: Date.now() - scanStart,
  };

  // 2. 검증
  const validationReport: ValidationReport = validateStructure(tree);

  // 3. 이격 감지
  let driftReport: DriftReport;
  if (opts.includeDrift) {
    const driftResult = detectDrift(
      tree,
      validationReport.result.violations,
      { generatePlan: opts.generateSyncPlan },
    );
    const syncPlan: SyncPlan | null = opts.generateSyncPlan
      ? generateSyncPlan(driftResult.items)
      : null;
    driftReport = {
      drift: driftResult,
      syncPlan,
      timestamp: new Date().toISOString(),
    };
  } else {
    driftReport = emptyDriftReport();
  }

  // 4. 종합
  const summary = {
    totalModules: tree.totalNodes,
    violations: validationReport.result.violations.length,
    drifts: driftReport.drift.totalDrifts,
    healthScore: 0,
  };

  const report: AnalysisReport = {
    scan: scanReport,
    validation: validationReport,
    drift: driftReport,
    summary,
  };

  report.summary.healthScore = calculateHealthScore(report);

  return report;
}

/**
 * AnalysisReport에서 건강도 점수(0~100)를 계산한다.
 *
 * 계산 공식:
 * base = 100
 * - error violations: -5점씩 (최대 -50)
 * - warning violations: -2점씩 (최대 -20)
 * - critical drifts: -10점씩 (최대 -30)
 * - high drifts: -5점씩 (최대 -20)
 * 최솟값: 0
 */
export function calculateHealthScore(report: AnalysisReport): number {
  let score = 100;

  const { violations } = report.validation.result;
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  score -= Math.min(errorCount * 5, 50);
  score -= Math.min(warningCount * 2, 20);

  const { bySeverity } = report.drift.drift;
  score -= Math.min((bySeverity.critical ?? 0) * 10, 30);
  score -= Math.min((bySeverity.high ?? 0) * 5, 20);

  return Math.max(0, score);
}

/**
 * AnalysisReport를 지정된 형식으로 렌더링한다.
 */
export function generateReport(
  analysis: AnalysisReport,
  outputConfig: { format: 'text' | 'json' | 'markdown'; verbose?: boolean },
): RenderedReport {
  const start = Date.now();
  let content: string;

  switch (outputConfig.format) {
    case 'json':
      content = JSON.stringify(
        {
          ...analysis,
          scan: { ...analysis.scan, tree: { root: analysis.scan.tree.root, totalNodes: analysis.scan.tree.totalNodes, depth: analysis.scan.tree.depth } },
        },
        null,
        2,
      );
      break;
    case 'markdown':
      content = renderMarkdownReport(analysis);
      break;
    default:
      content = renderTextReport(analysis, outputConfig);
  }

  return {
    content,
    format: outputConfig.format,
    duration: Date.now() - start,
  };
}

export function renderTextReport(
  analysis: AnalysisReport,
  _config: { verbose?: boolean },
): string {
  const { summary, validation, drift } = analysis;
  const lines: string[] = [
    'filid v2 Analysis Report',
    '═══════════════════════════════════════',
    `Root: ${analysis.scan.tree.root}`,
    `Scanned: ${analysis.scan.timestamp} | Duration: ${analysis.scan.duration}ms`,
    '',
    'Summary',
    '───────────────────────────────────────',
    `Total Modules  : ${summary.totalModules}`,
    `Violations     : ${summary.violations}`,
    `Drifts         : ${summary.drifts}`,
    `Health Score   : ${summary.healthScore} / 100`,
  ];

  if (validation.result.violations.length > 0) {
    lines.push('', 'Violations', '───────────────────────────────────────');
    for (const v of validation.result.violations) {
      lines.push(`[${v.severity.toUpperCase()}] ${v.ruleId}`);
      lines.push(`  ${v.message}`);
      if (v.suggestion) lines.push(`  Suggestion: ${v.suggestion}`);
    }
  }

  if (drift.drift.items.length > 0) {
    lines.push('', 'Drifts', '───────────────────────────────────────');
    for (const item of drift.drift.items) {
      lines.push(`[${item.severity.toUpperCase()}] ${item.path} — ${item.rule}`);
      lines.push(`  Expected: ${item.expected}`);
      lines.push(`  Actual:   ${item.actual}`);
      lines.push(`  Action:   ${item.suggestedAction}`);
    }
  }

  return lines.join('\n');
}

export function renderMarkdownReport(analysis: AnalysisReport): string {
  const { summary, validation, drift } = analysis;
  const lines: string[] = [
    '# filid v2 Analysis Report',
    '',
    `**Root:** \`${analysis.scan.tree.root}\`  `,
    `**Scanned:** ${analysis.scan.timestamp}  `,
    `**Duration:** ${analysis.scan.duration}ms`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Modules | ${summary.totalModules} |`,
    `| Violations | ${summary.violations} |`,
    `| Drifts | ${summary.drifts} |`,
    `| Health Score | ${summary.healthScore} / 100 |`,
  ];

  if (validation.result.violations.length > 0) {
    lines.push('', '## Violations', '');
    for (const v of validation.result.violations) {
      lines.push(`### \`${v.ruleId}\` (${v.severity})`);
      lines.push('');
      lines.push(`- **Path:** \`${v.path}\``);
      lines.push(`- **Message:** ${v.message}`);
      if (v.suggestion) lines.push(`- **Suggestion:** ${v.suggestion}`);
      lines.push('');
    }
  }

  if (drift.drift.items.length > 0) {
    lines.push('## Drifts', '');
    for (const item of drift.drift.items) {
      lines.push(`### \`${item.rule}\` — ${item.severity}`);
      lines.push('');
      lines.push(`- **Path:** \`${item.path}\``);
      lines.push(`- **Expected:** ${item.expected}`);
      lines.push(`- **Actual:** ${item.actual}`);
      lines.push(`- **Action:** \`${item.suggestedAction}\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function emptyDriftReport(): DriftReport {
  return {
    drift: {
      items: [],
      totalDrifts: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      scanTimestamp: new Date().toISOString(),
    },
    syncPlan: null,
    timestamp: new Date().toISOString(),
  };
}
