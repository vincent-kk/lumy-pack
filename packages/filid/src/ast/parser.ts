/**
 * Shared AST utilities using @ast-grep/napi (tree-sitter backend).
 * Provides source parsing and tree traversal for all analysis modules.
 */
import { readFileSync } from 'node:fs';

import type { SgNode } from '@ast-grep/napi';

import {
  EXT_TO_LANG,
  getSgLoadError,
  getSgModule,
  toLangEnum,
} from './ast-grep-shared.js';

/**
 * Parse TypeScript/JavaScript source into an AST root node.
 * Throws if @ast-grep/napi is not available.
 */
export async function parseSource(
  source: string,
  filePath = 'anonymous.ts',
): Promise<SgNode> {
  const sg = await getSgModule();
  if (!sg) {
    throw new Error(
      `@ast-grep/napi is not available. Install it with: npm install -g @ast-grep/napi` +
        (getSgLoadError() ? ` (${getSgLoadError()})` : ''),
    );
  }

  // Detect language from file extension, default to typescript
  const ext = filePath.includes('.') ? '.' + filePath.split('.').pop() : '.ts';
  const langStr = EXT_TO_LANG[ext] ?? 'typescript';
  const lang = toLangEnum(sg, langStr);

  return sg.parse(lang, source).root();
}

/**
 * Parse a file from disk into an AST root node.
 */
export async function parseFile(filePath: string): Promise<SgNode> {
  const source = readFileSync(filePath, 'utf-8');
  return parseSource(source, filePath);
}

/**
 * Recursive AST node visitor using tree-sitter children.
 */
export function walk(node: SgNode, fn: (n: SgNode) => void): void {
  if (!node) return;
  fn(node);
  const children = node.children?.();
  if (children) {
    for (const child of children) {
      walk(child, fn);
    }
  }
}
