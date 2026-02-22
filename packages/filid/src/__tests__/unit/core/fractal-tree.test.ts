import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type NodeEntry,
  buildFractalTree,
  findNode,
  getAncestors,
  getDescendants,
  getFractalsUnderOrgans,
  scanProject,
  shouldExclude,
} from '../../../core/fractal-tree.js';
import type { CategoryType } from '../../../types/fractal.js';

const entry = (
  path: string,
  type: CategoryType,
  hasClaudeMd = false,
  hasSpecMd = false,
): NodeEntry => ({
  path,
  name: path.split('/').pop()!,
  type,
  hasClaudeMd,
  hasSpecMd,
});

describe('fractal-tree', () => {
  describe('buildFractalTree', () => {
    it('should build a tree with single root', () => {
      const entries: NodeEntry[] = [entry('/app', 'fractal', true)];
      const tree = buildFractalTree(entries);
      expect(tree.root).toBe('/app');
      expect(tree.nodes.size).toBe(1);
      const root = tree.nodes.get('/app')!;
      expect(root.parent).toBeNull();
      expect(root.children).toHaveLength(0);
      expect(root.organs).toHaveLength(0);
    });

    it('should establish parent-child relationships for fractals', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
        entry('/app/dashboard', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      const root = tree.nodes.get('/app')!;
      expect(root.children).toContain('/app/auth');
      expect(root.children).toContain('/app/dashboard');

      const auth = tree.nodes.get('/app/auth')!;
      expect(auth.parent).toBe('/app');
    });

    it('should assign organ directories to their parent fractal', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/utils', 'organ'),
      ];
      const tree = buildFractalTree(entries);
      const root = tree.nodes.get('/app')!;
      expect(root.organs).toContain('/app/components');
      expect(root.organs).toContain('/app/utils');
      expect(root.children).toHaveLength(0);
    });

    it('should handle nested fractals with organs', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
        entry('/app/auth/components', 'organ'),
        entry('/app/components', 'organ'),
      ];
      const tree = buildFractalTree(entries);

      const app = tree.nodes.get('/app')!;
      expect(app.organs).toContain('/app/components');
      expect(app.children).toContain('/app/auth');

      const auth = tree.nodes.get('/app/auth')!;
      expect(auth.organs).toContain('/app/auth/components');
      expect(auth.parent).toBe('/app');
    });

    it('should handle pure-function nodes', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/math', 'pure-function'),
      ];
      const tree = buildFractalTree(entries);
      const app = tree.nodes.get('/app')!;
      // pure-function is a child, not an organ
      expect(app.children).toContain('/app/math');
      expect(app.organs).toHaveLength(0);
    });

    it('should select the shortest path as root when no single root exists', () => {
      const entries: NodeEntry[] = [
        entry('/app/auth', 'fractal', true),
        entry('/app/dashboard', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      // Both are at same depth, first alphabetically or by insertion should be root
      expect(tree.root).toBeTruthy();
      expect(tree.nodes.size).toBe(2);
    });

    it('should return empty tree for no entries', () => {
      const tree = buildFractalTree([]);
      expect(tree.root).toBe('');
      expect(tree.nodes.size).toBe(0);
    });
  });

  describe('findNode', () => {
    it('should find existing node by path', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      const node = findNode(tree, '/app/auth');
      expect(node).toBeDefined();
      expect(node!.name).toBe('auth');
    });

    it('should return undefined for non-existent path', () => {
      const entries: NodeEntry[] = [entry('/app', 'fractal', true)];
      const tree = buildFractalTree(entries);
      expect(findNode(tree, '/nonexistent')).toBeUndefined();
    });
  });

  describe('getAncestors', () => {
    it('should return ancestors from leaf to root', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
        entry('/app/auth/login', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      const ancestors = getAncestors(tree, '/app/auth/login');
      expect(ancestors.map((n) => n.path)).toEqual(['/app/auth', '/app']);
    });

    it('should return empty array for root node', () => {
      const entries: NodeEntry[] = [entry('/app', 'fractal', true)];
      const tree = buildFractalTree(entries);
      expect(getAncestors(tree, '/app')).toHaveLength(0);
    });

    it('should return empty array for non-existent path', () => {
      const entries: NodeEntry[] = [entry('/app', 'fractal', true)];
      const tree = buildFractalTree(entries);
      expect(getAncestors(tree, '/nonexistent')).toHaveLength(0);
    });
  });

  describe('getDescendants', () => {
    it('should return all descendants', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
        entry('/app/auth/login', 'fractal', true),
        entry('/app/dashboard', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      const descendants = getDescendants(tree, '/app');
      const paths = descendants.map((n) => n.path);
      expect(paths).toContain('/app/auth');
      expect(paths).toContain('/app/auth/login');
      expect(paths).toContain('/app/dashboard');
      expect(paths).toHaveLength(3);
    });

    it('should return empty array for leaf node', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      expect(getDescendants(tree, '/app/auth')).toHaveLength(0);
    });

    it('should return empty array for non-existent path', () => {
      const entries: NodeEntry[] = [entry('/app', 'fractal', true)];
      const tree = buildFractalTree(entries);
      expect(getDescendants(tree, '/nonexistent')).toHaveLength(0);
    });
  });

  describe('getFractalsUnderOrgans', () => {
    it('should find fractal nested inside a single organ', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/components/Modal', 'fractal'),
      ];
      const tree = buildFractalTree(entries);
      const result = getFractalsUnderOrgans(tree, '/app');
      expect(result.map((n) => n.path)).toContain('/app/components/Modal');
    });

    it('should find fractal nested inside organ > organ chain', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/components/location', 'organ'),
        entry('/app/components/location/FindLocationModal', 'fractal'),
      ];
      const tree = buildFractalTree(entries);
      const result = getFractalsUnderOrgans(tree, '/app');
      expect(result.map((n) => n.path)).toContain(
        '/app/components/location/FindLocationModal',
      );
    });

    it('should return empty array when organ contains only organs (no fractal)', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/components/utils', 'organ'),
      ];
      const tree = buildFractalTree(entries);
      const result = getFractalsUnderOrgans(tree, '/app');
      expect(result).toHaveLength(0);
    });

    it('should find fractals at multiple organ nesting levels', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/components/Modal', 'fractal'),
        entry('/app/components/location', 'organ'),
        entry('/app/components/location/FindLocationModal', 'fractal'),
      ];
      const tree = buildFractalTree(entries);
      const result = getFractalsUnderOrgans(tree, '/app');
      const paths = result.map((n) => n.path);
      expect(paths).toContain('/app/components/Modal');
      expect(paths).toContain('/app/components/location/FindLocationModal');
    });

    it('should find fractals in organ-inside-fractal-inside-organ pattern', () => {
      // organ > fractal > organ > fractal
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/components/location', 'fractal'),
        entry('/app/components/location/hooks', 'organ'),
        entry('/app/components/location/FindLocationModal', 'fractal'),
      ];
      const tree = buildFractalTree(entries);
      const result = getFractalsUnderOrgans(tree, '/app');
      const paths = result.map((n) => n.path);
      expect(paths).toContain('/app/components/location');
      expect(paths).toContain('/app/components/location/FindLocationModal');
    });

    it('should not return duplicate nodes (dedup via visited set)', () => {
      // organ > fractal(location) > organ(hooks) > fractal(FindLocationModal)
      // FindLocationModal must appear exactly once
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/components', 'organ'),
        entry('/app/components/location', 'fractal'),
        entry('/app/components/location/hooks', 'organ'),
        entry('/app/components/location/FindLocationModal', 'fractal'),
      ];
      const tree = buildFractalTree(entries);
      const result = getFractalsUnderOrgans(tree, '/app');
      const paths = result.map((n) => n.path);
      const count = paths.filter((p) => p.includes('FindLocationModal')).length;
      expect(count).toBe(1);
    });

    it('should return empty array for non-existent path', () => {
      const entries: NodeEntry[] = [entry('/app', 'fractal', true)];
      const tree = buildFractalTree(entries);
      expect(getFractalsUnderOrgans(tree, '/nonexistent')).toHaveLength(0);
    });

    it('should return empty array when node has no organs', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
        entry('/app/auth', 'fractal', true),
      ];
      const tree = buildFractalTree(entries);
      expect(getFractalsUnderOrgans(tree, '/app')).toHaveLength(0);
    });
  });

  describe('shouldExclude', () => {
    it('should exclude node_modules paths', () => {
      expect(shouldExclude('node_modules', {})).toBe(true);
      expect(shouldExclude('node_modules/lodash', {})).toBe(true);
    });

    it('should exclude .git paths', () => {
      expect(shouldExclude('.git', {})).toBe(true);
    });

    it('should exclude dist paths', () => {
      expect(shouldExclude('dist', {})).toBe(true);
      expect(shouldExclude('dist/cjs', {})).toBe(true);
    });

    it('should not exclude regular source dirs', () => {
      expect(shouldExclude('src', {})).toBe(false);
      expect(shouldExclude('src/core', {})).toBe(false);
    });

    it('should respect custom exclude patterns', () => {
      expect(
        shouldExclude('custom-dir', { exclude: ['**/custom-dir/**'] }),
      ).toBe(true);
      expect(
        shouldExclude('other-dir', { exclude: ['**/custom-dir/**'] }),
      ).toBe(false);
    });
  });

  describe('scanProject', () => {
    let tmpDir: string;

    const setup = (structure: Record<string, string[]>) => {
      tmpDir = join(tmpdir(), `filid-test-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
      for (const [dir, files] of Object.entries(structure)) {
        const absDir = join(tmpDir, dir);
        mkdirSync(absDir, { recursive: true });
        for (const file of files) {
          writeFileSync(join(absDir, file), '');
        }
      }
    };

    const teardown = () => {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    };

    it('should build a tree from a real directory structure', async () => {
      setup({
        '.': ['CLAUDE.md', 'index.ts'],
        auth: ['CLAUDE.md', 'index.ts'],
        'auth/components': [],
      });

      try {
        const tree = await scanProject(tmpDir);

        expect(tree.root).toBe(tmpDir);
        expect(tree.nodes.size).toBeGreaterThan(0);
        expect(tree.totalNodes).toBeGreaterThan(0);
      } finally {
        teardown();
      }
    });

    it('should detect CLAUDE.md and classify as fractal', async () => {
      setup({
        '.': ['CLAUDE.md'],
        auth: ['CLAUDE.md'],
      });

      try {
        const tree = await scanProject(tmpDir);
        const root = tree.nodes.get(tmpDir);

        expect(root).toBeDefined();
        expect(root!.hasClaudeMd).toBe(true);
        expect(root!.type).toBe('fractal');
      } finally {
        teardown();
      }
    });

    it('should classify leaf dir without CLAUDE.md as organ', async () => {
      setup({
        '.': ['CLAUDE.md'],
        utils: ['helper.ts'],
      });

      try {
        const tree = await scanProject(tmpDir);
        const utils = tree.nodes.get(join(tmpDir, 'utils'));

        expect(utils).toBeDefined();
        expect(utils!.type).toBe('organ');
      } finally {
        teardown();
      }
    });

    it('should detect index.ts presence', async () => {
      setup({
        '.': ['CLAUDE.md', 'index.ts'],
      });

      try {
        const tree = await scanProject(tmpDir);
        const root = tree.nodes.get(tmpDir);

        expect(root!.hasIndex).toBe(true);
      } finally {
        teardown();
      }
    });

    it('should respect maxDepth option', async () => {
      setup({
        '.': ['CLAUDE.md'],
        level1: [],
        'level1/level2': [],
        'level1/level2/level3': [],
      });

      try {
        const tree = await scanProject(tmpDir, { maxDepth: 1 });

        // Should include root and level1, but not deeper
        expect(tree.nodes.has(join(tmpDir, 'level1/level2'))).toBe(false);
      } finally {
        teardown();
      }
    });

    it('should exclude node_modules by default', async () => {
      setup({
        '.': ['CLAUDE.md'],
        'node_modules/some-package': [],
      });

      try {
        const tree = await scanProject(tmpDir);

        const hasNodeModules = [...tree.nodes.keys()].some((k) =>
          k.includes('node_modules'),
        );
        expect(hasNodeModules).toBe(false);
      } finally {
        teardown();
      }
    });

    it('should return correct totalNodes and depth', async () => {
      setup({
        '.': ['CLAUDE.md'],
        auth: ['CLAUDE.md'],
        'auth/login': [],
      });

      try {
        const tree = await scanProject(tmpDir);

        expect(tree.totalNodes).toBeGreaterThan(0);
        expect(tree.depth).toBeGreaterThanOrEqual(0);
      } finally {
        teardown();
      }
    });
  });
});
