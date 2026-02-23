/**
 * LCOM4 (Lack of Cohesion of Methods) calculator using @ast-grep/napi.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SgNode = any;

function findThisAccesses(bodyNode: SgNode): string[] {
  const accessed = new Set<string>();
  walk(bodyNode, (node: SgNode) => {
    if (node.kind() === 'member_expression') {
      const children = node.children();
      const obj = children.find((c: SgNode) => c.kind() === 'this');
      const prop = children.find(
        (c: SgNode) => c.kind() === 'property_identifier',
      );
      if (obj && prop) {
        accessed.add(prop.text());
      }
    }
  });
  return [...accessed];
}

export async function extractClassInfo(
  source: string,
  className: string,
): Promise<ClassInfo | null> {
  const root = await parseSource(source);

  let classNode: SgNode | null = null;

  // Find class declaration matching className
  walk(root, (node: SgNode) => {
    if (classNode) return;
    if (node.kind() === 'class_declaration') {
      const nameNode = node.children().find(
        (c: SgNode) => c.kind() === 'type_identifier',
      );
      if (nameNode && nameNode.text() === className) {
        classNode = node;
      }
    }
  });

  if (!classNode) return null;

  // Find the class_body
  const classBody = (classNode as SgNode)
    .children()
    .find((c: SgNode) => c.kind() === 'class_body');
  if (!classBody) return null;

  const fields: string[] = [];
  const methods: MethodInfo[] = [];

  for (const member of classBody.children()) {
    const kind = member.kind();

    // Fields: public_field_definition
    if (kind === 'public_field_definition') {
      const nameNode = member
        .children()
        .find((c: SgNode) => c.kind() === 'property_identifier');
      if (nameNode) {
        fields.push(nameNode.text());
      }
    }

    // Methods: method_definition
    if (kind === 'method_definition') {
      const nameNode = member
        .children()
        .find((c: SgNode) => c.kind() === 'property_identifier');
      const bodyNode = member
        .children()
        .find((c: SgNode) => c.kind() === 'statement_block');
      if (nameNode && bodyNode) {
        methods.push({
          name: nameNode.text(),
          accessedFields: findThisAccesses(bodyNode),
        });
      }
    }
  }

  return { name: className, fields, methods };
}

export async function calculateLCOM4(
  source: string,
  className: string,
): Promise<LCOM4Result> {
  const info = await extractClassInfo(source, className);

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
