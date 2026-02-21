/**
 * Cyclomatic Complexity (CC) calculator using TypeScript Compiler API.
 *
 * CC = 1 (base) + number of decision points per function.
 * Decision points: if, for, while, do-while, case (non-default),
 * conditional (?:), && and ||.
 */
import ts from 'typescript';
import { parseSource } from './parser.js';
import type { CyclomaticComplexityResult } from '../types/metrics.js';

/**
 * Calculate cyclomatic complexity for all functions in source code.
 */
export function calculateCC(
  source: string,
  filePath: string = 'analysis.ts',
): CyclomaticComplexityResult {
  const sourceFile = parseSource(source, filePath);
  const perFunction = new Map<string, number>();

  function visitRoot(node: ts.Node): void {
    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      perFunction.set(node.name.text, computeCC(node.body));
    }

    // Variable declarations with arrow functions: const fn = (...) => { ... }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          ts.isArrowFunction(decl.initializer) &&
          decl.initializer.body
        ) {
          const body = ts.isBlock(decl.initializer.body)
            ? decl.initializer.body
            : decl.initializer.body;
          perFunction.set(decl.name.text, computeCC(body));
        }
      }
    }

    // Class declarations — extract method CCs
    if (ts.isClassDeclaration(node)) {
      for (const member of node.members) {
        if (
          ts.isMethodDeclaration(member) &&
          member.name &&
          ts.isIdentifier(member.name) &&
          member.body
        ) {
          perFunction.set(member.name.text, computeCC(member.body));
        }
      }
    }

    ts.forEachChild(node, visitRoot);
  }

  // Only visit top-level statements (don't recurse into nested functions twice)
  for (const statement of sourceFile.statements) {
    visitRoot(statement);
  }

  let fileTotal = 0;
  for (const cc of perFunction.values()) {
    fileTotal += cc;
  }

  return {
    value: fileTotal,
    perFunction,
    fileTotal,
  };
}

/**
 * Compute CC for a function/method body node.
 * Starts at 1 (base complexity) and increments for each decision point.
 */
function computeCC(body: ts.Node): number {
  let cc = 1;

  function visit(node: ts.Node): void {
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.ConditionalExpression: // ternary
        cc++;
        break;

      case ts.SyntaxKind.CaseClause:
        // Count non-default case clauses
        cc++;
        break;

      case ts.SyntaxKind.BinaryExpression: {
        const binary = node as ts.BinaryExpression;
        if (
          binary.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          binary.operatorToken.kind === ts.SyntaxKind.BarBarToken
        ) {
          cc++;
        }
        break;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return cc;
}
