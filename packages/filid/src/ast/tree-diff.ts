/**
 * Semantic AST diff — compares two source code versions and identifies
 * added, removed, or modified top-level declarations while ignoring
 * formatting-only changes. Uses @babel/parser.
 */
import type { TreeDiffChange, TreeDiffResult } from '../types/ast.js';

import { parseSource } from './parser.js';

interface DeclSignature {
  name: string;
  kind: string;
  normalized: string;
  line: number;
}

function extractDeclarations(source: string): DeclSignature[] {
  const ast = parseSource(source);
  const decls: DeclSignature[] = [];

  for (const stmt of ast.program.body) {
    const line = stmt.loc?.start.line ?? 0;
    const normalized = source
      .slice(stmt.start ?? 0, stmt.end ?? 0)
      .replace(/\s+/g, '');

    const node =
      stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (!node) continue;

    if (node.type === 'FunctionDeclaration' && node.id) {
      decls.push({ name: node.id.name, kind: 'function', normalized, line });
    } else if (node.type === 'ClassDeclaration' && node.id) {
      decls.push({ name: node.id.name, kind: 'class', normalized, line });
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id?.type === 'Identifier') {
          decls.push({ name: d.id.name, kind: 'variable', normalized, line });
        }
      }
    } else if (node.type === 'TSInterfaceDeclaration') {
      decls.push({ name: node.id.name, kind: 'interface', normalized, line });
    } else if (node.type === 'TSTypeAliasDeclaration') {
      decls.push({ name: node.id.name, kind: 'type', normalized, line });
    }
  }

  return decls;
}

export function computeTreeDiff(
  oldSource: string,
  newSource: string,
  _filePath = 'diff.ts',
): TreeDiffResult {
  const oldMap = new Map(
    extractDeclarations(oldSource).map((d) => [d.name, d]),
  );
  const newMap = new Map(
    extractDeclarations(newSource).map((d) => [d.name, d]),
  );

  const changes: TreeDiffChange[] = [];

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

  return {
    changes,
    hasSemanticChanges: changes.length > 0,
    formattingOnlyChanges:
      changes.length === 0 && oldSource.trim() !== newSource.trim() ? 1 : 0,
  };
}
