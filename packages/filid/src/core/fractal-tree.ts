import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import type {
  CategoryType,
  FractalNode,
  FractalTree,
} from '../types/fractal.js';
import type { ScanOptions } from '../types/scan.js';
import { DEFAULT_SCAN_OPTIONS } from '../types/scan.js';

import { classifyNode } from './organ-classifier.js';

/** Input entry for buildFractalTree */
export interface NodeEntry {
  path: string;
  name: string;
  type: CategoryType;
  hasClaudeMd: boolean;
  hasSpecMd: boolean;
  hasIndex?: boolean;
  hasMain?: boolean;
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
    return { root: '', nodes: new Map(), depth: 0, totalNodes: 0 };
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
      hasIndex: e.hasIndex ?? false,
      hasMain: e.hasMain ?? false,
      depth: 0,
      metadata: {},
    });
  }

  // Step 2: Establish parent-child relationships and compute depth
  for (const e of sorted) {
    const parentPath = findParentPath(e.path, allPaths);
    if (parentPath === null) continue;

    const node = nodes.get(e.path)!;
    const parent = nodes.get(parentPath)!;
    node.parent = parentPath;
    node.depth = parent.depth + 1;

    if (e.type === 'organ') {
      parent.organs.push(e.path);
    } else {
      parent.children.push(e.path);
    }
  }

  // Root: shortest path among nodes with null parent
  const root =
    sorted.find((e) => nodes.get(e.path)!.parent === null)?.path ?? '';

  // Compute max depth
  let maxDepth = 0;
  for (const node of nodes.values()) {
    if (node.depth > maxDepth) {
      maxDepth = node.depth;
    }
  }

  return { root, nodes, depth: maxDepth, totalNodes: nodes.size };
}

/**
 * Find a node by path.
 */
