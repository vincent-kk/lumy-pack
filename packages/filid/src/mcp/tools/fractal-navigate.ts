import { buildFractalTree, findNode, type NodeEntry } from '../../core/fractal-tree.js';
import { classifyNode, type ClassifyInput } from '../../core/organ-classifier.js';
import type { FractalTree } from '../../types/fractal.js';

/** Input for fractal-navigate tool */
export interface FractalNavigateInput {
  /** Action to perform */
  action: 'classify' | 'sibling-list' | 'tree';
  /** Target path */
  path: string;
  /** Directory/file entries for tree construction */
  entries: NodeEntry[];
}

/** Output of fractal-navigate tool */
export interface FractalNavigateOutput {
  /** Node classification (for 'classify' action) */
  classification?: string;
  /** Sibling nodes (for 'sibling-list' action) */
  siblings?: Array<{ name: string; path: string; type: string }>;
  /** Fractal tree (for 'tree' action) */
  tree?: FractalTree;
  /** Error message if action failed */
  error?: string;
}

/**
 * Handle fractal-navigate MCP tool calls.
 *
 * Actions:
 * - classify: Determine if a path is fractal, organ, or pure-function
 * - sibling-list: List sibling directories of a given path
 * - tree: Build the full fractal tree from entries
 */
export function handleFractalNavigate(input: FractalNavigateInput): FractalNavigateOutput {
  switch (input.action) {
    case 'classify':
      return handleClassify(input);
    case 'sibling-list':
      return handleSiblingList(input);
    case 'tree':
      return handleTree(input);
    default:
      return { error: `Unknown action: ${input.action}` };
  }
}

function handleClassify(input: FractalNavigateInput): FractalNavigateOutput {
  // First check if the entry already has a known type in the provided entries
  const entry = input.entries.find((e) => e.path === input.path);
  if (entry && entry.type !== 'directory' as string) {
    return { classification: entry.type };
  }

  const dirName = input.path.split('/').filter((s) => s.length > 0).pop() ?? '';
  const hasClaudeMd = entry?.hasClaudeMd ?? false;
  const hasSpecMd = entry?.hasSpecMd ?? false;

  const classifyInput: ClassifyInput = {
    dirName,
    hasClaudeMd,
    hasSpecMd,
    hasFractalChildren: false,
    isLeafDirectory: true,
  };
  const result = classifyNode(classifyInput);
  return { classification: result };
}

function handleSiblingList(input: FractalNavigateInput): FractalNavigateOutput {
  const tree = buildFractalTree(input.entries);

  // Find parent path
  const lastSlash = input.path.lastIndexOf('/');
  const parentPath = lastSlash > 0 ? input.path.slice(0, lastSlash) : '';
  const parentNode = findNode(tree, parentPath);

  if (!parentNode) {
    return { siblings: [] };
  }

  // children and organs are string[] (paths), resolve them to node info
  const allChildPaths = [...parentNode.children, ...parentNode.organs];
  const siblings = allChildPaths
    .filter((p) => p !== input.path)
    .map((p) => {
      const node = tree.nodes.get(p);
      return node
        ? { name: node.name, path: node.path, type: node.type }
        : { name: p.split('/').pop() ?? '', path: p, type: 'directory' };
    });

  return { siblings };
}

function handleTree(input: FractalNavigateInput): FractalNavigateOutput {
  const tree = buildFractalTree(input.entries);
  return { tree };
}
