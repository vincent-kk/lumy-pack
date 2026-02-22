/**
 * Extract import/export/call dependencies from TypeScript/JavaScript source
 * using @babel/parser.
 */
import type {
  CallInfo,
  DependencyInfo,
  ExportInfo,
  ImportInfo,
} from '../types/ast.js';

import { parseSource, walk } from './parser.js';

function getCallee(node: any): string | null {
  if (node.type === 'Identifier') return node.name;
  if (
    node.type === 'MemberExpression' &&
    node.property?.type === 'Identifier'
  ) {
    const obj = getCallee(node.object);
    return obj ? `${obj}.${node.property.name}` : null;
  }
  return null;
}

export function extractDependencies(
  source: string,
  filePath = 'anonymous.ts',
): DependencyInfo {
  const ast = parseSource(source);
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const calls: CallInfo[] = [];

  for (const stmt of ast.program.body) {
    // import ... from '...'
    if (stmt.type === 'ImportDeclaration') {
      const isTypeOnly = stmt.importKind === 'type';
      const specifiers: string[] = [];
      for (const s of stmt.specifiers) {
        if (s.local?.name) specifiers.push(s.local.name);
      }
      imports.push({
        source: stmt.source.value,
        specifiers,
        isTypeOnly,
        line: stmt.loc?.start.line ?? 0,
      });
    }

    // export { ... } or export function/class/const/type/interface ...
    if (stmt.type === 'ExportNamedDeclaration') {
      const isTypeOnly = stmt.exportKind === 'type';
      const line = stmt.loc?.start.line ?? 0;

      for (const s of stmt.specifiers ?? []) {
        const exported = s.exported as any;
        const name = exported?.name ?? exported?.value;
        if (name) exports.push({ name, isTypeOnly, isDefault: false, line });
      }

      const decl = stmt.declaration;
      if (decl?.type === 'FunctionDeclaration' && decl.id) {
        exports.push({
          name: decl.id.name,
          isTypeOnly: false,
          isDefault: false,
          line,
        });
      } else if (decl?.type === 'ClassDeclaration' && decl.id) {
        exports.push({
          name: decl.id.name,
          isTypeOnly: false,
          isDefault: false,
          line,
        });
      } else if (decl?.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          if (d.id?.type === 'Identifier') {
            exports.push({
              name: d.id.name,
              isTypeOnly: false,
              isDefault: false,
              line,
            });
          }
        }
      } else if (decl?.type === 'TSTypeAliasDeclaration') {
        exports.push({
          name: decl.id.name,
          isTypeOnly: true,
          isDefault: false,
          line,
        });
      } else if (decl?.type === 'TSInterfaceDeclaration') {
        exports.push({
          name: decl.id.name,
          isTypeOnly: true,
          isDefault: false,
          line,
        });
      }
    }

    // export default ...
    if (stmt.type === 'ExportDefaultDeclaration') {
      exports.push({
        name: 'default',
        isTypeOnly: false,
        isDefault: true,
        line: stmt.loc?.start.line ?? 0,
      });
    }
  }

  // Call expressions — walk entire AST
  walk(ast.program, (node) => {
    if (node.type === 'CallExpression') {
      const callee = getCallee(node.callee);
      if (callee) calls.push({ callee, line: node.loc?.start.line ?? 0 });
    }
  });

  return { filePath, imports, exports, calls };
}
