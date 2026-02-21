import type { NodeType, FractalNode, FractalTree } from '../types/fractal.js';

/** Input entry for buildFractalTree */
export interface NodeEntry {
  path: string;
  name: string;
  type: NodeType;
  hasClaudeMd: boolean;
  hasSpecMd: boolean;
}

/**
 * Find the closest parent path.
 * Returns the deepest ancestor path among entries.
 */
function findParentPath(path: string, allPaths: string[]): string | null {
  let bestParent: string | null = null;
  let bestLen = 0;

  for (const candidate of allPaths) {
    if (candidate === path) continue;
    if (path.startsWith(candidate + '/') && candidate.length > bestLen) {
      bestParent = candidate;
      bestLen = candidate.length;
    }
  }

  return bestParent;
}

/**
 * Build a FractalTree from a NodeEntry array.
 * Automatically infers parent-child/organ relationships from paths.
 */
export function buildFractalTree(entries: NodeEntry[]): FractalTree {
  if (entries.length === 0) {
    return { root: '', nodes: new Map() };
  }

  // Sort by path length ascending (parents first)
  const sorted = [...entries].sort((a, b) => a.path.length - b.path.length);
  const allPaths = sorted.map((e) => e.path);

  const nodes = new Map<string, FractalNode>();

  // Step 1: Create all nodes
  for (const e of sorted) {
    nodes.set(e.path, {
      path: e.path,
      name: e.name,
      type: e.type,
      parent: null,
      children: [],
      organs: [],
      hasClaudeMd: e.hasClaudeMd,
      hasSpecMd: e.hasSpecMd,
    });
  }

  // Step 2: Establish parent-child relationships
  for (const e of sorted) {
    const parentPath = findParentPath(e.path, allPaths);
    if (parentPath === null) continue;

    const node = nodes.get(e.path)!;
    const parent = nodes.get(parentPath)!;
    node.parent = parentPath;

    if (e.type === 'organ') {
      parent.organs.push(e.path);
    } else {
      parent.children.push(e.path);
    }
  }

  // Root: shortest path among nodes with null parent
  const root = sorted.find((e) => nodes.get(e.path)!.parent === null)?.path ?? '';

  return { root, nodes };
}

/**
 * Find a node by path.
 */
export function findNode(tree: FractalTree, path: string): FractalNode | undefined {
  return tree.nodes.get(path);
}

/**
 * Return ancestor nodes from the given path to the root (excluding self).
 * Order: leaf → root.
 */
export function getAncestors(tree: FractalTree, path: string): FractalNode[] {
  const ancestors: FractalNode[] = [];
  const node = tree.nodes.get(path);
  if (!node) return ancestors;

  let current = node.parent;
  while (current !== null) {
    const ancestor = tree.nodes.get(current);
    if (!ancestor) break;
    ancestors.push(ancestor);
    current = ancestor.parent;
  }

  return ancestors;
}

/**
 * Return all fractal/pure-function descendants of the given path (excludes organs).
 */
export function getDescendants(tree: FractalTree, path: string): FractalNode[] {
  const node = tree.nodes.get(path);
  if (!node) return [];

  const result: FractalNode[] = [];
  const queue = [...node.children];

  while (queue.length > 0) {
    const childPath = queue.shift()!;
    const child = tree.nodes.get(childPath);
    if (!child) continue;
    result.push(child);
    queue.push(...child.children);
  }

  return result;
}
