/**
 * Cyclomatic Complexity (CC) calculator using @ast-grep/napi.
 *
 * CC = 1 (base) + number of decision points per function.
 * Decision points: if, for, while, do-while, case (non-default),
 * conditional (?:), && and ||.
 */
import type { CyclomaticComplexityResult } from '../types/metrics.js';

import { parseSource, walk } from './parser.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SgNode = any;

/** Decision point node kinds that always add +1 */
const DECISION_KINDS = new Set([
  'if_statement',
  'for_statement',
  'for_in_statement',
  'while_statement',
  'do_statement',
  'ternary_expression',
]);

function computeCC(bodyNode: SgNode): number {
  let cc = 1;
  walk(bodyNode, (node: SgNode) => {
    const kind = node.kind();

    if (DECISION_KINDS.has(kind)) {
      cc++;
      return;
    }

    // switch_case: only non-default cases (those with a test expression)
    if (kind === 'switch_case') {
      // A default case in tree-sitter has kind 'switch_default'
      // switch_case always has a condition
      cc++;
      return;
    }

    // switch_default is separate, don't count it
    // (tree-sitter separates switch_case and switch_default)

    // Logical && and || operators
    if (kind === 'binary_expression') {
      const children = node.children();
      for (const child of children) {
        const text = child.text();
        if (text === '&&' || text === '||') {
          cc++;
          break;
        }
      }
    }
  });
  return cc;
}

function getNodeName(node: SgNode): string | null {
  const children = node.children();
  // function_declaration: name is an identifier child
  const nameNode = children.find(
    (c: SgNode) =>
      c.kind() === 'identifier' || c.kind() === 'property_identifier',
  );
  return nameNode ? nameNode.text() : null;
}

export async function calculateCC(
  source: string,
  _filePath = 'analysis.ts',
): Promise<CyclomaticComplexityResult> {
  const root = await parseSource(source);
  const perFunction = new Map<string, number>();
  const rootChildren = root.children();

  for (const stmt of rootChildren) {
    const kind = stmt.kind();

    // function foo() {}
    if (kind === 'function_declaration') {
      const name = getNodeName(stmt);
      const body = stmt
        .children()
        .find((c: SgNode) => c.kind() === 'statement_block');
      if (name && body) {
        perFunction.set(name, computeCC(body));
      }
    }

    // const foo = () => {} or const foo = function() {}
    if (kind === 'lexical_declaration' || kind === 'variable_declaration') {
      for (const decl of stmt.children()) {
        if (decl.kind() === 'variable_declarator') {
          const nameNode = decl
            .children()
            .find((c: SgNode) => c.kind() === 'identifier');
          const initChildren = decl.children();
          const init = initChildren.find(
            (c: SgNode) =>
              c.kind() === 'arrow_function' || c.kind() === 'function_expression',
          );
          if (nameNode && init) {
            const body = init
              .children()
              .find((c: SgNode) => c.kind() === 'statement_block');
            if (body) {
              perFunction.set(nameNode.text(), computeCC(body));
            }
          }
        }
      }
    }

    // export function foo() {} or export class Foo {}
    if (kind === 'export_statement') {
      const exportedDecl = stmt.children();

      const funcDecl = exportedDecl.find(
        (c: SgNode) => c.kind() === 'function_declaration',
      );
      if (funcDecl) {
        const name = getNodeName(funcDecl);
        const body = funcDecl
          .children()
          .find((c: SgNode) => c.kind() === 'statement_block');
        if (name && body) {
          perFunction.set(name, computeCC(body));
        }
      }

      // export class Foo { method() {} }
      const classDecl = exportedDecl.find(
        (c: SgNode) => c.kind() === 'class_declaration',
      );
      if (classDecl) {
        processClassMethods(classDecl, perFunction);
      }

      // export const foo = () => {}
      const lexDecl = exportedDecl.find(
        (c: SgNode) =>
          c.kind() === 'lexical_declaration' ||
          c.kind() === 'variable_declaration',
      );
      if (lexDecl) {
        for (const decl of lexDecl.children()) {
          if (decl.kind() === 'variable_declarator') {
            const nameNode = decl
              .children()
              .find((c: SgNode) => c.kind() === 'identifier');
            const init = decl
              .children()
              .find(
                (c: SgNode) =>
                  c.kind() === 'arrow_function' ||
                  c.kind() === 'function_expression',
              );
            if (nameNode && init) {
              const body = init
                .children()
                .find((c: SgNode) => c.kind() === 'statement_block');
              if (body) {
                perFunction.set(nameNode.text(), computeCC(body));
              }
            }
          }
        }
      }
    }

    // class Foo { method() {} }
    if (kind === 'class_declaration') {
      processClassMethods(stmt, perFunction);
    }
  }

  if (perFunction.size === 0) {
    perFunction.set('(file)', 1);
  }

  let fileTotal = 0;
  for (const cc of perFunction.values()) fileTotal += cc;

  return { value: fileTotal, perFunction, fileTotal };
}

function processClassMethods(
  classNode: SgNode,
  perFunction: Map<string, number>,
): void {
  const classBody = classNode
    .children()
    .find((c: SgNode) => c.kind() === 'class_body');
  if (!classBody) return;

  for (const member of classBody.children()) {
    if (member.kind() === 'method_definition') {
      const nameNode = member
        .children()
        .find((c: SgNode) => c.kind() === 'property_identifier');
      const body = member
        .children()
        .find((c: SgNode) => c.kind() === 'statement_block');
      if (nameNode && body) {
        perFunction.set(nameNode.text(), computeCC(body));
      }
    }
  }
}
