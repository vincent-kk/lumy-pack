import type { DependencyDAG, DependencyEdge } from '../types/fractal.js';

/**
 * Build a DAG (Directed Acyclic Graph) from an edge array.
 * Returns node set, edge array, and adjacency list.
 */
export function buildDAG(edges: DependencyEdge[]): DependencyDAG {
  const nodes = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);

    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    adjacency.get(edge.from)!.push(edge.to);

    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, []);
    }
  }

  return { nodes, edges, adjacency };
}

/**
 * Perform topological sort using Kahn's algorithm.
 * Returns null if a cycle exists.
 */
export function topologicalSort(dag: DependencyDAG): string[] | null {
  if (dag.nodes.size === 0) return [];

  // Calculate in-degree
  const inDegree = new Map<string, number>();
  for (const node of dag.nodes) {
    inDegree.set(node, 0);
  }
  for (const [, targets] of dag.adjacency) {
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Initialize queue with zero in-degree nodes
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) queue.push(node);
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    const neighbors = dag.adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes were visited, a cycle exists
  if (result.length !== dag.nodes.size) {
    return null;
  }

  return result;
}

/**
 * Detect cycles using DFS.
 * Returns array of cycle paths. Empty array if no cycles.
 */
export function detectCycles(dag: DependencyDAG): string[][] {
  const WHITE = 0; // Unvisited
  const GRAY = 1; // In progress (on stack)
  const BLACK = 2; // Completed

  const color = new Map<string, number>();
  for (const node of dag.nodes) {
    color.set(node, WHITE);
  }

  const cycles: string[][] = [];
  const path: string[] = [];

  function dfs(node: string): void {
    color.set(node, GRAY);
    path.push(node);

    const neighbors = dag.adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      const c = color.get(neighbor);
      if (c === GRAY) {
        // Cycle found: slice from neighbor to current in path
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart));
      } else if (c === WHITE) {
        dfs(neighbor);
      }
    }

    path.pop();
    color.set(node, BLACK);
  }

  for (const node of dag.nodes) {
    if (color.get(node) === WHITE) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Return direct dependencies (outgoing edges) of a node.
 * Duplicates are removed.
 */
export function getDirectDependencies(
  dag: DependencyDAG,
  node: string,
): string[] {
  const deps = dag.adjacency.get(node);
  if (!deps) return [];
  return [...new Set(deps)];
}
