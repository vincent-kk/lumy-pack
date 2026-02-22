import { describe, expect, it } from 'vitest';

import { buildFractalTree } from '../../../core/fractal-tree.js';
import type { NodeEntry } from '../../../core/fractal-tree.js';
import {
  validateDependencies,
  validateNode,
  validateStructure,
} from '../../../core/fractal-validator.js';
import type { NodeType } from '../../../types/fractal.js';
import type { Rule, RuleContext } from '../../../types/rules.js';

const entry = (
  path: string,
  type: NodeType,
  hasClaudeMd = false,
  hasSpecMd = false,
  hasIndex = false,
  hasMain = false,
): NodeEntry => ({
  path,
  name: path.split('/').pop()!,
  type,
  hasClaudeMd,
  hasSpecMd,
  hasIndex,
  hasMain,
});

describe('fractal-validator', () => {
  describe('validateStructure', () => {
    it('should return a ValidationReport with timestamp', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
      ]);
      const report = validateStructure(tree);

      expect(report).toBeDefined();
      expect(report.result).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(typeof report.result.passed).toBe('number');
      expect(typeof report.result.failed).toBe('number');
      expect(Array.isArray(report.result.violations)).toBe(true);
    });

    it('should detect organ with CLAUDE.md as violation', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
        {
          path: '/app/utils',
          name: 'utils',
          type: 'organ',
          hasClaudeMd: true,
          hasSpecMd: false,
        },
      ]);
      const report = validateStructure(tree);

      const violation = report.result.violations.find(
        (v) => v.ruleId === 'organ-no-claudemd',
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe('error');
      expect(violation!.path).toBe('/app/utils');
    });

    it('should detect fractal without entry point as warning', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, false, false),
      ]);
      const report = validateStructure(tree);

      const violation = report.result.violations.find(
        (v) => v.ruleId === 'module-entry-point',
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe('warning');
    });

    it('should pass for valid fractal with index.ts', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
        entry('/app/auth', 'fractal', true, false, true),
      ]);
      const report = validateStructure(tree);

      const entryViolations = report.result.violations.filter(
        (v) => v.ruleId === 'module-entry-point',
      );
      expect(entryViolations).toHaveLength(0);
    });

    it('should pass for valid fractal with main.ts', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, false, true),
      ]);
      const report = validateStructure(tree);

      const entryViolations = report.result.violations.filter(
        (v) => v.ruleId === 'module-entry-point',
      );
      expect(entryViolations).toHaveLength(0);
    });

    it('should accept custom rules via parameter', () => {
      const customRule: Rule = {
        id: 'custom-test-rule',
        name: 'Custom Test Rule',
        description: 'Always fails',
        category: 'structure',
        severity: 'warning',
        enabled: true,
        check: (ctx: RuleContext) => [
          {
            ruleId: 'custom-test-rule',
            severity: 'warning',
            message: 'Always fails',
            path: ctx.node.path,
          },
        ],
      };

      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
      ]);
      const report = validateStructure(tree, [customRule]);

      expect(report.result.violations).toHaveLength(1);
      expect(report.result.violations[0].ruleId).toBe('custom-test-rule');
    });

    it('should skip disabled rules', () => {
      const disabledRule: Rule = {
        id: 'disabled-rule',
        name: 'Disabled Rule',
        description: 'Should not run',
        category: 'structure',
        severity: 'error',
        enabled: false,
        check: () => [
          {
            ruleId: 'disabled-rule',
            severity: 'error',
            message: 'Should not appear',
            path: '',
          },
        ],
      };

      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
      ]);
      const report = validateStructure(tree, [disabledRule]);

      expect(report.result.violations).toHaveLength(0);
      expect(report.result.skipped).toBe(1);
    });

    it('should track duration', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
      ]);
      const report = validateStructure(tree);

      expect(report.result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateNode', () => {
    it('should validate a single node with a specific rule', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, false),
      ]);
      const node = tree.nodes.get('/app')!;
      const context: RuleContext = { node, tree };

      const rule: Rule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        category: 'structure',
        severity: 'error',
        enabled: true,
        check: (ctx) =>
          ctx.node.hasIndex
            ? []
            : [
                {
                  ruleId: 'test-rule',
                  severity: 'error',
                  message: 'No index',
                  path: ctx.node.path,
                },
              ],
      };

      const violations = validateNode(node, context, rule);
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('test-rule');
    });

    it('should run all default rules when no rule specified', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, false),
      ]);
      const node = tree.nodes.get('/app')!;
      const context: RuleContext = { node, tree };

      const violations = validateNode(node, context);
      // fractal without index.ts/main.ts should trigger module-entry-point
      expect(violations.some((v) => v.ruleId === 'module-entry-point')).toBe(
        true,
      );
    });
  });

  describe('validateDependencies', () => {
    it('should return empty array for tree with no cycles', () => {
      const tree = buildFractalTree([
        entry('/app', 'fractal', true, false, true),
        entry('/app/auth', 'fractal', true, false, true),
        entry('/app/dashboard', 'fractal', true, false, true),
      ]);

      const violations = validateDependencies(tree);
      expect(violations).toHaveLength(0);
    });

    it('should return violations for an empty tree', () => {
      const tree = buildFractalTree([]);
      const violations = validateDependencies(tree);
      expect(violations).toHaveLength(0);
    });
  });
});
