/**
 * LCOM4 (Lack of Cohesion of Methods) calculator using @babel/parser.
 *
 * LCOM4 measures class cohesion by building an undirected graph where:
 * - Nodes = methods
 * - Edges = two methods share at least one field
 * LCOM4 value = number of connected components in this graph.
 * - 1 = highly cohesive (good)
 * - >=2 = fragmented (should consider splitting)
 * - 0 = no methods to analyze
 */
import type { ClassInfo, MethodInfo } from '../types/ast.js';
import type { LCOM4Result } from '../types/metrics.js';

import { parseSource, walk } from './parser.js';

function findThisAccesses(body: any): string[] {
  const accessed = new Set<string>();
  walk(body, (node) => {
    if (
      node.type === 'MemberExpression' &&
      node.object?.type === 'ThisExpression' &&
      node.property?.type === 'Identifier'
    ) {
      accessed.add(node.property.name);
    }
  });
  return [...accessed];
}

export function extractClassInfo(
  source: string,
  className: string,
): ClassInfo | null {
  const ast = parseSource(source);

  let classNode: any = null;
  for (const stmt of ast.program.body) {
    const node =
      stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (node?.type === 'ClassDeclaration' && node.id?.name === className) {
      classNode = node;
      break;
    }
  }
  if (!classNode) return null;

  const fields: string[] = [];
  const methods: MethodInfo[] = [];

  for (const member of classNode.body.body) {
    if (
      (member.type === 'ClassProperty' ||
        member.type === 'ClassAccessorProperty') &&
      member.key?.type === 'Identifier'
    ) {
      fields.push(member.key.name);
    }
    if (
      member.type === 'ClassMethod' &&
      member.key?.type === 'Identifier' &&
      member.body
    ) {
      methods.push({
        name: member.key.name,
        accessedFields: findThisAccesses(member.body),
      });
    }
  }

  return { name: className, fields, methods };
}

export function calculateLCOM4(source: string, className: string): LCOM4Result {
  const info = extractClassInfo(source, className);

  if (!info || info.methods.length === 0) {
    return {
      value: 0,
      components: [],
      methodCount: info?.methods.length ?? 0,
      fieldCount: info?.fields.length ?? 0,
    };
  }

  const adjacency = new Map<string, Set<string>>();
  for (const m of info.methods) adjacency.set(m.name, new Set());

  for (let i = 0; i < info.methods.length; i++) {
    for (let j = i + 1; j < info.methods.length; j++) {
      const a = info.methods[i];
      const b = info.methods[j];
      if (a.accessedFields.some((f) => b.accessedFields.includes(f))) {
        adjacency.get(a.name)!.add(b.name);
        adjacency.get(b.name)!.add(a.name);
      }
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const { name } of info.methods) {
    if (visited.has(name)) continue;
    const component: string[] = [];
    const queue = [name];
    visited.add(name);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      component.push(cur);
      for (const nb of adjacency.get(cur)!) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
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
