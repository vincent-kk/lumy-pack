import { describe, it, expect } from 'vitest';

import {
  computeExactHash,
  computeStructuralHash,
  computeContentHash,
} from '../signature-hasher.js';

describe('computeExactHash', () => {
  it('produces same hash for code differing only in whitespace', () => {
    const a = 'function foo() { return 42; }';
    const b = 'function  foo()  {\n  return  42;\n}';
    expect(computeExactHash(a)).toBe(computeExactHash(b));
  });

  it('produces same hash for code differing only in comments', () => {
    const a = 'function foo() { return 42; }';
    const b = 'function foo() { /* comment */ return 42; // inline\n}';
    expect(computeExactHash(a)).toBe(computeExactHash(b));
  });

  it('produces different hash for different logic', () => {
    const a = 'function foo() { return 42; }';
    const b = 'function foo() { return 100; }';
    expect(computeExactHash(a)).not.toBe(computeExactHash(b));
  });
});

describe('computeStructuralHash', () => {
  it('produces same hash for code differing only in variable names', () => {
    const a = 'function foo(x) { return x + 1; }';
    const b = 'function bar(y) { return y + 1; }';
    expect(computeStructuralHash(a)).toBe(computeStructuralHash(b));
  });

  it('produces different hash for different structure', () => {
    const a = 'function foo(x) { return x + 1; }';
    const b = 'function foo(x, y) { return x + y; }';
    expect(computeStructuralHash(a)).not.toBe(computeStructuralHash(b));
  });

  it('is deterministic across calls', () => {
    const code = 'function process(data) { return data.map(item => item.id); }';
    const hash1 = computeStructuralHash(code);
    const hash2 = computeStructuralHash(code);
    expect(hash1).toBe(hash2);
  });
});

describe('computeContentHash', () => {
  it('returns both exact and structural hashes', () => {
    const hash = computeContentHash('function foo() { return 42; }');
    expect(hash.exact).toBeTruthy();
    expect(hash.structural).toBeTruthy();
    expect(hash.exact).not.toBe(hash.structural);
  });
});
