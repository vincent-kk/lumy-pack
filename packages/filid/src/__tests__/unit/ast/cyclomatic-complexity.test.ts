import { describe, it, expect } from 'vitest';
import { calculateCC } from '../../../ast/cyclomatic-complexity.js';

describe('cyclomatic-complexity', () => {
  it('should return 1 for a simple function with no branches', () => {
    const source = `
      function greet(name: string): string {
        return \`Hello, \${name}\`;
      }
    `;
    const result = calculateCC(source);

    expect(result.perFunction.get('greet')).toBe(1);
  });

  it('should count if statements', () => {
    const source = `
      function check(x: number): string {
        if (x > 0) {
          return 'positive';
        } else if (x < 0) {
          return 'negative';
        }
        return 'zero';
      }
    `;
    const result = calculateCC(source);

    // Base 1 + 2 if branches = 3
    expect(result.perFunction.get('check')).toBe(3);
  });

  it('should count for/while/do-while loops', () => {
    const source = `
      function loops(items: number[]): number {
        let sum = 0;
        for (const item of items) {
          sum += item;
        }
        while (sum > 100) {
          sum -= 10;
        }
        do {
          sum++;
        } while (sum < 50);
        return sum;
      }
    `;
    const result = calculateCC(source);

    // Base 1 + for + while + do-while = 4
    expect(result.perFunction.get('loops')).toBe(4);
  });

  it('should count switch cases', () => {
    const source = `
      function classify(code: string): string {
        switch (code) {
          case 'A': return 'alpha';
          case 'B': return 'beta';
          case 'C': return 'gamma';
          default: return 'unknown';
        }
      }
    `;
    const result = calculateCC(source);

    // Base 1 + 3 non-default cases = 4
    expect(result.perFunction.get('classify')).toBe(4);
  });

  it('should count logical operators && and ||', () => {
    const source = `
      function validate(a: boolean, b: boolean, c: boolean): boolean {
        return a && b || c;
      }
    `;
    const result = calculateCC(source);

    // Base 1 + && + || = 3
    expect(result.perFunction.get('validate')).toBe(3);
  });

  it('should count ternary operator', () => {
    const source = `
      function choose(x: number): string {
        return x > 0 ? 'positive' : 'non-positive';
      }
    `;
    const result = calculateCC(source);

    // Base 1 + ternary = 2
    expect(result.perFunction.get('choose')).toBe(2);
  });

  it('should calculate file-level total CC', () => {
    const source = `
      function a(x: number) {
        if (x > 0) return true;
        return false;
      }
      function b(y: string) {
        switch (y) {
          case 'x': return 1;
          case 'y': return 2;
          default: return 0;
        }
      }
    `;
    const result = calculateCC(source);

    // a: 1+1 = 2, b: 1+2 = 3, total = 5
    expect(result.perFunction.get('a')).toBe(2);
    expect(result.perFunction.get('b')).toBe(3);
    expect(result.fileTotal).toBe(5);
    expect(result.value).toBe(5);
  });

  it('should handle arrow functions and method declarations', () => {
    const source = `
      const fn = (x: number) => {
        if (x > 0) return x;
        return -x;
      };
      class Foo {
        bar(y: number): number {
          return y > 10 ? y : 0;
        }
      }
    `;
    const result = calculateCC(source);

    expect(result.perFunction.get('fn')).toBe(2);
    expect(result.perFunction.get('bar')).toBe(2);
  });
});
