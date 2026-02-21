import { describe, it, expect } from 'vitest';
import { extractDependencies } from '../../../ast/dependency-extractor.js';

describe('dependency-extractor', () => {
  it('should extract named imports', () => {
    const source = `
      import { readFile, writeFile } from 'fs/promises';
      import { join } from 'path';
    `;
    const result = extractDependencies(source, 'test.ts');

    expect(result.imports).toHaveLength(2);
    expect(result.imports[0].source).toBe('fs/promises');
    expect(result.imports[0].specifiers).toEqual(['readFile', 'writeFile']);
    expect(result.imports[1].source).toBe('path');
    expect(result.imports[1].specifiers).toEqual(['join']);
  });

  it('should extract default imports', () => {
    const source = `import path from 'path';`;
    const result = extractDependencies(source, 'test.ts');

    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].specifiers).toEqual(['path']);
  });

  it('should detect type-only imports', () => {
    const source = `
      import type { Stats } from 'fs';
      import { readFile } from 'fs/promises';
    `;
    const result = extractDependencies(source, 'test.ts');

    expect(result.imports).toHaveLength(2);
    const typeImport = result.imports.find(i => i.source === 'fs');
    expect(typeImport?.isTypeOnly).toBe(true);
    const valueImport = result.imports.find(i => i.source === 'fs/promises');
    expect(valueImport?.isTypeOnly).toBe(false);
  });

  it('should extract named exports', () => {
    const source = `
      export const CONFIG = { max: 3 };
      export function greet() { return 'hi'; }
      export class Foo {}
    `;
    const result = extractDependencies(source, 'test.ts');

    expect(result.exports).toHaveLength(3);
    expect(result.exports.map(e => e.name)).toEqual(['CONFIG', 'greet', 'Foo']);
    expect(result.exports.every(e => !e.isDefault)).toBe(true);
  });

  it('should extract default export', () => {
    const source = `export default function main() {}`;
    const result = extractDependencies(source, 'test.ts');

    const defaultExport = result.exports.find(e => e.isDefault);
    expect(defaultExport).toBeDefined();
    expect(defaultExport?.name).toBe('main');
  });

  it('should extract function calls', () => {
    const source = `
      import { readFile } from 'fs/promises';
      import path from 'path';
      const data = readFile('test.txt');
      const dir = path.dirname('/test');
      console.log(dir);
    `;
    const result = extractDependencies(source, 'test.ts');

    expect(result.calls.length).toBeGreaterThanOrEqual(3);
    const callees = result.calls.map(c => c.callee);
    expect(callees).toContain('readFile');
    expect(callees).toContain('path.dirname');
    expect(callees).toContain('console.log');
  });

  it('should set filePath in result', () => {
    const source = `const x = 1;`;
    const result = extractDependencies(source, 'my-file.ts');

    expect(result.filePath).toBe('my-file.ts');
  });

  it('should handle empty source', () => {
    const result = extractDependencies('', 'empty.ts');

    expect(result.imports).toEqual([]);
    expect(result.exports).toEqual([]);
    expect(result.calls).toEqual([]);
  });
});
