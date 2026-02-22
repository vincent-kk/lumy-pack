/**
 * TypeScript/JavaScript source parser using TypeScript Compiler API
 */
import { readFileSync } from 'node:fs';

import ts from 'typescript';

/**
 * Parse source code string into a TypeScript SourceFile AST.
 * @param source - The source code to parse
 * @param filePath - Virtual file path (determines JS vs TS parsing)
 */
export function parseSource(
  source: string,
  filePath: string = 'anonymous.ts',
): ts.SourceFile {
  const scriptKind =
    filePath.endsWith('.js') || filePath.endsWith('.mjs')
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;

  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );
}

/**
 * Parse a file from disk into a TypeScript SourceFile AST.
 * @param filePath - Absolute path to the file
 * @throws Error if the file does not exist
 */
export function parseFile(filePath: string): ts.SourceFile {
  const source = readFileSync(filePath, 'utf-8');
  return parseSource(source, filePath);
}
