import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  findEntryPoint,
  extractImports,
  extractPublicApi,
  analyzeModule,
} from '../../../core/module-main-analyzer.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'filid-module-analyzer-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('module-main-analyzer', () => {
  describe('findEntryPoint', () => {
    it('should find index.ts as entry point (highest priority)', async () => {
      const dir = join(tmpDir, 'ep-index');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.ts'), 'export const x = 1;');
      await writeFile(join(dir, 'main.ts'), 'export const y = 2;');

      const result = await findEntryPoint(dir);
      expect(result).toBe(join(dir, 'index.ts'));
    });

    it('should find main.ts when index.ts does not exist', async () => {
      const dir = join(tmpDir, 'ep-main');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'main.ts'), 'export const y = 2;');

      const result = await findEntryPoint(dir);
      expect(result).toBe(join(dir, 'main.ts'));
    });

    it('should find single .ts file as entry point', async () => {
      const dir = join(tmpDir, 'ep-single');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'calculator.ts'), 'export function add(a: number, b: number) { return a + b; }');

      const result = await findEntryPoint(dir);
      expect(result).toBe(join(dir, 'calculator.ts'));
    });

    it('should return null when multiple .ts files exist without standard entry', async () => {
      const dir = join(tmpDir, 'ep-multi');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'a.ts'), 'export const a = 1;');
      await writeFile(join(dir, 'b.ts'), 'export const b = 2;');

      const result = await findEntryPoint(dir);
      expect(result).toBeNull();
    });

    it('should return null for empty directory', async () => {
      const dir = join(tmpDir, 'ep-empty');
      await mkdir(dir, { recursive: true });

      const result = await findEntryPoint(dir);
      expect(result).toBeNull();
    });
  });

  describe('extractImports', () => {
    it('should extract static import paths', async () => {
      const file = join(tmpDir, 'imports-test.ts');
      await writeFile(file, `
import { foo } from './foo.js';
import type { Bar } from './bar.js';
import * as utils from '../utils.js';
`);
      const result = await extractImports(file);
      expect(result).toContain('./foo.js');
      expect(result).toContain('./bar.js');
      expect(result).toContain('../utils.js');
    });

    it('should return empty array for file without imports', async () => {
      const file = join(tmpDir, 'no-imports.ts');
      await writeFile(file, `export const x = 42;`);
      const result = await extractImports(file);
      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent file', async () => {
      const result = await extractImports('/non/existent/file.ts');
      expect(result).toEqual([]);
    });
  });

  describe('extractPublicApi', () => {
    it('should extract functions and classes from entry point', async () => {
      const file = join(tmpDir, 'api-test.ts');
      await writeFile(file, `
export function myFunction() {}
export class MyClass {}
export type MyType = string;
export interface MyInterface { id: number; }
`);
      const result = await extractPublicApi(file);
      expect(result.functions).toContain('myFunction');
      expect(result.classes).toContain('MyClass');
      expect(result.types).toContain('MyType');
      expect(result.types).toContain('MyInterface');
    });

    it('should return empty api for non-existent file', async () => {
      const result = await extractPublicApi('/non/existent/file.ts');
      expect(result.exports).toEqual([]);
      expect(result.types).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
    });
  });

  describe('analyzeModule', () => {
    it('should analyze module with index.ts entry point', async () => {
      const dir = join(tmpDir, 'module-full');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.ts'), `
export { doStuff } from './impl.js';
import { helper } from './helper.js';
`);

      const result = await analyzeModule(dir);
      expect(result.path).toBe(dir);
      expect(result.name).toBe('module-full');
      expect(result.entryPoint).toBe(join(dir, 'index.ts'));
    });

    it('should return null entryPoint when no entry exists', async () => {
      const dir = join(tmpDir, 'module-noentry');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'a.ts'), 'export const a = 1;');
      await writeFile(join(dir, 'b.ts'), 'export const b = 2;');

      const result = await analyzeModule(dir);
      expect(result.entryPoint).toBeNull();
      expect(result.exports).toEqual([]);
    });
  });
});
