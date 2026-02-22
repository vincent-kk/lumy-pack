/**
 * Semantic AST diff — compares two source code versions and identifies
 * added, removed, or modified top-level declarations while ignoring
 * formatting-only changes.
 */
import ts from 'typescript';

import type { TreeDiffChange, TreeDiffResult } from '../types/ast.js';

import { parseSource } from './parser.js';

interface DeclSignature {
  name: string;
  kind: string;
  /** Normalized source text (whitespace-collapsed) for semantic comparison */
  normalized: string;
  line: number;
}

/**
 * Compute a semantic diff between old and new source code.
 * Only considers top-level declarations (functions, classes, variables, interfaces, types).
 * Formatting-only changes (whitespace, semicolons) are tracked but not reported as semantic.
 */
export function computeTreeDiff(
  oldSource: string,
  newSource: string,
  filePath: string = 'diff.ts',
): TreeDiffResult {
  const oldDecls = extractDeclarations(oldSource, filePath);
  const newDecls = extractDeclarations(newSource, filePath);

  const oldMap = new Map<string, DeclSignature>();
  for (const d of oldDecls) oldMap.set(d.name, d);

  const newMap = new Map<string, DeclSignature>();
  for (const d of newDecls) newMap.set(d.name, d);

  const changes: TreeDiffChange[] = [];
  let formattingOnlyChanges = 0;

  // Detect removed and modified
  for (const [name, oldDecl] of oldMap) {
    const newDecl = newMap.get(name);
    if (!newDecl) {
      changes.push({
        type: 'removed',
        kind: oldDecl.kind,
        name,
        oldLine: oldDecl.line,
      });
    } else if (oldDecl.normalized !== newDecl.normalized) {
      changes.push({
        type: 'modified',
        kind: oldDecl.kind,
        name,
        oldLine: oldDecl.line,
        newLine: newDecl.line,
      });
    }
  }

  // Detect added
  for (const [name, newDecl] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        type: 'added',
        kind: newDecl.kind,
        name,
        newLine: newDecl.line,
      });
    }
  }

  // Count formatting-only: same declarations but raw text differs
  if (changes.length === 0 && oldSource.trim() !== newSource.trim()) {
    formattingOnlyChanges = 1;
  }

  return {
    changes,
    hasSemanticChanges: changes.length > 0,
    formattingOnlyChanges,
  };
}

/**
 * Extract top-level declaration signatures from source code.
 */
function extractDeclarations(
  source: string,
  filePath: string,
): DeclSignature[] {
  const sourceFile = parseSource(source, filePath);
  const decls: DeclSignature[] = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      decls.push({
        name: stmt.name.text,
        kind: 'function',
        normalized: normalize(stmt, sourceFile),
        line:
          sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
      });
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      decls.push({
        name: stmt.name.text,
        kind: 'class',
        normalized: normalize(stmt, sourceFile),
        line:
          sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
      });
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          decls.push({
            name: decl.name.text,
            kind: 'variable',
            normalized: normalize(decl, sourceFile),
            line:
              sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line +
              1,
          });
        }
      }
    } else if (ts.isInterfaceDeclaration(stmt)) {
      decls.push({
        name: stmt.name.text,
        kind: 'interface',
        normalized: normalize(stmt, sourceFile),
        line:
          sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
      });
    } else if (ts.isTypeAliasDeclaration(stmt)) {
      decls.push({
        name: stmt.name.text,
        kind: 'type',
        normalized: normalize(stmt, sourceFile),
        line:
          sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
      });
    }
  }

  return decls;
}

/**
 * Normalize a node's text by stripping all whitespace for semantic comparison.
 * This ensures formatting-only changes (spaces, newlines, indentation) are ignored.
 */
function normalize(node: ts.Node, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).replace(/\s+/g, '');
}
