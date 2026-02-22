import { describe, expect, it } from 'vitest';

import {
  analyzeIndex,
  extractModuleExports,
} from '../../../core/index-analyzer.js';

describe('index-analyzer', () => {
  describe('extractModuleExports', () => {
    it('should extract named re-exports', () => {
      const content = `export { Foo, Bar } from './foo.js';`;
      const result = extractModuleExports(content);
      const kinds = result.map((e) => e.kind);
      expect(kinds).toContain('re-export');
      const names = result.map((e) => e.name);
      expect(names).toContain('Foo');
      expect(names).toContain('Bar');
    });

    it('should extract star re-exports', () => {
      const content = `export * from './utils.js';`;
      const result = extractModuleExports(content);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('re-export');
      expect(result[0].name).toBe('*');
      expect(result[0].source).toBe('./utils.js');
    });

    it('should extract named star re-export (export * as ns)', () => {
      const content = `export * as utils from './utils.js';`;
      const result = extractModuleExports(content);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('re-export');
      expect(result[0].name).toBe('utils');
    });

    it('should extract type re-exports', () => {
      const content = `export type { MyType, OtherType } from './types.js';`;
      const result = extractModuleExports(content);
      const reExports = result.filter((e) => e.kind === 're-export');
      const names = reExports.map((e) => e.name);
      expect(names).toContain('MyType');
      expect(names).toContain('OtherType');
    });

    it('should extract named declarations', () => {
      const content = `
export function myFunc() {}
export class MyClass {}
export const MY_CONST = 42;
`;
      const result = extractModuleExports(content);
      const named = result.filter((e) => e.kind === 'named');
      const names = named.map((e) => e.name);
      expect(names).toContain('myFunc');
      expect(names).toContain('MyClass');
    });

    it('should extract default exports', () => {
      const content = `export default function main() {}`;
      const result = extractModuleExports(content);
      const defaults = result.filter((e) => e.kind === 'default');
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe('default');
    });

    it('should extract type declarations', () => {
      const content = `export type MyType = string | number;`;
      const result = extractModuleExports(content);
      const types = result.filter((e) => e.kind === 'type');
      expect(types.some((e) => e.name === 'MyType')).toBe(true);
    });

    it('should return empty array for empty content', () => {
      expect(extractModuleExports('')).toEqual([]);
    });
  });

  describe('analyzeIndex', () => {
    it('should detect pure barrel (only re-exports)', () => {
      const content = `
export { Foo } from './foo.js';
export { Bar } from './bar.js';
export * from './utils.js';
`;
      const result = analyzeIndex(content);
      expect(result.isPureBarrel).toBe(true);
      expect(result.reExportCount).toBeGreaterThan(0);
      expect(result.declarationCount).toBe(0);
    });

    it('should detect non-pure barrel (has declarations)', () => {
      const content = `
export { Foo } from './foo.js';
export function helper() {}
`;
      const result = analyzeIndex(content);
      expect(result.isPureBarrel).toBe(false);
      expect(result.declarationCount).toBeGreaterThan(0);
    });

    it('should count re-exports correctly', () => {
      const content = `
export { A, B } from './a.js';
export * from './b.js';
`;
      const result = analyzeIndex(content);
      // A, B → 2 named re-exports, * → 1 star re-export
      expect(result.reExportCount).toBe(3);
    });

    it('should return empty barrel for content with no exports', () => {
      const content = `const x = 1;`;
      const result = analyzeIndex(content);
      expect(result.isPureBarrel).toBe(false);
      expect(result.reExportCount).toBe(0);
      expect(result.declarationCount).toBe(0);
    });

    it('should return missingExports as empty array by default', () => {
      const content = `export { Foo } from './foo.js';`;
      const result = analyzeIndex(content);
      expect(result.missingExports).toEqual([]);
    });

    it('should handle mixed type and value re-exports', () => {
      const content = `
export type { MyType } from './types.js';
export { myFunc } from './func.js';
`;
      const result = analyzeIndex(content);
      expect(result.isPureBarrel).toBe(true);
      expect(result.reExportCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle export with alias', () => {
      const content = `export { Foo as FooAlias } from './foo.js';`;
      const result = extractModuleExports(content);
      const reExports = result.filter((e) => e.kind === 're-export');
      expect(reExports.length).toBeGreaterThan(0);
    });
  });
});
