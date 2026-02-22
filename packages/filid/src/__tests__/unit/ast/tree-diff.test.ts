import { describe, expect, it } from 'vitest';

import { computeTreeDiff } from '../../../ast/tree-diff.js';

describe('tree-diff', () => {
  it('should detect no changes for identical source', () => {
    const source = `export function greet() { return 'hi'; }`;
    const result = computeTreeDiff(source, source);

    expect(result.hasSemanticChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it('should detect added declarations', () => {
    const oldSource = `export function foo() { return 1; }`;
    const newSource = `
      export function foo() { return 1; }
      export function bar() { return 2; }
    `;
    const result = computeTreeDiff(oldSource, newSource);

    expect(result.hasSemanticChanges).toBe(true);
    const added = result.changes.filter((c) => c.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe('bar');
    expect(added[0].kind).toBe('function');
  });

  it('should detect removed declarations', () => {
    const oldSource = `
      export function foo() { return 1; }
      export function bar() { return 2; }
    `;
    const newSource = `export function foo() { return 1; }`;
    const result = computeTreeDiff(oldSource, newSource);

    expect(result.hasSemanticChanges).toBe(true);
    const removed = result.changes.filter((c) => c.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].name).toBe('bar');
  });

  it('should detect modified declarations', () => {
    const oldSource = `export function greet() { return 'hello'; }`;
    const newSource = `export function greet() { return 'hi'; }`;
    const result = computeTreeDiff(oldSource, newSource);

    expect(result.hasSemanticChanges).toBe(true);
    const modified = result.changes.filter((c) => c.type === 'modified');
    expect(modified).toHaveLength(1);
    expect(modified[0].name).toBe('greet');
  });

  it('should ignore formatting-only changes', () => {
    const oldSource = `export function greet(){return 'hi';}`;
    const newSource = `
      export function greet() {
        return 'hi';
      }
    `;
    const result = computeTreeDiff(oldSource, newSource);

    expect(result.hasSemanticChanges).toBe(false);
    expect(result.formattingOnlyChanges).toBeGreaterThan(0);
  });

  it('should handle class declarations', () => {
    const oldSource = `class Foo { bar() { return 1; } }`;
    const newSource = `
      class Foo { bar() { return 1; } }
      class Baz { qux() { return 2; } }
    `;
    const result = computeTreeDiff(oldSource, newSource);

    expect(result.hasSemanticChanges).toBe(true);
    const added = result.changes.filter((c) => c.type === 'added');
    expect(added[0].name).toBe('Baz');
    expect(added[0].kind).toBe('class');
  });

  it('should handle variable declarations', () => {
    const oldSource = `const x = 1;`;
    const newSource = `const x = 2;`;
    const result = computeTreeDiff(oldSource, newSource);

    expect(result.hasSemanticChanges).toBe(true);
    const modified = result.changes.filter((c) => c.type === 'modified');
    expect(modified[0].name).toBe('x');
    expect(modified[0].kind).toBe('variable');
  });
});
