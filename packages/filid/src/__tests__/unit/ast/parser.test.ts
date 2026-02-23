import { describe, expect, it } from 'vitest';

import { parseFile, parseSource } from '../../../ast/parser.js';

describe('parser', () => {
  describe('parseSource', () => {
    it('should parse valid TypeScript source code', async () => {
      const source = `const x: number = 42;`;
      const result = await parseSource(source, 'test.ts');

      expect(result).toBeDefined();
      expect(result.kind()).toBe('program');
    });

    it('should parse valid JavaScript source code', async () => {
      const source = `const x = 42;`;
      const result = await parseSource(source, 'test.js');

      expect(result).toBeDefined();
      expect(result.kind()).toBe('program');
    });

    it('should parse source with imports and exports', async () => {
      const source = `
        import { readFile } from 'fs/promises';
        export function greet(name: string): string {
          return \`Hello, \${name}\`;
        }
      `;
      const result = await parseSource(source, 'module.ts');

      expect(result).toBeDefined();
      expect(result.children().length).toBeGreaterThan(0);
    });

    it('should parse class declarations', async () => {
      const source = `
        export class Calculator {
          private result: number = 0;
          add(a: number, b: number): number {
            this.result = a + b;
            return this.result;
          }
        }
      `;
      const result = await parseSource(source, 'calc.ts');

      expect(result).toBeDefined();
      // Root has at least one child (export_statement wrapping class)
      const children = result.children();
      expect(children.length).toBeGreaterThan(0);
    });

    it('should default to TypeScript when no file path given', async () => {
      const source = `const x: number = 1;`;
      const result = await parseSource(source);

      expect(result).toBeDefined();
      expect(result.kind()).toBe('program');
    });
  });

  describe('parseFile', () => {
    it('should throw for non-existent file', async () => {
      await expect(parseFile('/nonexistent/file.ts')).rejects.toThrow();
    });
  });
});
