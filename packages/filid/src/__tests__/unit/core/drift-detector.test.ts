import { describe, expect, it } from 'vitest';

import {
  calculateSeverity,
  compareCurrent,
  detectDrift,
  generateSyncPlan,
} from '../../../core/drift-detector.js';
import { buildFractalTree } from '../../../core/fractal-tree.js';
import type { NodeEntry } from '../../../core/fractal-tree.js';
import type { DriftItem } from '../../../types/drift.js';
import type { NodeType } from '../../../types/fractal.js';
import type {
  RuleEvaluationResult,
  RuleViolation,
} from '../../../types/rules.js';

const entry = (
  path: string,
  type: NodeType,
  hasClaudeMd = false,
  hasSpecMd = false,
): NodeEntry => ({
  path,
  name: path.split('/').pop()!,
  type,
  hasClaudeMd,
  hasSpecMd,
});

const makeViolation = (
  ruleId: string,
  severity: 'error' | 'warning' | 'info',
  path = '/app',
): RuleViolation => ({
  ruleId,
  severity,
  message: `Violation of ${ruleId}`,
  path,
  suggestion: `Fix ${ruleId}`,
});

describe('drift-detector', () => {
  describe('calculateSeverity', () => {
    it('should map circular-dependency to critical', () => {
      expect(
        calculateSeverity(makeViolation('circular-dependency', 'error')),
      ).toBe('critical');
    });

    it('should map pure-function-isolation to critical', () => {
      expect(
        calculateSeverity(makeViolation('pure-function-isolation', 'error')),
      ).toBe('critical');
    });

    it('should map max-depth to high', () => {
      expect(calculateSeverity(makeViolation('max-depth', 'error'))).toBe(
        'high',
      );
    });

    it('should map organ-no-claudemd to high', () => {
      expect(
        calculateSeverity(makeViolation('organ-no-claudemd', 'error')),
      ).toBe('high');
    });

    it('should map index-barrel-pattern to medium', () => {
      expect(
        calculateSeverity(makeViolation('index-barrel-pattern', 'warning')),
      ).toBe('medium');
    });

    it('should map module-entry-point to medium', () => {
      expect(
        calculateSeverity(makeViolation('module-entry-point', 'warning')),
      ).toBe('medium');
    });

    it('should map naming-convention to low', () => {
      expect(
        calculateSeverity(makeViolation('naming-convention', 'warning')),
      ).toBe('low');
    });

    it('should fallback on severity for unknown ruleId', () => {
      expect(calculateSeverity(makeViolation('unknown-rule', 'error'))).toBe(
        'high',
      );
      expect(calculateSeverity(makeViolation('unknown-rule', 'warning'))).toBe(
        'medium',
      );
      expect(calculateSeverity(makeViolation('unknown-rule', 'info'))).toBe(
        'low',
      );
    });
  });

  describe('detectDrift', () => {
    it('should return empty DriftResult for no violations', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const result = detectDrift(tree, []);

      expect(result.items).toHaveLength(0);
      expect(result.totalDrifts).toBe(0);
      expect(result.bySeverity.critical).toBe(0);
      expect(result.bySeverity.high).toBe(0);
      expect(result.bySeverity.medium).toBe(0);
      expect(result.bySeverity.low).toBe(0);
    });

    it('should convert violations to DriftItems', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const violations: RuleViolation[] = [
        makeViolation('organ-no-claudemd', 'error', '/app/utils'),
        makeViolation('naming-convention', 'warning', '/app/MyComponent'),
      ];

      const result = detectDrift(tree, violations);

      expect(result.items).toHaveLength(2);
      expect(result.totalDrifts).toBe(2);
    });

    it('should sort items by severity (critical first)', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const violations: RuleViolation[] = [
        makeViolation('naming-convention', 'warning', '/app/A'),
        makeViolation('circular-dependency', 'error', '/app/B'),
        makeViolation('organ-no-claudemd', 'error', '/app/C'),
      ];

      const result = detectDrift(tree, violations);

      expect(result.items[0].severity).toBe('critical');
      expect(result.items[1].severity).toBe('high');
      expect(result.items[2].severity).toBe('low');
    });

    it('should count bySeverity correctly', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const violations: RuleViolation[] = [
        makeViolation('circular-dependency', 'error', '/app/A'),
        makeViolation('pure-function-isolation', 'error', '/app/B'),
        makeViolation('organ-no-claudemd', 'error', '/app/C'),
        makeViolation('module-entry-point', 'warning', '/app/D'),
      ];

      const result = detectDrift(tree, violations);

      expect(result.bySeverity.critical).toBe(2);
      expect(result.bySeverity.high).toBe(1);
      expect(result.bySeverity.medium).toBe(1);
      expect(result.bySeverity.low).toBe(0);
    });

    it('should filter to criticalOnly when option is set', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const violations: RuleViolation[] = [
        makeViolation('circular-dependency', 'error', '/app/A'),
        makeViolation('naming-convention', 'warning', '/app/B'),
      ];

      const result = detectDrift(tree, violations, { criticalOnly: true });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].severity).toBe('critical');
    });

    it('should include a scanTimestamp', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const result = detectDrift(tree, []);

      expect(result.scanTimestamp).toBeTruthy();
      expect(typeof result.scanTimestamp).toBe('string');
    });
  });

  describe('compareCurrent', () => {
    it('should convert RuleEvaluationResult to DriftItems', () => {
      const tree = buildFractalTree([entry('/app', 'fractal', true)]);
      const evalResult: RuleEvaluationResult = {
        violations: [makeViolation('organ-no-claudemd', 'error', '/app/utils')],
        passed: 5,
        failed: 1,
        skipped: 0,
        duration: 10,
      };

      const items = compareCurrent(tree, evalResult);

      expect(items).toHaveLength(1);
      expect(items[0].rule).toBe('organ-no-claudemd');
      expect(items[0].severity).toBe('high');
      expect(items[0].suggestedAction).toBe('move');
    });
  });

  describe('generateSyncPlan', () => {
    it('should return empty plan for no drifts', () => {
      const plan = generateSyncPlan([]);

      expect(plan.actions).toHaveLength(0);
      expect(plan.estimatedChanges).toBe(0);
    });

    it('should create SyncPlanAction for each DriftItem', () => {
      const drifts: DriftItem[] = [
        {
          path: '/app/utils',
          rule: 'organ-no-claudemd',
          expected: 'No CLAUDE.md',
          actual: 'Has CLAUDE.md',
          severity: 'high',
          suggestedAction: 'move',
        },
      ];

      const plan = generateSyncPlan(drifts);

      expect(plan.actions).toHaveLength(1);
      expect(plan.actions[0].action).toBe('move');
      expect(plan.actions[0].source).toBe('/app/utils');
      expect(plan.actions[0].riskLevel).toBe('high');
    });

    it('should set overall riskLevel to highest drift severity', () => {
      const drifts: DriftItem[] = [
        {
          path: '/a',
          rule: 'r1',
          expected: '',
          actual: '',
          severity: 'low',
          suggestedAction: 'rename',
        },
        {
          path: '/b',
          rule: 'r2',
          expected: '',
          actual: '',
          severity: 'critical',
          suggestedAction: 'move',
        },
        {
          path: '/c',
          rule: 'r3',
          expected: '',
          actual: '',
          severity: 'medium',
          suggestedAction: 'create-index',
        },
      ];

      const plan = generateSyncPlan(drifts);

      expect(plan.riskLevel).toBe('critical');
    });

    it('should sort reversible actions before non-reversible at same severity', () => {
      const drifts: DriftItem[] = [
        {
          path: '/a',
          rule: 'r1',
          expected: '',
          actual: '',
          severity: 'high',
          suggestedAction: 'move',
        },
        {
          path: '/b',
          rule: 'r2',
          expected: '',
          actual: '',
          severity: 'high',
          suggestedAction: 'rename',
        },
      ];

      const plan = generateSyncPlan(drifts);

      // rename is reversible, move is not — rename should come first
      expect(plan.actions[0].action).toBe('rename');
      expect(plan.actions[1].action).toBe('move');
    });

    it('should sort by severity (critical first)', () => {
      const drifts: DriftItem[] = [
        {
          path: '/a',
          rule: 'r1',
          expected: '',
          actual: '',
          severity: 'low',
          suggestedAction: 'rename',
        },
        {
          path: '/b',
          rule: 'r2',
          expected: '',
          actual: '',
          severity: 'critical',
          suggestedAction: 'move',
        },
      ];

      const plan = generateSyncPlan(drifts);

      expect(plan.actions[0].riskLevel).toBe('critical');
      expect(plan.actions[1].riskLevel).toBe('low');
    });
  });
});
