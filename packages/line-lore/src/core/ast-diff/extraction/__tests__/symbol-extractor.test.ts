import { describe, expect, it } from 'vitest';

import { extractSymbolsFromText } from '@/ast/parser.js';
import type { SymbolInfo } from '@/types/index.js';

import { findContainingSymbol } from '../symbol-extractor.js';

const TS_SOURCE = `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const multiply = (a: number, b: number) => {
  return a * b;
};

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}`;

describe('extractSymbolsFromText', () => {
  it('extracts function declarations', () => {
    const symbols = extractSymbolsFromText(TS_SOURCE, 'typescript');
    const greet = symbols.find((s) => s.name === 'greet');
    expect(greet).toBeDefined();
    expect(greet!.kind).toBe('function');
  });

  it('extracts arrow functions', () => {
    const symbols = extractSymbolsFromText(TS_SOURCE, 'typescript');
    const multiply = symbols.find((s) => s.name === 'multiply');
    expect(multiply).toBeDefined();
    expect(multiply!.kind).toBe('arrow_function');
  });

  it('extracts class declarations', () => {
    const symbols = extractSymbolsFromText(TS_SOURCE, 'typescript');
    const calc = symbols.find((s) => s.name === 'Calculator');
    expect(calc).toBeDefined();
    expect(calc!.kind).toBe('class');
  });

  it('returns empty array for unsupported languages', () => {
    const symbols = extractSymbolsFromText('some code', 'haskell');
    expect(symbols).toEqual([]);
  });
});

describe('findContainingSymbol', () => {
  const symbols: SymbolInfo[] = [
    {
      name: 'outer',
      kind: 'function',
      startLine: 1,
      endLine: 10,
      bodyText: '',
    },
    { name: 'inner', kind: 'function', startLine: 3, endLine: 7, bodyText: '' },
  ];

  it('returns innermost symbol for nested case', () => {
    const result = findContainingSymbol(symbols, 5);
    expect(result?.name).toBe('inner');
  });

  it('returns outer when line is outside inner', () => {
    const result = findContainingSymbol(symbols, 9);
    expect(result?.name).toBe('outer');
  });

  it('returns null when line is outside all symbols', () => {
    const result = findContainingSymbol(symbols, 15);
    expect(result).toBeNull();
  });
});
