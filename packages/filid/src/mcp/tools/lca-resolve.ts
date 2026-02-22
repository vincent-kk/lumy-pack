import * as path from 'node:path';
import { scanProject } from '../../core/fractal-tree.js';
import { findLCA } from '../../core/lca-calculator.js';
import type { CategoryType } from '../../types/fractal.js';

export interface LcaResolveInput {
  path: string;
  moduleA: string;
  moduleB: string;
}

export interface LcaResolveResult {
  lca: string;
  lcaCategory: CategoryType;
  lcaDepth: number;
  distanceA: number;
  distanceB: number;
  suggestedPlacement: string;
  explanation: string;
}

function pathDepth(p: string): number {
  return p.split('/').filter((s) => s.length > 0).length;
}

function distanceBetween(from: string, to: string): number {
  const fromDepth = pathDepth(from);
  const toDepth = pathDepth(to);
  return Math.abs(fromDepth - toDepth);
}

/**
 * Handle lca-resolve MCP tool calls.
 *
 * Calculates the Lowest Common Ancestor (LCA) of two modules in the
 * fractal tree and suggests the optimal placement path for a shared
 * dependency between them.
 */
export async function handleLcaResolve(args: unknown): Promise<LcaResolveResult> {
  const input = args as LcaResolveInput;

  if (!input.path || !input.moduleA || !input.moduleB) {
    throw new Error('path, moduleA, and moduleB are required');
  }

  const tree = await scanProject(input.path);

  // Resolve module paths (relative → absolute)
  const absA = path.isAbsolute(input.moduleA)
    ? input.moduleA
    : path.join(input.path, input.moduleA);
  const absB = path.isAbsolute(input.moduleB)
    ? input.moduleB
    : path.join(input.path, input.moduleB);

  if (!tree.nodes.has(absA)) {
    throw new Error(`moduleA not found in fractal tree: ${absA}`);
  }
  if (!tree.nodes.has(absB)) {
    throw new Error(`moduleB not found in fractal tree: ${absB}`);
  }

  const lcaNode = findLCA(tree, absA, absB);
  if (!lcaNode) {
    throw new Error(`Could not determine LCA for ${input.moduleA} and ${input.moduleB}`);
  }

  const distanceA = distanceBetween(absA, lcaNode.path);
  const distanceB = distanceBetween(absB, lcaNode.path);

  // Suggest placement: shared/ under LCA if fractal, else src/shared
  let suggestedPlacement: string;
  let explanation: string;

  if (lcaNode.path === tree.root) {
    suggestedPlacement = path.join(input.path, 'src', 'shared');
    explanation =
      'LCA is the project root. Place shared dependency under src/shared/ or src/common/.';
  } else if (lcaNode.type === 'fractal') {
    suggestedPlacement = path.join(lcaNode.path, 'shared');
    explanation = `LCA is a fractal node at depth ${lcaNode.depth}. Place shared dependency under ${path.relative(input.path, lcaNode.path)}/shared/.`;
  } else {
    suggestedPlacement = path.join(lcaNode.path);
    explanation = `LCA is a ${lcaNode.type} node. Co-locate the shared dependency directly under ${path.relative(input.path, lcaNode.path)}.`;
  }

  return {
    lca: lcaNode.path,
    lcaCategory: lcaNode.type as CategoryType,
    lcaDepth: lcaNode.depth,
    distanceA,
    distanceB,
    suggestedPlacement,
    explanation,
  };
}
