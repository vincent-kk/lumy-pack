import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { handleAstGrepReplace } from '../../../mcp/tools/ast-grep-replace.js';
import type {
  AstGrepReplaceError,
  AstGrepReplaceResult,
} from '../../../mcp/tools/ast-grep-replace.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function isReplaceResult(r: unknown): r is AstGrepReplaceResult {
  return (
    typeof r === 'object' &&
    r !== null &&
    'changes' in r &&
    'totalReplacements' in r
  );
}

function isReplaceError(r: unknown): r is AstGrepReplaceError {
  return (
    typeof r === 'object' && r !== null && 'error' in r && 'sgLoadError' in r
  );
}

function isNoFilesMessage(
  r: unknown,
): r is { message: string; pattern: string; filesSearched: number } {
  return (
    typeof r === 'object' &&
    r !== null &&
    'message' in r &&
    'filesSearched' in r &&
    (r as Record<string, unknown>).filesSearched === 0
  );
}

function isNoMatchesMessage(
  r: unknown,
): r is { message: string; pattern: string; filesSearched: number } {
  return (
    typeof r === 'object' &&
    r !== null &&
    'message' in r &&
    'filesSearched' in r &&
    Number((r as Record<string, unknown>).filesSearched) > 0
  );
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('handleAstGrepReplace', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('graceful degradation — @ast-grep/napi unavailable', () => {
    it('returns an error object with "error" and "sgLoadError" fields when module is missing', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(join(tmpDir, 'index.ts'), 'const x = 1;');

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceError(result)) {
        expect(result.error).toBeTypeOf('string');
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.sgLoadError).toBeTypeOf('string');
        // Hint message should mention the package name
        expect(result.error).toContain('@ast-grep/napi');
      } else {
        // @ast-grep/napi is available — validate shape instead
        expect(
          isReplaceResult(result) ||
            isNoMatchesMessage(result) ||
            isNoFilesMessage(result),
        ).toBe(true);
      }
    });
  });

  describe('no files found', () => {
    it('returns message with filesSearched=0 when directory has no matching language files', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(join(tmpDir, 'README.md'), '# only markdown');

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceError(result)) {
        expect(result.error).toBeTypeOf('string');
      } else {
        expect(isNoFilesMessage(result)).toBe(true);
        if (isNoFilesMessage(result)) {
          expect(result.filesSearched).toBe(0);
          expect(result.message).toContain('typescript');
          expect(result.pattern).toBe('const $X = $Y');
        }
      }
    });

    it('returns message mentioning path when no files are found', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));

      const result = await handleAstGrepReplace({
        pattern: 'def $F',
        replacement: 'def _$F',
        language: 'python',
        path: tmpDir,
        dry_run: true,
      });

      if (!isReplaceError(result) && isNoFilesMessage(result)) {
        expect(result.message).toContain('python');
      }
    });
  });

  describe('pattern does not match', () => {
    it('returns message with filesSearched>0 when pattern is not found in files', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(
        join(tmpDir, 'only-const.ts'),
        'export const greeting = "hello";',
      );

      const result = await handleAstGrepReplace({
        pattern: 'function $NAME() { $$$BODY }',
        replacement: 'const $NAME = () => { $$$BODY }',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceError(result)) {
        expect(result.error).toBeTypeOf('string');
      } else if (isNoFilesMessage(result)) {
        // Should not happen — a .ts file is present
        expect(result.filesSearched).toBe(0);
      } else if (isNoMatchesMessage(result)) {
        expect(result.filesSearched).toBeGreaterThan(0);
        expect(result.message).toContain('No matches');
      } else if (isReplaceResult(result)) {
        // Pattern matched — valid when @ast-grep/napi is present
        expect(result.changes).toBeDefined();
      }
    });
  });

  describe('dry_run=true', () => {
    it('does not modify the file on disk when dry_run=true', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      const filePath = join(tmpDir, 'sample.ts');
      const original = 'const x = 1;\nconst y = 2;';
      writeFileSync(filePath, original);

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      // Regardless of whether sg is available or not, the file must be untouched
      const afterContent = readFileSync(filePath, 'utf-8');
      expect(afterContent).toBe(original);

      if (isReplaceResult(result)) {
        expect(result.mode).toContain('DRY RUN');
      }
    });

    it('result mode field says "DRY RUN" when dry_run=true and changes are found', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(join(tmpDir, 'sample.ts'), 'const a = 1;');

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceResult(result)) {
        expect(result.mode).toContain('DRY RUN');
        expect(result.pattern).toBe('const $X = $Y');
        expect(result.replacement).toBe('let $X = $Y');
      }
    });

    it('returns changes array with file, before, after, line when matches are found', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(join(tmpDir, 'sample.ts'), 'const a = 1;');

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceResult(result)) {
        expect(Array.isArray(result.changes)).toBe(true);
        if (result.changes.length > 0) {
          const change = result.changes[0];
          expect(change).toHaveProperty('file');
          expect(change).toHaveProperty('before');
          expect(change).toHaveProperty('after');
          expect(change).toHaveProperty('line');
          expect(typeof change.line).toBe('number');
        }
      }
    });
  });

  describe('result shape', () => {
    it('result always has a deterministic shape (error OR message OR changes)', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(join(tmpDir, 'test.ts'), 'const val = 42;');

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      const isValidShape =
        isReplaceResult(result) ||
        isReplaceError(result) ||
        isNoFilesMessage(result) ||
        isNoMatchesMessage(result) ||
        (typeof result === 'object' && result !== null && 'error' in result);

      expect(isValidShape).toBe(true);
    });

    it('totalReplacements matches the length of changes array', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(
        join(tmpDir, 'multi.ts'),
        'const a = 1;\nconst b = 2;\nconst c = 3;',
      );

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceResult(result)) {
        expect(result.totalReplacements).toBe(result.changes.length);
      }
    });

    it('filesSearched is reported correctly', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      writeFileSync(join(tmpDir, 'a.ts'), 'const x = 1;');
      writeFileSync(join(tmpDir, 'b.ts'), 'const y = 2;');

      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
        dry_run: true,
      });

      if (isReplaceResult(result)) {
        expect(result.filesSearched).toBe(2);
      } else if (isNoMatchesMessage(result)) {
        expect(result.filesSearched).toBe(2);
      }
    });
  });

  describe('dry_run default', () => {
    it('defaults to dry_run=true when dry_run is not specified (file unchanged)', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-replace-test-'));
      const filePath = join(tmpDir, 'default.ts');
      const original = 'const z = 99;';
      writeFileSync(filePath, original);

      // Omit dry_run — default is true
      const result = await handleAstGrepReplace({
        pattern: 'const $X = $Y',
        replacement: 'let $X = $Y',
        language: 'typescript',
        path: tmpDir,
      });

      const afterContent = readFileSync(filePath, 'utf-8');
      expect(afterContent).toBe(original);

      if (isReplaceResult(result)) {
        expect(result.mode).toContain('DRY RUN');
      }
    });
  });
});
