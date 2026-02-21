/**
 * Extract import/export/call dependencies from TypeScript/JavaScript source
 */
import ts from 'typescript';
import { parseSource } from './parser.js';
import type { DependencyInfo, ImportInfo, ExportInfo, CallInfo } from '../types/ast.js';

/**
 * Extract all dependency information from source code.
 */
export function extractDependencies(
  source: string,
  filePath: string = 'anonymous.ts',
): DependencyInfo {
  const sourceFile = parseSource(source, filePath);
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const calls: CallInfo[] = [];

  function visit(node: ts.Node): void {
    // Import declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const isTypeOnly = node.importClause?.isTypeOnly ?? false;
      const specifiers: string[] = [];

      if (node.importClause) {
        // Default import
        if (node.importClause.name) {
          specifiers.push(node.importClause.name.text);
        }
        // Named imports
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
              specifiers.push(element.name.text);
            }
          }
          // Namespace import: import * as ns from '...'
          if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            specifiers.push(node.importClause.namedBindings.name.text);
          }
        }
      }

      imports.push({
        source: moduleSpecifier,
        specifiers,
        isTypeOnly,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }

    // Export declarations
    if (ts.isExportDeclaration(node)) {
      const isTypeOnly = node.isTypeOnly;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            isTypeOnly,
            isDefault: false,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
        }
      }
    }

    // Exported variable/function/class declarations
    if (hasExportModifier(node)) {
      const isDefault = hasDefaultModifier(node);

      if (ts.isFunctionDeclaration(node) && node.name) {
        exports.push({
          name: node.name.text,
          isTypeOnly: false,
          isDefault,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      } else if (ts.isClassDeclaration(node) && node.name) {
        exports.push({
          name: node.name.text,
          isTypeOnly: false,
          isDefault,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              name: decl.name.text,
              isTypeOnly: false,
              isDefault: false,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            });
          }
        }
      } else if (ts.isTypeAliasDeclaration(node)) {
        exports.push({
          name: node.name.text,
          isTypeOnly: true,
          isDefault: false,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      } else if (ts.isInterfaceDeclaration(node)) {
        exports.push({
          name: node.name.text,
          isTypeOnly: true,
          isDefault: false,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      }
    }

    // Call expressions
    if (ts.isCallExpression(node)) {
      const callee = getCalleeText(node.expression);
      if (callee) {
        calls.push({
          callee,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { filePath, imports, exports, calls };
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasDefaultModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

function getCalleeText(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const obj = getCalleeText(expr.expression);
    if (obj) return `${obj}.${expr.name.text}`;
  }
  return null;
}
