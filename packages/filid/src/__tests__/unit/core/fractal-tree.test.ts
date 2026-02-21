import { describe, it, expect } from 'vitest';
import type { NodeType } from '../../../types/fractal.js';
import {
  buildFractalTree,
  getAncestors,
  getDescendants,
  findNode,
  type NodeEntry,
} from '../../../core/fractal-tree.js';

const entry = (
  path: string,
  type: NodeType,
  hasClaudeMd = false,
  hasSpecMd = false,
): NodeEntry => ({ path, name: path.split('/').pop()!, type, hasClaudeMd, hasSpecMd });

describe('fractal-tree', () => {
  describe('buildFractalTree', () => {
    it('should build a tree with single root', () => {
      const entries: NodeEntry[] = [
        entry('/app', 'fractal', true),
      ];
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
});
