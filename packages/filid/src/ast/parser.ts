/**
 * Shared AST utilities using @babel/parser (TypeScript-capable, pure JS, bundleable).
 */
import { readFileSync } from 'node:fs';

import { parse } from '@babel/parser';

export function parseSource(source: string) {
  return parse(source, {
    sourceType: 'module',
    plugins: ['typescript'],
    errorRecovery: true,
  });
}

export function parseFile(filePath: string) {
  const source = readFileSync(filePath, 'utf-8');
  return parseSource(source);
}

/** Recursive AST node visitor */
export function walk(node: any, fn: (n: any) => void): void {
  if (!node || typeof node !== 'object') return;
  if (node.type) fn(node);
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) walk(item, fn);
    } else if (val && typeof val === 'object' && val.type) {
      walk(val, fn);
    }
  }
}
