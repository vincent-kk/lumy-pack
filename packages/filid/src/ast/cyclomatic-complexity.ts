/**
 * Cyclomatic Complexity (CC) calculator using @babel/parser.
 *
 * CC = 1 (base) + number of decision points per function.
 * Decision points: if, for, while, do-while, case (non-default),
 * conditional (?:), && and ||.
 */
import type { CyclomaticComplexityResult } from '../types/metrics.js';

import { parseSource, walk } from './parser.js';

function computeCC(body: any): number {
  let cc = 1;
  walk(body, (node) => {
    switch (node.type) {
      case 'IfStatement':
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'ConditionalExpression':
        cc++;
        break;
      case 'SwitchCase':
        if (node.test !== null) cc++; // non-default case
        break;
      case 'LogicalExpression':
        if (node.operator === '&&' || node.operator === '||') cc++;
        break;
    }
  });
  return cc;
}

export function calculateCC(
  source: string,
  _filePath = 'analysis.ts',
): CyclomaticComplexityResult {
  const ast = parseSource(source);
  const perFunction = new Map<string, number>();

  for (const stmt of ast.program.body) {
    // function foo() {}
    if (stmt.type === 'FunctionDeclaration' && stmt.id && stmt.body) {
      perFunction.set(stmt.id.name, computeCC(stmt.body));
    }

    // const foo = () => {} or const foo = function() {}
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.id?.type === 'Identifier' && decl.init) {
          const init = decl.init;
          if (
            (init.type === 'ArrowFunctionExpression' ||
              init.type === 'FunctionExpression') &&
            init.body
          ) {
            perFunction.set(decl.id.name, computeCC(init.body));
          }
        }
      }
    }

    // export function foo() {}
    if (
      stmt.type === 'ExportNamedDeclaration' &&
      stmt.declaration?.type === 'FunctionDeclaration' &&
      stmt.declaration.id &&
      stmt.declaration.body
    ) {
      perFunction.set(
        stmt.declaration.id.name,
        computeCC(stmt.declaration.body),
      );
    }

    // class Foo { method() {} }
    const classNode =
      stmt.type === 'ClassDeclaration'
        ? stmt
        : stmt.type === 'ExportNamedDeclaration' &&
            stmt.declaration?.type === 'ClassDeclaration'
          ? stmt.declaration
          : null;

    if (classNode?.body) {
      for (const member of classNode.body.body) {
        if (
          member.type === 'ClassMethod' &&
          member.key?.type === 'Identifier' &&
          member.body
        ) {
          perFunction.set(member.key.name, computeCC(member.body));
        }
      }
    }
  }

  if (perFunction.size === 0) {
    perFunction.set('(file)', 1);
  }

  let fileTotal = 0;
  for (const cc of perFunction.values()) fileTotal += cc;

  return { value: fileTotal, perFunction, fileTotal };
}
