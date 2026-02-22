import { describe, expect, it } from 'vitest';

import {
  buildDAG,
  detectCycles,
  getDirectDependencies,
  topologicalSort,
} from '../../../core/dependency-graph.js';
import type { DependencyEdge } from '../../../types/fractal.js';

describe('dependency-graph', () => {
  describe('buildDAG', () => {
    it('should build a DAG from edges', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'B', to: 'C', type: 'import' },
      ];
      const dag = buildDAG(edges);
      expect(dag.nodes.size).toBe(3);
      expect(dag.nodes.has('A')).toBe(true);
      expect(dag.nodes.has('B')).toBe(true);
      expect(dag.nodes.has('C')).toBe(true);
      expect(dag.edges).toHaveLength(2);
    });

    it('should build adjacency list correctly', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'A', to: 'C', type: 'call' },
        { from: 'B', to: 'C', type: 'import' },
      ];
      const dag = buildDAG(edges);
      expect(dag.adjacency.get('A')).toEqual(
        expect.arrayContaining(['B', 'C']),
      );
      expect(dag.adjacency.get('B')).toEqual(['C']);
      expect(dag.adjacency.get('C')).toEqual([]);
    });

    it('should handle empty edges', () => {
      const dag = buildDAG([]);
      expect(dag.nodes.size).toBe(0);
      expect(dag.edges).toHaveLength(0);
    });

    it('should deduplicate nodes from multiple edges', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'A', to: 'B', type: 'call' },
      ];
      const dag = buildDAG(edges);
      expect(dag.nodes.size).toBe(2);
      expect(dag.edges).toHaveLength(2);
      // adjacency may have duplicates for different edge types
      expect(dag.adjacency.get('A')).toEqual(['B', 'B']);
    });
  });

  describe('topologicalSort', () => {
    it('should return nodes in topological order', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'B', to: 'C', type: 'import' },
      ];
      const dag = buildDAG(edges);
      const sorted = topologicalSort(dag);
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'));
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('C'));
    });

    it('should handle diamond dependency', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'A', to: 'C', type: 'import' },
        { from: 'B', to: 'D', type: 'import' },
        { from: 'C', to: 'D', type: 'import' },
      ];
      const dag = buildDAG(edges);
      const sorted = topologicalSort(dag);
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'));
      expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('C'));
      expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('D'));
      expect(sorted.indexOf('C')).toBeLessThan(sorted.indexOf('D'));
    });

    it('should return empty array for empty DAG', () => {
      const dag = buildDAG([]);
      expect(topologicalSort(dag)).toEqual([]);
    });

    it('should return null when cycle exists', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'B', to: 'A', type: 'import' },
      ];
      const dag = buildDAG(edges);
      expect(topologicalSort(dag)).toBeNull();
    });
  });

  describe('detectCycles', () => {
    it('should return empty array for acyclic graph', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'B', to: 'C', type: 'import' },
      ];
      const dag = buildDAG(edges);
      expect(detectCycles(dag)).toHaveLength(0);
    });

    it('should detect a simple cycle', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'B', to: 'A', type: 'import' },
      ];
      const dag = buildDAG(edges);
      const cycles = detectCycles(dag);
      expect(cycles.length).toBeGreaterThan(0);
      // Cycle should contain both A and B
      const flat = cycles.flat();
      expect(flat).toContain('A');
      expect(flat).toContain('B');
    });

    it('should detect cycle in larger graph', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'B', to: 'C', type: 'import' },
        { from: 'C', to: 'A', type: 'import' },
      ];
      const dag = buildDAG(edges);
      const cycles = detectCycles(dag);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('getDirectDependencies', () => {
    it('should return direct dependencies of a node', () => {
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B', type: 'import' },
        { from: 'A', to: 'C', type: 'call' },
        { from: 'B', to: 'C', type: 'import' },
      ];
      const dag = buildDAG(edges);
      const deps = getDirectDependencies(dag, 'A');
      expect(deps).toContain('B');
      expect(deps).toContain('C');
      expect(deps).toHaveLength(2);
    });

    it('should return empty array for node with no dependencies', () => {
      const edges: DependencyEdge[] = [{ from: 'A', to: 'B', type: 'import' }];
      const dag = buildDAG(edges);
      expect(getDirectDependencies(dag, 'B')).toHaveLength(0);
    });

    it('should return empty array for non-existent node', () => {
      const dag = buildDAG([]);
      expect(getDirectDependencies(dag, 'X')).toHaveLength(0);
    });
  });
});
