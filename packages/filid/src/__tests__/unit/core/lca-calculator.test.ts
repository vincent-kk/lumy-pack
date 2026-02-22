import { describe, it, expect } from 'vitest';
import {
  findLCA,
  getAncestorPaths,
  getModulePlacement,
} from '../../../core/lca-calculator.js';
import type { FractalTree, FractalNode } from '../../../types/fractal.js';

// 헬퍼: FractalNode 생성
function makeNode(overrides: Partial<FractalNode> & { path: string; name: string }): FractalNode {
  return {
    type: 'fractal',
    parent: null,
    children: [],
    organs: [],
    hasClaudeMd: false,
    hasSpecMd: false,
    hasIndex: false,
    hasMain: false,
    depth: 0,
    metadata: {},
    ...overrides,
  };
}

// 헬퍼: 트리 구축
//  /root
//  ├── /root/a
//  │   ├── /root/a/x
//  │   └── /root/a/y
//  └── /root/b
//      └── /root/b/z
function buildTestTree(): FractalTree {
  const root = makeNode({ path: '/root', name: 'root', depth: 0, parent: null, children: ['/root/a', '/root/b'] });
  const a = makeNode({ path: '/root/a', name: 'a', depth: 1, parent: '/root', children: ['/root/a/x', '/root/a/y'] });
  const b = makeNode({ path: '/root/b', name: 'b', depth: 1, parent: '/root', children: ['/root/b/z'] });
  const ax = makeNode({ path: '/root/a/x', name: 'x', depth: 2, parent: '/root/a' });
  const ay = makeNode({ path: '/root/a/y', name: 'y', depth: 2, parent: '/root/a' });
  const bz = makeNode({ path: '/root/b/z', name: 'z', depth: 2, parent: '/root/b' });

  const nodes = new Map<string, FractalNode>([
    ['/root', root],
    ['/root/a', a],
    ['/root/b', b],
    ['/root/a/x', ax],
    ['/root/a/y', ay],
    ['/root/b/z', bz],
  ]);

  return { root: '/root', nodes, depth: 2, totalNodes: 6 };
}

describe('lca-calculator', () => {
  describe('getAncestorPaths', () => {
    it('should return path chain from node to root (inclusive)', () => {
      const tree = buildTestTree();
      const paths = getAncestorPaths(tree, '/root/a/x');
      expect(paths).toEqual(['/root/a/x', '/root/a', '/root']);
    });

    it('should return single element for root node', () => {
      const tree = buildTestTree();
      const paths = getAncestorPaths(tree, '/root');
      expect(paths).toEqual(['/root']);
    });

    it('should return empty array for unknown node', () => {
      const tree = buildTestTree();
      const paths = getAncestorPaths(tree, '/nonexistent');
      expect(paths).toEqual([]);
    });
  });

  describe('findLCA', () => {
    it('should find LCA of siblings (same parent)', () => {
      const tree = buildTestTree();
      const lca = findLCA(tree, '/root/a/x', '/root/a/y');
      expect(lca?.path).toBe('/root/a');
    });

    it('should find LCA of nodes in different subtrees', () => {
      const tree = buildTestTree();
      const lca = findLCA(tree, '/root/a/x', '/root/b/z');
      expect(lca?.path).toBe('/root');
    });

    it('should return the node itself when pathA === pathB', () => {
      const tree = buildTestTree();
      const lca = findLCA(tree, '/root/a', '/root/a');
      expect(lca?.path).toBe('/root/a');
    });

    it('should return ancestor when one path is ancestor of other', () => {
      const tree = buildTestTree();
      const lca = findLCA(tree, '/root/a', '/root/a/x');
      expect(lca?.path).toBe('/root/a');
    });

    it('should return null for unknown node', () => {
      const tree = buildTestTree();
      const lca = findLCA(tree, '/root/a', '/nonexistent');
      expect(lca).toBeNull();
    });

    it('should return root as LCA of root\'s direct children', () => {
      const tree = buildTestTree();
      const lca = findLCA(tree, '/root/a', '/root/b');
      expect(lca?.path).toBe('/root');
    });
  });

  describe('getModulePlacement', () => {
    it('should return root for empty dependencies', () => {
      const tree = buildTestTree();
      const result = getModulePlacement(tree, []);
      expect(result.suggestedParent).toBe('/root');
      expect(result.confidence).toBe(0);
    });

    it('should return parent of single dependency', () => {
      const tree = buildTestTree();
      const result = getModulePlacement(tree, ['/root/a/x']);
      expect(result.suggestedParent).toBe('/root/a');
      expect(result.confidence).toBe(0.5);
    });

    it('should suggest deepest common ancestor for siblings', () => {
      const tree = buildTestTree();
      const result = getModulePlacement(tree, ['/root/a/x', '/root/a/y']);
      expect(result.suggestedParent).toBe('/root/a');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should suggest root for nodes in different branches', () => {
      const tree = buildTestTree();
      const result = getModulePlacement(tree, ['/root/a/x', '/root/b/z']);
      expect(result.suggestedParent).toBe('/root');
    });

    it('should handle three dependencies correctly', () => {
      const tree = buildTestTree();
      // x, y are under /a, z is under /b → deepest pairwise LCA = /root/a (for x,y pair)
      const result = getModulePlacement(tree, ['/root/a/x', '/root/a/y', '/root/b/z']);
      expect(result.suggestedParent).toBe('/root/a');
    });
  });
});
