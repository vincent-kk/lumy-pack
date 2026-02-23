/**
 * Extract import/export/call dependencies from TypeScript/JavaScript source
 * using @ast-grep/napi.
 */
import type { SgNode } from '@ast-grep/napi';

import type {
  CallInfo,
  DependencyInfo,
  ExportInfo,
  ImportInfo,
} from '../types/ast.js';

import { parseSource, walk } from './parser.js';

function getCallee(node: SgNode): string | null {
  const kind = node.kind();
  if (kind === 'identifier') return node.text();
  if (kind === 'member_expression') {
    const children = node.children();
    const obj = children[0];
    const prop = children.find(
      (c: SgNode) => c.kind() === 'property_identifier',
    );
    if (obj && prop) {
      const objName = getCallee(obj);
      return objName ? `${objName}.${prop.text()}` : null;
    }
  }
  return null;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"]|['"]$/g, '');
}

export async function extractDependencies(
  source: string,
  filePath = 'anonymous.ts',
): Promise<DependencyInfo> {
  const root = await parseSource(source);
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const calls: CallInfo[] = [];

  const rootChildren = root.children();

  for (const stmt of rootChildren) {
    const kind = stmt.kind();
    const line = stmt.range().start.line + 1; // tree-sitter is 0-based

    // import ... from '...'
    if (kind === 'import_statement') {
      const text = stmt.text();
      const isTypeOnly = text.startsWith('import type');
      const specifiers: string[] = [];

      // Find import specifiers
      walk(stmt, (node: SgNode) => {
        if (node.kind() === 'import_specifier') {
          const nameNode = node
            .children()
            .find((c: SgNode) => c.kind() === 'identifier');
          if (nameNode) specifiers.push(nameNode.text());
        }
        // Default import
        if (node.kind() === 'identifier' && node !== stmt) {
          const parent = stmt.children();
          const importClause = parent.find(
            (c: SgNode) => c.kind() === 'import_clause',
          );
          if (importClause) {
            const defaultImport = importClause
              .children()
              .find((c: SgNode) => c.kind() === 'identifier');
            if (defaultImport && defaultImport.text() === node.text()) {
              // Avoid duplicates
              if (!specifiers.includes(node.text())) {
                specifiers.push(node.text());
              }
            }
          }
        }
        // Namespace import: import * as foo
        if (node.kind() === 'namespace_import') {
          const nameNode = node
            .children()
            .find((c: SgNode) => c.kind() === 'identifier');
          if (nameNode && !specifiers.includes(nameNode.text())) {
            specifiers.push(nameNode.text());
          }
        }
      });

      // Find source string
      const sourceNode = stmt
        .children()
        .find((c: SgNode) => c.kind() === 'string');
      const sourceValue = sourceNode ? stripQuotes(sourceNode.text()) : '';

      imports.push({ source: sourceValue, specifiers, isTypeOnly, line });
    }

    // export ... declarations
    if (kind === 'export_statement') {
      const text = stmt.text();
      const isTypeOnly = text.startsWith('export type');

      // export { name1, name2 }
      const exportClause = stmt
        .children()
        .find((c: SgNode) => c.kind() === 'export_clause');
      if (exportClause) {
        for (const spec of exportClause.children()) {
          if (spec.kind() === 'export_specifier') {
            const nameNode = spec
              .children()
              .find((c: SgNode) => c.kind() === 'identifier');
            if (nameNode) {
              exports.push({
                name: nameNode.text(),
                isTypeOnly,
                isDefault: false,
                line,
              });
            }
          }
        }
      }

      // export function/class/const/type/interface ...
      const children = stmt.children();

      const funcDecl = children.find(
        (c: SgNode) => c.kind() === 'function_declaration',
      );
      if (funcDecl) {
        const nameNode = funcDecl
          .children()
          .find((c: SgNode) => c.kind() === 'identifier');
        if (nameNode) {
          exports.push({
            name: nameNode.text(),
            isTypeOnly: false,
            isDefault: false,
            line,
          });
        }
      }

      const classDecl = children.find(
        (c: SgNode) => c.kind() === 'class_declaration',
      );
      if (classDecl) {
        const nameNode = classDecl
          .children()
          .find((c: SgNode) => c.kind() === 'type_identifier');
        if (nameNode) {
          exports.push({
            name: nameNode.text(),
            isTypeOnly: false,
            isDefault: false,
            line,
          });
        }
      }

      const lexDecl = children.find(
        (c: SgNode) =>
          c.kind() === 'lexical_declaration' ||
          c.kind() === 'variable_declaration',
      );
      if (lexDecl) {
        for (const d of lexDecl.children()) {
          if (d.kind() === 'variable_declarator') {
            const nameNode = d
              .children()
              .find((c: SgNode) => c.kind() === 'identifier');
            if (nameNode) {
              exports.push({
                name: nameNode.text(),
                isTypeOnly: false,
                isDefault: false,
                line,
              });
            }
          }
        }
      }

      const typeAlias = children.find(
        (c: SgNode) => c.kind() === 'type_alias_declaration',
      );
      if (typeAlias) {
        const nameNode = typeAlias
          .children()
          .find((c: SgNode) => c.kind() === 'type_identifier');
        if (nameNode) {
          exports.push({
            name: nameNode.text(),
            isTypeOnly: true,
            isDefault: false,
            line,
          });
        }
      }

      const interfaceDecl = children.find(
        (c: SgNode) => c.kind() === 'interface_declaration',
      );
      if (interfaceDecl) {
        const nameNode = interfaceDecl
          .children()
          .find((c: SgNode) => c.kind() === 'type_identifier');
        if (nameNode) {
          exports.push({
            name: nameNode.text(),
            isTypeOnly: true,
            isDefault: false,
            line,
          });
        }
      }

      // export default ...
      if (text.includes('export default')) {
        const funcD = children.find(
          (c: SgNode) => c.kind() === 'function_declaration',
        );
        const classD = children.find(
          (c: SgNode) => c.kind() === 'class_declaration',
        );
        const name = funcD
          ? (funcD
              .children()
              .find((c: SgNode) => c.kind() === 'identifier')
              ?.text() ?? 'default')
          : classD
            ? (classD
                .children()
                .find((c: SgNode) => c.kind() === 'type_identifier')
                ?.text() ?? 'default')
            : 'default';
        exports.push({ name, isTypeOnly: false, isDefault: true, line });
      }
    }
  }

  // Call expressions — walk entire AST
  walk(root, (node: SgNode) => {
    if (node.kind() === 'call_expression') {
      const funcChild = node.children()[0];
      if (funcChild) {
        const callee = getCallee(funcChild);
        if (callee) {
          calls.push({
            callee,
            line: node.range().start.line + 1,
          });
        }
      }
    }
  });

  return { filePath, imports, exports, calls };
}
