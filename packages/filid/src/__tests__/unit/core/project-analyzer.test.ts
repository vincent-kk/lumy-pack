import { describe, expect, it } from 'vitest';

import { buildFractalTree } from '../../../core/fractal-tree.js';
import type { NodeEntry } from '../../../core/fractal-tree.js';
import {
  calculateHealthScore,
  generateReport,
} from '../../../core/project-analyzer.js';
import type { NodeType } from '../../../types/fractal.js';
import type { AnalysisReport } from '../../../types/report.js';

const entry = (
  path: string,
  type: NodeType,
  hasClaudeMd = false,
  hasSpecMd = false,
  hasIndex = false,
): NodeEntry => ({
  path,
  name: path.split('/').pop()!,
  type,
  hasClaudeMd,
  hasSpecMd,
  hasIndex,
});

function makeReport(
  overrides: Partial<{
    errorCount: number;
    warningCount: number;
    criticalDrifts: number;
    highDrifts: number;
  }>,
): AnalysisReport {
  const {
    errorCount = 0,
    warningCount = 0,
    criticalDrifts = 0,
    highDrifts = 0,
  } = overrides;

  const tree = buildFractalTree([entry('/app', 'fractal', true, false, true)]);

  const violations = [
    ...Array.from({ length: errorCount }, (_, i) => ({
      ruleId: 'test-error',
      severity: 'error' as const,
      message: `Error ${i}`,
      path: '/app',
    })),
    ...Array.from({ length: warningCount }, (_, i) => ({
      ruleId: 'test-warning',
      severity: 'warning' as const,
      message: `Warning ${i}`,
      path: '/app',
    })),
  ];

  return {
    scan: {
      tree,
      modules: [],
      timestamp: new Date().toISOString(),
      duration: 100,
    },
    validation: {
      result: {
        violations,
        passed: 10,
        failed: errorCount + warningCount,
        skipped: 0,
        duration: 50,
      },
      timestamp: new Date().toISOString(),
    },
    drift: {
      drift: {
        items: [],
        totalDrifts: criticalDrifts + highDrifts,
        bySeverity: {
          critical: criticalDrifts,
          high: highDrifts,
          medium: 0,
          low: 0,
        },
        scanTimestamp: new Date().toISOString(),
      },
      syncPlan: null,
      timestamp: new Date().toISOString(),
    },
    summary: {
      totalModules: 1,
      violations: errorCount + warningCount,
      drifts: criticalDrifts + highDrifts,
      healthScore: 0,
    },
  };
}

describe('project-analyzer', () => {
  describe('calculateHealthScore', () => {
    it('should return 100 for a perfect project', () => {
      const report = makeReport({});
      report.summary.healthScore = 100;
      expect(calculateHealthScore(report)).toBe(100);
    });

    it('should deduct 5 per error violation (max -50)', () => {
      expect(calculateHealthScore(makeReport({ errorCount: 1 }))).toBe(95);
      expect(calculateHealthScore(makeReport({ errorCount: 5 }))).toBe(75);
      expect(calculateHealthScore(makeReport({ errorCount: 10 }))).toBe(50);
      // Max -50: beyond 10 errors still caps at 50
      expect(calculateHealthScore(makeReport({ errorCount: 20 }))).toBe(50);
    });

    it('should deduct 2 per warning violation (max -20)', () => {
      expect(calculateHealthScore(makeReport({ warningCount: 1 }))).toBe(98);
      expect(calculateHealthScore(makeReport({ warningCount: 5 }))).toBe(90);
      expect(calculateHealthScore(makeReport({ warningCount: 10 }))).toBe(80);
      // Max -20
      expect(calculateHealthScore(makeReport({ warningCount: 20 }))).toBe(80);
    });

    it('should deduct 10 per critical drift (max -30)', () => {
      expect(calculateHealthScore(makeReport({ criticalDrifts: 1 }))).toBe(90);
      expect(calculateHealthScore(makeReport({ criticalDrifts: 3 }))).toBe(70);
      // Max -30
      expect(calculateHealthScore(makeReport({ criticalDrifts: 5 }))).toBe(70);
    });

    it('should deduct 5 per high drift (max -20)', () => {
      expect(calculateHealthScore(makeReport({ highDrifts: 1 }))).toBe(95);
      expect(calculateHealthScore(makeReport({ highDrifts: 4 }))).toBe(80);
      // Max -20
      expect(calculateHealthScore(makeReport({ highDrifts: 6 }))).toBe(80);
    });

    it('should not go below 0', () => {
      const report = makeReport({
        errorCount: 20,
        warningCount: 20,
        criticalDrifts: 5,
        highDrifts: 6,
      });
      expect(calculateHealthScore(report)).toBe(0);
    });

    it('should combine all deductions', () => {
      // 2 errors (-10) + 2 warnings (-4) + 1 critical (-10) + 1 high (-5) = -29 → 71
      const report = makeReport({
        errorCount: 2,
        warningCount: 2,
        criticalDrifts: 1,
        highDrifts: 1,
      });
      expect(calculateHealthScore(report)).toBe(71);
    });
  });

  describe('generateReport', () => {
    it('should render text format', () => {
      const report = makeReport({});
      const rendered = generateReport(report, { format: 'text' });

      expect(rendered.format).toBe('text');
      expect(rendered.content).toContain('filid v2 Analysis Report');
      expect(rendered.content).toContain('Health Score');
      expect(rendered.duration).toBeGreaterThanOrEqual(0);
    });

    it('should render markdown format', () => {
      const report = makeReport({});
      const rendered = generateReport(report, { format: 'markdown' });

      expect(rendered.format).toBe('markdown');
      expect(rendered.content).toContain('# filid v2 Analysis Report');
      expect(rendered.content).toContain('## Summary');
    });

    it('should render json format', () => {
      const report = makeReport({});
      const rendered = generateReport(report, { format: 'json' });

      expect(rendered.format).toBe('json');
      const parsed = JSON.parse(rendered.content);
      expect(parsed.summary).toBeDefined();
    });

    it('should include violations in text report', () => {
      const report = makeReport({ errorCount: 1 });
      const rendered = generateReport(report, { format: 'text' });

      expect(rendered.content).toContain('Violations');
      expect(rendered.content).toContain('[ERROR]');
    });

    it('should include violations in markdown report', () => {
      const report = makeReport({ errorCount: 1 });
      const rendered = generateReport(report, { format: 'markdown' });

      expect(rendered.content).toContain('## Violations');
    });
  });
});
