/**
 * LCOM4 (Lack of Cohesion of Methods) calculator using TypeScript Compiler API.
 *
 * LCOM4 measures class cohesion by building an undirected graph where:
 * - Nodes = methods
 * - Edges = two methods share at least one field
 * LCOM4 value = number of connected components in this graph.
 * - 1 = highly cohesive (good)
 * - >=2 = fragmented (should consider splitting)
 * - 0 = no methods to analyze
 */
import ts from 'typescript';
import { parseSource } from './parser.js';
import type { LCOM4Result } from '../types/metrics.js';
import type { ClassInfo, MethodInfo } from '../types/ast.js';

/**
 * Extract class structure (fields, methods, field access) from source code.
 * @param source - Source code string
 * @param className - Target class name
 * @returns ClassInfo or null if class not found
 */
export function extractClassInfo(
  source: string,
  className: string,
): ClassInfo | null {
  const sourceFile = parseSource(source, 'analysis.ts');
  let classDecl: ts.ClassDeclaration | null = null;

  // Find the target class
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      classDecl = node;
    }
  });

  if (!classDecl) return null;

  const fields: string[] = [];
  const methods: MethodInfo[] = [];

  for (const member of (classDecl as ts.ClassDeclaration).members) {
    // Collect property declarations as fields
    if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
      fields.push(member.name.text);
    }

    // Collect method declarations
    if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
      const methodName = member.name.text;
      const accessedFields = findFieldAccesses(member);
      methods.push({ name: methodName, accessedFields });
    }
  }

  return { name: className, fields, methods };
}

/**
 * Calculate LCOM4 for a class in source code.
 */
export function calculateLCOM4(
  source: string,
  className: string,
): LCOM4Result {
  const info = extractClassInfo(source, className);

  if (!info || info.methods.length === 0) {
    return {
      value: 0,
      components: [],
      methodCount: info?.methods.length ?? 0,
      fieldCount: info?.fields.length ?? 0,
    };
  }

  // Build undirected graph: methods connected if they share a field
  const methodNames = info.methods.map(m => m.name);
  const adjacency = new Map<string, Set<string>>();

  for (const name of methodNames) {
    adjacency.set(name, new Set());
  }

  for (let i = 0; i < info.methods.length; i++) {
    for (let j = i + 1; j < info.methods.length; j++) {
      const a = info.methods[i];
      const b = info.methods[j];
      const shared = a.accessedFields.some(f => b.accessedFields.includes(f));
      if (shared) {
        adjacency.get(a.name)!.add(b.name);
        adjacency.get(b.name)!.add(a.name);
      }
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const name of methodNames) {
    if (visited.has(name)) continue;

    const component: string[] = [];
    const queue = [name];
    visited.add(name);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current)!) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return {
    value: components.length,
    components,
    methodCount: info.methods.length,
    fieldCount: info.fields.length,
  };
}

/**
 * Find all field names accessed via `this.fieldName` in a method body.
 */
function findFieldAccesses(method: ts.MethodDeclaration): string[] {
  const accessed = new Set<string>();

  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      accessed.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  if (method.body) {
    visit(method.body);
  }

  return Array.from(accessed);
}
