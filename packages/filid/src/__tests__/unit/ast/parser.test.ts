import { describe, expect, it } from 'vitest';

import { parseFile, parseSource } from '../../../ast/parser.js';

describe('parser', () => {
  describe('parseSource', () => {
    it('should parse valid TypeScript source code', () => {
      const source = `const x: number = 42;`;
      const result = parseSource(source, 'test.ts');

      expect(result).toBeDefined();
      expect(result.fileName).toContain('test.ts');
    });

    it('should parse valid JavaScript source code', () => {
      const source = `const x = 42;`;
      const result = parseSource(source, 'test.js');

      expect(result).toBeDefined();
      expect(result.fileName).toContain('test.js');
    });

    it('should parse source with imports and exports', () => {
      const source = `
        import { readFile } from 'fs/promises';
        export function greet(name: string): string {
          return \`Hello, \${name}\`;
        }
      `;
      const result = parseSource(source, 'module.ts');

      expect(result).toBeDefined();
      expect(result.statements.length).toBeGreaterThan(0);
    });

    it('should parse class declarations', () => {
      const source = `
        export class Calculator {
          private result: number = 0;
          add(a: number, b: number): number {
            this.result = a + b;
            return this.result;
          }
        }
      `;
      const result = parseSource(source, 'calc.ts');

      expect(result).toBeDefined();
      expect(result.statements.length).toBe(1);
    });

    it('should default to TypeScript when no file path given', () => {
      const source = `const x: number = 1;`;
      const result = parseSource(source);

      expect(result).toBeDefined();
      expect(result.fileName).toContain('.ts');
    });
  });

  describe('parseFile', () => {
    it('should throw for non-existent file', () => {
      expect(() => parseFile('/nonexistent/file.ts')).toThrow();
    });
  });
});
