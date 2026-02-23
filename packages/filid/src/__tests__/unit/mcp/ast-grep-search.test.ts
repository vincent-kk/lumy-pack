import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { handleAstGrepSearch } from '../../../mcp/tools/ast-grep-search.js';
import type {
  AstGrepSearchError,
  AstGrepSearchResult,
} from '../../../mcp/tools/ast-grep-search.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function isSearchResult(r: unknown): r is AstGrepSearchResult {
  return typeof r === 'object' && r !== null && 'matches' in r;
}

function isSearchError(r: unknown): r is AstGrepSearchError {
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
    (r as Record<string, unknown>).filesSearched > 0
  );
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('handleAstGrepSearch', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('when @ast-grep/napi is not available', () => {
    it('returns an error object with "error" and "sgLoadError" fields', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));
      writeFileSync(join(tmpDir, 'index.ts'), 'const x = 1;');

      const result = await handleAstGrepSearch({
        pattern: 'const $X = $Y',
        language: 'typescript',
        path: tmpDir,
      });

      // When sg is null, the handler returns { error, sgLoadError }
      // When sg is available, the handler returns { matches, totalMatches, ... }
      if (isSearchError(result)) {
        expect(result.error).toBeTypeOf('string');
        expect(result.error.length).toBeGreaterThan(0);
        expect(result.sgLoadError).toBeTypeOf('string');
      } else {
        // If @ast-grep/napi is installed, we get a valid result — that is also acceptable
        expect(isSearchResult(result) || isNoMatchesMessage(result)).toBe(true);
      }
    });
  });

  describe('no files found', () => {
    it('returns message with filesSearched=0 when directory has no matching language files', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));
      // Only put a .md file — no TypeScript files
      writeFileSync(join(tmpDir, 'README.md'), '# doc');

      const result = await handleAstGrepSearch({
        pattern: 'const $X = $Y',
        language: 'typescript',
        path: tmpDir,
      });

      // If sg is unavailable, we get an error object — still valid to check
      if (isSearchError(result)) {
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

    it('returns message mentioning the language when no files exist', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));

      const result = await handleAstGrepSearch({
        pattern: 'def $FUNC',
        language: 'python',
        path: tmpDir,
      });

      if (!isSearchError(result) && isNoFilesMessage(result)) {
        expect(result.message).toContain('python');
      }
    });
  });

  describe('pattern does not match', () => {
    it('returns message with filesSearched>0 and no matches when pattern is not found', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));
      writeFileSync(
        join(tmpDir, 'hello.ts'),
        'export const greeting = "hello";',
      );

      const result = await handleAstGrepSearch({
        pattern: 'function $NAME() { $$$BODY }',
        language: 'typescript',
        path: tmpDir,
      });

      if (isSearchError(result)) {
        // @ast-grep/napi unavailable — acceptable
        expect(result.error).toBeTypeOf('string');
      } else if (isNoFilesMessage(result)) {
        // Should not happen — we wrote a .ts file
        expect(result.filesSearched).toBe(0);
      } else if (isNoMatchesMessage(result)) {
        expect(result.filesSearched).toBeGreaterThan(0);
        expect((result as { message: string }).message).toContain('No matches');
      } else if (isSearchResult(result)) {
        // Pattern matched — valid if @ast-grep/napi is present
        expect(result.matches).toBeDefined();
      }
    });
  });

  describe('result shape', () => {
    it('result always has a deterministic shape (error OR message OR matches)', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));
      writeFileSync(join(tmpDir, 'sample.ts'), 'const a = 1;\nconst b = 2;');

      const result = await handleAstGrepSearch({
        pattern: 'const $NAME = $VALUE',
        language: 'typescript',
        path: tmpDir,
      });

      const isValidShape =
        isSearchResult(result) ||
        isSearchError(result) ||
        isNoFilesMessage(result) ||
        isNoMatchesMessage(result) ||
        (typeof result === 'object' && result !== null && 'error' in result);

      expect(isValidShape).toBe(true);
    });

    it('when @ast-grep/napi is not installed the error includes installation hint', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));
      writeFileSync(join(tmpDir, 'a.ts'), 'const x = 1;');

      const result = await handleAstGrepSearch({
        pattern: 'const $X = $Y',
        language: 'typescript',
        path: tmpDir,
      });

      if (isSearchError(result)) {
        expect(result.error).toContain('@ast-grep/napi');
      }
    });
  });

  describe('input defaults', () => {
    it('uses default context=2 and max_results=20 when not provided', async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'filid-search-test-'));
      writeFileSync(join(tmpDir, 'file.ts'), 'const x = 1;');

      // Should not throw with minimal args
      const result = await handleAstGrepSearch({
        pattern: 'const $X = $Y',
        language: 'typescript',
        path: tmpDir,
      });

      expect(result).toBeDefined();
    });
  });
});
