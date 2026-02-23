import { describe, expect, it } from 'vitest';

import { handleAstAnalyze } from '../../../mcp/tools/ast-analyze.js';

function isAstAnalyzeError(
  r: unknown,
): r is { error: string; sgLoadError: string } {
  return (
    typeof r === 'object' &&
    r !== null &&
    'error' in r &&
    'sgLoadError' in r
  );
}

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
  it('should extract dependencies with dependency-graph analysis', async () => {
    const result = await handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'dependency-graph',
    });

    expect(result.imports).toBeDefined();
    expect((result.imports as unknown[]).length).toBeGreaterThan(0);
    expect(result.exports).toBeDefined();
    expect(result.calls).toBeDefined();
  });

  it('should calculate LCOM4 for a class', async () => {
    const result = await handleAstAnalyze({
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

  it('should calculate cyclomatic complexity', async () => {
    const result = await handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'cyclomatic-complexity',
    });

    expect(result.fileTotal).toBeGreaterThan(0);
    expect(result.perFunction).toBeDefined();
  });

  it('should compute tree diff', async () => {
    const oldSource = `export function foo() { return 1; }`;
    const newSource = `
      export function foo() { return 2; }
      export function bar() { return 3; }
    `;
    const result = await handleAstAnalyze({
      source: newSource,
      filePath: 'diff.ts',
      analysisType: 'tree-diff',
      oldSource,
    });

    expect(result.hasSemanticChanges).toBe(true);
    expect((result.changes as unknown[]).length).toBeGreaterThan(0);
  });

  it('should run full analysis combining all types', async () => {
    const result = await handleAstAnalyze({
      source: sampleSource,
      filePath: 'calc.ts',
      analysisType: 'full',
      className: 'Calculator',
    });

    expect(result.dependencies).toBeDefined();
    expect(result.lcom4).toBeDefined();
    expect(result.cyclomaticComplexity).toBeDefined();
  });

  it('should throw for lcom4 without className', async () => {
    await expect(
      handleAstAnalyze({
        source: sampleSource,
        filePath: 'calc.ts',
        analysisType: 'lcom4',
      }),
    ).rejects.toThrow('className');
  });

  describe('when @ast-grep/napi is not available', () => {
    it('returns error object instead of throwing', async () => {
      const result = await handleAstAnalyze({
        source: sampleSource,
        filePath: 'calc.ts',
        analysisType: 'dependency-graph',
      });

      // When @ast-grep/napi is unavailable, returns { error, sgLoadError }
      // When available, returns a valid analysis result
      if (isAstAnalyzeError(result)) {
        expect(result.error).toBeTypeOf('string');
        expect(result.error).toContain('@ast-grep/napi');
        expect(result.sgLoadError).toBeTypeOf('string');
      } else {
        // @ast-grep/napi is installed — valid result is also acceptable
        expect(result.imports).toBeDefined();
      }
    });

    it('error message includes installation hint when ast-grep unavailable', async () => {
      const result = await handleAstAnalyze({
        source: 'const x = 1;',
        filePath: 'test.ts',
        analysisType: 'cyclomatic-complexity',
      });

      if (isAstAnalyzeError(result)) {
        expect(result.error).toContain('npm install');
        expect(result.error).toContain('@ast-grep/napi');
      } else {
        // @ast-grep/napi available — check valid shape
        expect(result.fileTotal).toBeDefined();
      }
    });

    it('result always has a deterministic shape (error OR valid result)', async () => {
      const result = await handleAstAnalyze({
        source: sampleSource,
        filePath: 'calc.ts',
        analysisType: 'full',
        className: 'Calculator',
      });

      const isValidShape =
        isAstAnalyzeError(result) ||
        ('dependencies' in result && 'cyclomaticComplexity' in result);

      expect(isValidShape).toBe(true);
    });
  });
});