export function findNode(
  tree: FractalTree,
  path: string,
): FractalNode | undefined {
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

/**
 * Return all fractal/pure-function nodes embedded inside organ directories
 * within the subtree rooted at `path`. Each node is returned at most once.
 *
 * Use this to detect fractal nodes that are unreachable via normal
 * children traversal because they sit inside organ boundaries.
 *
 * Algorithm (iterative BFS over organ boundaries):
 *  1. Enqueue all organ paths reachable from node.organs[]
 *  2. For each organ dequeued:
 *     a. Collect its fractal/pure-function children[] and their getDescendants()
 *     b. Enqueue nested organs from its organs[] (for deeper organ chains)
 *     c. Enqueue organs of each fractal child (organ-inside-fractal-inside-organ)
 *  3. A visited Set prevents duplicate collection and infinite loops
 */
export function getFractalsUnderOrgans(
  tree: FractalTree,
  path: string,
): FractalNode[] {
  const node = tree.nodes.get(path);
  if (!node) return [];

  const result: FractalNode[] = [];
  const seen = new Set<string>();
  const organQueue = [...node.organs];

  while (organQueue.length > 0) {
    const organPath = organQueue.shift()!;
    if (seen.has(organPath)) continue;
    seen.add(organPath);

    const organ = tree.nodes.get(organPath);
    if (!organ) continue;

    // fractal/pure-function children inside this organ
    for (const childPath of organ.children) {
      if (seen.has(childPath)) continue;
      const child = tree.nodes.get(childPath);
      if (!child) continue;

      // collect this fractal child
      seen.add(childPath);
      result.push(child);

      // collect its normal fractal descendants (via children[])
      for (const desc of getDescendants(tree, childPath)) {
        if (!seen.has(desc.path)) {
          seen.add(desc.path);
          result.push(desc);
        }
      }

      // also search organs inside this fractal child
      for (const nestedOrgan of child.organs) {
        if (!seen.has(nestedOrgan)) organQueue.push(nestedOrgan);
      }
    }

    // nested organs inside this organ (organ chain: organ > organ > fractal)
    for (const nestedOrgan of organ.organs) {
      if (!seen.has(nestedOrgan)) organQueue.push(nestedOrgan);
    }
  }

  return result;
}

/**
 * Determine if a relative path should be excluded based on ScanOptions.
 * Uses simple string prefix matching for exclude patterns.
 */
export function shouldExclude(relPath: string, options: ScanOptions): boolean {
  const excludePatterns = options.exclude ?? DEFAULT_SCAN_OPTIONS.exclude;
  for (const pattern of excludePatterns) {
    // Strip leading **/ for simple prefix matching
    const normalized = pattern.replace(/^\*\*\//, '');
    if (
      relPath === normalized ||
      relPath.startsWith(normalized + '/') ||
      relPath.includes('/' + normalized + '/') ||
      relPath.endsWith('/' + normalized)
    ) {
      return true;
    }
    // Handle exact glob like node_modules/**
    const base = normalized.replace(/\/\*\*$/, '');
    if (relPath === base || relPath.startsWith(base + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * Scan a project directory and build a FractalTree.
 * Uses fast-glob to discover directories, then classifies each one.
 *
 * @param rootPath - Absolute path to project root
 * @param options - Scan options (exclude patterns, maxDepth)
 * @returns Completed FractalTree
 */
export async function scanProject(
  rootPath: string,
  options?: ScanOptions,
): Promise<FractalTree> {
  const { glob } = await import('fast-glob');
  const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const maxDepth = opts.maxDepth;

  // Discover all directories
  const dirPaths: string[] = await glob('**/', {
    cwd: rootPath,
    deep: maxDepth,
    ignore: opts.exclude,
    followSymbolicLinks: opts.followSymlinks,
    onlyDirectories: true,
    dot: false,
  });

  // Build DirEntry list — include the root itself
  const allDirs: string[] = [rootPath];
  for (const rel of dirPaths) {
    // Remove trailing slash
    const clean = rel.replace(/\/$/, '');
    const absPath = join(rootPath, clean);
    const relForExclude = clean;
    if (!shouldExclude(relForExclude, opts)) {
      allDirs.push(absPath);
    }
  }

  // For each directory, collect metadata needed for classification
  const dirSet = new Set(allDirs);

  const nodeEntries: NodeEntry[] = [];

  for (const absPath of allDirs) {
    const rel = relative(rootPath, absPath);
    const depth = rel === '' ? 0 : rel.split('/').length;

    if (depth > maxDepth) continue;

    const name =
      absPath === rootPath
        ? (rootPath.split('/').pop() ?? '')
        : (absPath.split('/').pop() ?? '');
    const hasClaudeMd = existsSync(join(absPath, 'CLAUDE.md'));
    const hasSpecMd = existsSync(join(absPath, 'SPEC.md'));
    const hasIndex =
      existsSync(join(absPath, 'index.ts')) ||
      existsSync(join(absPath, 'index.tsx')) ||
      existsSync(join(absPath, 'index.js')) ||
      existsSync(join(absPath, 'index.mjs')) ||
      existsSync(join(absPath, 'index.cjs'));
    const hasMain =
      existsSync(join(absPath, 'main.ts')) ||
      existsSync(join(absPath, 'main.js'));

    // Check if this directory has fractal children (child dirs classified as fractal)
    // We use a two-pass approach: first collect all directories, then classify
    // For now, check if any immediate subdirectory exists in our set
    const hasFractalChildren = allDirs.some(
      (d) =>
        d !== absPath &&
        d.startsWith(absPath + '/') &&
        d.replace(absPath + '/', '').indexOf('/') === -1 &&
        dirSet.has(d),
    );

    // isLeafDirectory: no subdirectories at all
    const isLeafDirectory = !allDirs.some(
      (d) =>
        d !== absPath &&
        d.startsWith(absPath + '/') &&
        d.replace(absPath + '/', '').indexOf('/') === -1,
    );

    const type = classifyNode({
      dirName: name,
      hasClaudeMd,
      hasSpecMd,
      hasFractalChildren,
      isLeafDirectory,
      hasIndex, // NEW: index 파일 여부 전달
    });

    nodeEntries.push({
      path: absPath,
      name,
      type,
      hasClaudeMd,
      hasSpecMd,
      hasIndex,
      hasMain,
    });
  }

  // Post-correction: bottom-up으로 실제 fractal 자손 기반 타입 재확정
  // 목적: 단일 패스에서 잘못 계산된 hasFractalChildren을 수정
  const typeMap = new Map<string, string>(
    nodeEntries.map((e) => [e.path, e.type]),
  );

  // 깊이 역순 정렬 (deepest first = bottom-up)
  const sortedByDepth = [...nodeEntries].sort(
    (a, b) => b.path.split('/').length - a.path.split('/').length,
  );

  for (const entry of sortedByDepth) {
    const immediateChildren = nodeEntries.filter(
      (other) =>
        other.path !== entry.path &&
        other.path.startsWith(entry.path + '/') &&
        other.path.replace(entry.path + '/', '').indexOf('/') === -1,
    );

    const hasFractalChildrenActual = immediateChildren.some(
      (child) =>
        typeMap.get(child.path) === 'fractal' ||
        typeMap.get(child.path) === 'pure-function',
    );
    const isLeafActual = immediateChildren.length === 0;

    const newType = classifyNode({
      dirName: entry.name,
      hasClaudeMd: entry.hasClaudeMd,
      hasSpecMd: entry.hasSpecMd,
      hasFractalChildren: hasFractalChildrenActual,
      isLeafDirectory: isLeafActual,
      hasIndex: entry.hasIndex ?? false,
    });

    if (newType !== entry.type) {
      entry.type = newType;
      typeMap.set(entry.path, newType);
    }
  }

  return buildFractalTree(nodeEntries);
}
