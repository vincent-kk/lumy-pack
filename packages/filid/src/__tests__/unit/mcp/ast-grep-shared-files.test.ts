import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getFilesForLanguage } from '../../../ast/ast-grep-shared.js';

// ─── getFilesForLanguage ────────────────────────────────────────────────────

describe('getFilesForLanguage', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('finds .ts files in a directory', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    writeFileSync(join(tmpDir, 'a.ts'), 'const a = 1;');
    writeFileSync(join(tmpDir, 'b.ts'), 'const b = 2;');

    const files = getFilesForLanguage(tmpDir, 'typescript');
    expect(files.length).toBe(2);
    expect(
      files.every(
        (f) => f.endsWith('.ts') || f.endsWith('.mts') || f.endsWith('.cts'),
      ),
    ).toBe(true);
  });

  it('finds .py files for language "python"', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    writeFileSync(join(tmpDir, 'main.py'), 'print("hello")');
    writeFileSync(join(tmpDir, 'utils.ts'), 'export const x = 1;');

    const files = getFilesForLanguage(tmpDir, 'python');
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/main\.py$/);
  });

  it('returns empty array when no files match the language', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    writeFileSync(join(tmpDir, 'readme.md'), '# doc');

    const files = getFilesForLanguage(tmpDir, 'typescript');
    expect(files).toEqual([]);
  });

  it('excludes files inside node_modules directory', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    const nodeModulesDir = join(tmpDir, 'node_modules', 'some-pkg');
    mkdirSync(nodeModulesDir, { recursive: true });
    writeFileSync(join(nodeModulesDir, 'index.ts'), 'export {}');
    writeFileSync(join(tmpDir, 'app.ts'), 'const x = 1;');

    const files = getFilesForLanguage(tmpDir, 'typescript');
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/app\.ts$/);
  });

  it('excludes files inside .git directory', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    const gitDir = join(tmpDir, '.git', 'hooks');
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, 'pre-commit.ts'), '');
    writeFileSync(join(tmpDir, 'index.ts'), 'export {}');

    const files = getFilesForLanguage(tmpDir, 'typescript');
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/index\.ts$/);
  });

  it('excludes files inside dist directory', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    const distDir = join(tmpDir, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'bundle.js'), '');
    writeFileSync(join(tmpDir, 'src.js'), 'const x = 1;');

    const files = getFilesForLanguage(tmpDir, 'javascript');
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/src\.js$/);
  });

  it('respects maxFiles limit', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    for (let i = 0; i < 10; i++) {
      writeFileSync(join(tmpDir, `file${i}.ts`), `const x${i} = ${i};`);
    }

    const files = getFilesForLanguage(tmpDir, 'typescript', 3);
    expect(files.length).toBe(3);
  });

  it('returns the resolved path when given a single file path', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    const filePath = join(tmpDir, 'only.ts');
    writeFileSync(filePath, 'export const only = true;');

    const files = getFilesForLanguage(filePath, 'typescript');
    expect(files.length).toBe(1);
    expect(files[0]).toBe(filePath);
  });

  it('searches nested subdirectories recursively', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    const subDir = join(tmpDir, 'src', 'core');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'nested.ts'), 'export const nested = 1;');
    writeFileSync(join(tmpDir, 'root.ts'), 'export const root = 1;');

    const files = getFilesForLanguage(tmpDir, 'typescript');
    expect(files.length).toBe(2);
  });

  it('handles .mts and .cts extensions as typescript', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'filid-shared-test-'));
    writeFileSync(join(tmpDir, 'mod.mts'), 'export const mod = 1;');
    writeFileSync(join(tmpDir, 'mod.cts'), 'module.exports = {};');

    const files = getFilesForLanguage(tmpDir, 'typescript');
    expect(files.length).toBe(2);
  });
});
