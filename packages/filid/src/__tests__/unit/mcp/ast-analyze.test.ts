import { describe, it, expect } from 'vitest';
import { handleAstAnalyze } from '../../../mcp/tools/ast-analyze.js';

const sampleSource = `
  import { readFile } from 'fs/promises';

  export class Calculator {
    private result: number = 0;
    private history: number[] = [];

    add(a: number, b: number): number {
      this.result = a + b;
      this.history.push(this.result);
      return this.result;
    }

    getResult(): number {
      return this.result;
    }
  }

  export function process(x: number): string {
    if (x > 0) {
      return 'positive';
    } else if (x < 0) {
      return 'negative';
    }
    return 'zero';
  }
`;

describe('handleAstAnalyze', () => {
  it('should extract dependencies with dependency-graph analysis', () => {
    const result = handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'dependency-graph',
    });

    expect(result.imports).toBeDefined();
    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.exports).toBeDefined();
    expect(result.calls).toBeDefined();
  });

  it('should calculate LCOM4 for a class', () => {
    const result = handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'lcom4',
      className: 'Calculator',
    });

    expect(result.value).toBeDefined();
    expect(result.methodCount).toBeGreaterThan(0);
    expect(result.fieldCount).toBeGreaterThan(0);
    expect(result.components).toBeDefined();
  });

  it('should calculate cyclomatic complexity', () => {
    const result = handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'cyclomatic-complexity',
    });

    expect(result.fileTotal).toBeGreaterThan(0);
    expect(result.perFunction).toBeDefined();
  });

  it('should compute tree diff', () => {
    const oldSource = `export function foo() { return 1; }`;
    const newSource = `
      export function foo() { return 2; }
      export function bar() { return 3; }
    `;
    const result = handleAstAnalyze({
      source: newSource,
      filePath: 'diff.ts',
      analysisType: 'tree-diff',
      oldSource,
    });

    expect(result.hasSemanticChanges).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('should run full analysis combining all types', () => {
    const result = handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'full',
      className: 'Calculator',
    });

    expect(result.dependencies).toBeDefined();
    expect(result.lcom4).toBeDefined();
    expect(result.cyclomaticComplexity).toBeDefined();
  });

  it('should throw for lcom4 without className', () => {
    expect(() =>
      handleAstAnalyze({
        source: sampleSource,
        filePath: 'calc.ts',
        analysisType: 'lcom4',
      }),
    ).toThrow('className');
  });
});
