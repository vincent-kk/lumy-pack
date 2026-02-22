import { describe, expect, it } from 'vitest';

import {
  evaluateRule,
  evaluateRules,
  getActiveRules,
  loadBuiltinRules,
} from '../../../core/rule-engine.js';
import type { FractalNode, FractalTree } from '../../../types/fractal.js';
import { BUILTIN_RULE_IDS } from '../../../types/rules.js';
import type { RuleContext } from '../../../types/rules.js';

// 테스트용 헬퍼 - FractalNode 생성
function makeNode(overrides: Partial<FractalNode> = {}): FractalNode {
  return {
    path: '/root/module',
    name: 'module',
    type: 'fractal',
    parent: '/root',
    children: [],
    organs: [],
    hasClaudeMd: false,
    hasSpecMd: false,
    hasIndex: true,
    hasMain: false,
    depth: 1,
    metadata: {},
    ...overrides,
  };
}

// 테스트용 헬퍼 - FractalTree 생성
function makeTree(nodes: FractalNode[]): FractalTree {
  const map = new Map<string, FractalNode>();
  for (const n of nodes) map.set(n.path, n);
  const root =
    nodes.find((n) => n.parent === null)?.path ?? nodes[0]?.path ?? '/root';
  return { root, nodes: map, depth: 2, totalNodes: nodes.size };
}

describe('rule-engine', () => {
  describe('loadBuiltinRules', () => {
    it('should return exactly 7 built-in rules', () => {
      const rules = loadBuiltinRules();
      expect(rules).toHaveLength(7);
    });

    it('should include all required rule IDs', () => {
      const rules = loadBuiltinRules();
      const ids = rules.map((r) => r.id);
      expect(ids).toContain(BUILTIN_RULE_IDS.NAMING_CONVENTION);
      expect(ids).toContain(BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD);
      expect(ids).toContain(BUILTIN_RULE_IDS.INDEX_BARREL_PATTERN);
      expect(ids).toContain(BUILTIN_RULE_IDS.MODULE_ENTRY_POINT);
      expect(ids).toContain(BUILTIN_RULE_IDS.MAX_DEPTH);
      expect(ids).toContain(BUILTIN_RULE_IDS.CIRCULAR_DEPENDENCY);
      expect(ids).toContain(BUILTIN_RULE_IDS.PURE_FUNCTION_ISOLATION);
    });

    it('should have all rules enabled by default', () => {
      const rules = loadBuiltinRules();
      expect(rules.every((r) => r.enabled)).toBe(true);
    });
  });

  describe('getActiveRules', () => {
    it('should return only enabled rules', () => {
      const rules = loadBuiltinRules();
      rules[0].enabled = false;
      const active = getActiveRules(rules);
      expect(active).toHaveLength(6);
    });

    it('should return all rules when all enabled', () => {
      const rules = loadBuiltinRules();
      expect(getActiveRules(rules)).toHaveLength(7);
    });
  });

  describe('naming-convention rule', () => {
    it('should pass for kebab-case name', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.NAMING_CONVENTION,
      )!;
      const node = makeNode({ name: 'my-module', path: '/root/my-module' });
      const tree = makeTree([
        makeNode({ path: '/root', name: 'root', parent: null, depth: 0 }),
        node,
      ]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(0);
    });

    it('should pass for camelCase name', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.NAMING_CONVENTION,
      )!;
      const node = makeNode({ name: 'myModule', path: '/root/myModule' });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(0);
    });

    it('should fail for PascalCase name', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.NAMING_CONVENTION,
      )!;
      const node = makeNode({ name: 'MyModule', path: '/root/MyModule' });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(1);
    });

    it('should fail for snake_case name', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.NAMING_CONVENTION,
      )!;
      const node = makeNode({ name: 'my_module', path: '/root/my_module' });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(1);
    });
  });

  describe('organ-no-claudemd rule', () => {
    it('should fail when organ has CLAUDE.md', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
      )!;
      const node = makeNode({ type: 'organ', hasClaudeMd: true });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      const violations = rule.check(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe('error');
    });

    it('should pass when organ has no CLAUDE.md', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
      )!;
      const node = makeNode({ type: 'organ', hasClaudeMd: false });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(0);
    });

    it('should pass when fractal has CLAUDE.md', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.ORGAN_NO_CLAUDEMD,
      )!;
      const node = makeNode({ type: 'fractal', hasClaudeMd: true });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(0);
    });
  });

  describe('module-entry-point rule', () => {
    it('should fail for fractal without index.ts or main.ts', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
      )!;
      const node = makeNode({
        type: 'fractal',
        hasIndex: false,
        hasMain: false,
      });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(1);
    });

    it('should pass for fractal with index.ts', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
      )!;
      const node = makeNode({
        type: 'fractal',
        hasIndex: true,
        hasMain: false,
      });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(0);
    });

    it('should not apply to organ nodes', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.MODULE_ENTRY_POINT,
      )!;
      const node = makeNode({ type: 'organ', hasIndex: false, hasMain: false });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(rule.check(ctx)).toHaveLength(0);
    });
  });

  describe('max-depth rule', () => {
    it('should fail when node depth exceeds maxDepth', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.MAX_DEPTH,
      )!;
      const node = makeNode({ depth: 11 });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree, scanOptions: { maxDepth: 10 } };
      expect(rule.check(ctx)).toHaveLength(1);
    });

    it('should pass when node depth equals maxDepth', () => {
      const rule = loadBuiltinRules().find(
        (r) => r.id === BUILTIN_RULE_IDS.MAX_DEPTH,
      )!;
      const node = makeNode({ depth: 10 });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree, scanOptions: { maxDepth: 10 } };
      expect(rule.check(ctx)).toHaveLength(0);
    });
  });

  describe('evaluateRule', () => {
    it('should return empty array for disabled rule', () => {
      const rule = loadBuiltinRules()[0];
      rule.enabled = false;
      const node = makeNode({ name: 'Bad_Name' });
      const tree = makeTree([node]);
      const ctx: RuleContext = { node, tree };
      expect(evaluateRule(rule, ctx)).toHaveLength(0);
    });
  });

  describe('evaluateRules', () => {
    it('should return evaluation result with violations', () => {
      const rootNode = makeNode({
        path: '/root',
        name: 'root',
        parent: null,
        depth: 0,
      });
      const badNode = makeNode({
        path: '/root/Bad_Module',
        name: 'Bad_Module',
        parent: '/root',
        depth: 1,
        type: 'fractal',
        hasIndex: false,
        hasMain: false,
      });
      const tree = makeTree([rootNode, badNode]);
      const result = evaluateRules(tree);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should count passed and failed correctly', () => {
      const node = makeNode({ name: 'good-module', hasIndex: true });
      const tree = makeTree([node]);
      const result = evaluateRules(tree);
      expect(result.passed + result.failed + result.skipped).toBeGreaterThan(0);
    });
  });
});
