/**
 * Semantic AST diff — compares two source code versions and identifies
 * added, removed, or modified top-level declarations while ignoring
 * formatting-only changes. Uses @ast-grep/napi.
 */
import type { SgNode } from '@ast-grep/napi';

import type { TreeDiffChange, TreeDiffResult } from '../types/ast.js';

import { parseSource } from './parser.js';

interface DeclSignature {
  name: string;
  kind: string;
  normalized: string;
  line: number;
}

function getNameFromNode(node: SgNode, nameKind: string): string | null {
  const nameNode = node.children().find((c: SgNode) => c.kind() === nameKind);
  return nameNode ? nameNode.text() : null;
}

async function extractDeclarations(source: string): Promise<DeclSignature[]> {
  const root = await parseSource(source);
  const decls: DeclSignature[] = [];
  const rootChildren = root.children();

  for (const stmt of rootChildren) {
    const kind = stmt.kind();
    const line = stmt.range().start.line + 1;
    const normalized = stmt.text().replace(/\s+/g, '');

    if (kind === 'function_declaration') {
      const name = getNameFromNode(stmt, 'identifier');
      if (name) decls.push({ name, kind: 'function', normalized, line });
    } else if (kind === 'class_declaration') {
      const name = getNameFromNode(stmt, 'type_identifier');
      if (name) decls.push({ name, kind: 'class', normalized, line });
    } else if (
      kind === 'lexical_declaration' ||
      kind === 'variable_declaration'
    ) {
      for (const d of stmt.children()) {
        if (d.kind() === 'variable_declarator') {
          const name = getNameFromNode(d, 'identifier');
          if (name) decls.push({ name, kind: 'variable', normalized, line });
        }
      }
    } else if (kind === 'interface_declaration') {
      const name = getNameFromNode(stmt, 'type_identifier');
      if (name) decls.push({ name, kind: 'interface', normalized, line });
    } else if (kind === 'type_alias_declaration') {
      const name = getNameFromNode(stmt, 'type_identifier');
      if (name) decls.push({ name, kind: 'type', normalized, line });
    } else if (kind === 'export_statement') {
      // Unwrap export to get the actual declaration
      const children = stmt.children();
      for (const child of children) {
        const ck = child.kind();
        const childNorm = stmt.text().replace(/\s+/g, '');

        if (ck === 'function_declaration') {
          const name = getNameFromNode(child, 'identifier');
          if (name)
            decls.push({
              name,
              kind: 'function',
              normalized: childNorm,
              line,
            });
        } else if (ck === 'class_declaration') {
          const name = getNameFromNode(child, 'type_identifier');
          if (name)
            decls.push({ name, kind: 'class', normalized: childNorm, line });
        } else if (
          ck === 'lexical_declaration' ||
          ck === 'variable_declaration'
        ) {
          for (const d of child.children()) {
            if (d.kind() === 'variable_declarator') {
              const name = getNameFromNode(d, 'identifier');
              if (name)
                decls.push({
                  name,
                  kind: 'variable',
                  normalized: childNorm,
                  line,
                });
            }
          }
        } else if (ck === 'interface_declaration') {
          const name = getNameFromNode(child, 'type_identifier');
          if (name)
            decls.push({
              name,
              kind: 'interface',
              normalized: childNorm,
              line,
            });
        } else if (ck === 'type_alias_declaration') {
          const name = getNameFromNode(child, 'type_identifier');
          if (name)
            decls.push({ name, kind: 'type', normalized: childNorm, line });
        }
      }
    }
  }

  return decls;
}

export async function computeTreeDiff(
  oldSource: string,
  newSource: string,
  _filePath = 'diff.ts',
): Promise<TreeDiffResult> {
  const oldMap = new Map(
    (await extractDeclarations(oldSource)).map((d) => [d.name, d]),
  );
  const newMap = new Map(
    (await extractDeclarations(newSource)).map((d) => [d.name, d]),
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
