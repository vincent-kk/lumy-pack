import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  EXT_TO_LANG,
  SUPPORTED_LANGUAGES,
  formatMatch,
  getFilesForLanguage,
  getSgLoadError,
  getSgModule,
  toLangEnum,
} from '../../../ast/ast-grep-shared.js';

// ─── getSgModule ──────────────────────────────────────────────────────────────

describe('getSgModule', () => {
  it('returns null or an object (graceful degradation when @ast-grep/napi not installed)', async () => {
    const sg = await getSgModule();
    // @ast-grep/napi is an optionalDependency; in this environment it is not installed
    // so getSgModule() should return null
    expect(sg === null || typeof sg === 'object').toBe(true);
  });

  it('returns null and records error when @ast-grep/napi is unavailable', async () => {
    const sg = await getSgModule();
    if (sg === null) {
      // When the module is missing, getSgLoadError() should return a non-empty string
      expect(getSgLoadError()).toBeTypeOf('string');
    } else {
      // Module is available — error string should be empty
      expect(getSgLoadError()).toBe('');
    }
  });
});

// ─── getSgLoadError ───────────────────────────────────────────────────────────

describe('getSgLoadError', () => {
  it('returns a string (empty or with error message)', () => {
    const err = getSgLoadError();
    expect(typeof err).toBe('string');
  });
});

// ─── toLangEnum ───────────────────────────────────────────────────────────────

describe('toLangEnum', () => {
  // Build a minimal mock sg module that mimics the shape toLangEnum expects
  const mockSg = {
    Lang: {
      JavaScript: 'JavaScript',
      TypeScript: 'TypeScript',
      Tsx: 'Tsx',
      Python: 'Python',
      Ruby: 'Ruby',
      Go: 'Go',
      Rust: 'Rust',
      Java: 'Java',
      Kotlin: 'Kotlin',
      Swift: 'Swift',
      C: 'C',
      Cpp: 'Cpp',
      CSharp: 'CSharp',
      Html: 'Html',
      Css: 'Css',
      Json: 'Json',
      Yaml: 'Yaml',
    },
  };

  it('returns Lang.JavaScript for "javascript"', () => {
    expect(toLangEnum(mockSg, 'javascript')).toBe('JavaScript');
  });

  it('returns Lang.TypeScript for "typescript"', () => {
    expect(toLangEnum(mockSg, 'typescript')).toBe('TypeScript');
  });

  it('returns Lang.Tsx for "tsx"', () => {
    expect(toLangEnum(mockSg, 'tsx')).toBe('Tsx');
  });

  it('returns Lang.Python for "python"', () => {
    expect(toLangEnum(mockSg, 'python')).toBe('Python');
  });

  it('returns Lang.Go for "go"', () => {
    expect(toLangEnum(mockSg, 'go')).toBe('Go');
  });

  it('returns Lang.Rust for "rust"', () => {
    expect(toLangEnum(mockSg, 'rust')).toBe('Rust');
  });

  it('returns Lang.Json for "json"', () => {
    expect(toLangEnum(mockSg, 'json')).toBe('Json');
  });

  it('returns Lang.Yaml for "yaml"', () => {
    expect(toLangEnum(mockSg, 'yaml')).toBe('Yaml');
  });

  it('throws an error for an unsupported language string', () => {
    expect(() => toLangEnum(mockSg, 'cobol')).toThrow(
      'Unsupported language: cobol',
    );
  });

  it('throws an error for an empty language string', () => {
    expect(() => toLangEnum(mockSg, '')).toThrow('Unsupported language:');
  });
});

// ─── SUPPORTED_LANGUAGES ─────────────────────────────────────────────────────

describe('SUPPORTED_LANGUAGES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
  });

  it('contains "javascript"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('javascript');
  });

  it('contains "typescript"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('typescript');
  });

  it('contains "python"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('python');
  });

  it('contains "go"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('go');
  });

  it('contains "rust"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('rust');
  });

  it('contains "json"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('json');
  });

  it('contains "yaml"', () => {
    expect(SUPPORTED_LANGUAGES).toContain('yaml');
  });
});

// ─── EXT_TO_LANG ─────────────────────────────────────────────────────────────

describe('EXT_TO_LANG', () => {
  it('maps .ts to "typescript"', () => {
    expect(EXT_TO_LANG['.ts']).toBe('typescript');
  });

  it('maps .tsx to "tsx"', () => {
    expect(EXT_TO_LANG['.tsx']).toBe('tsx');
  });

  it('maps .js to "javascript"', () => {
    expect(EXT_TO_LANG['.js']).toBe('javascript');
  });

  it('maps .mjs to "javascript"', () => {
    expect(EXT_TO_LANG['.mjs']).toBe('javascript');
  });

  it('maps .cjs to "javascript"', () => {
    expect(EXT_TO_LANG['.cjs']).toBe('javascript');
  });

  it('maps .jsx to "javascript"', () => {
    expect(EXT_TO_LANG['.jsx']).toBe('javascript');
  });

  it('maps .py to "python"', () => {
    expect(EXT_TO_LANG['.py']).toBe('python');
  });

  it('maps .go to "go"', () => {
    expect(EXT_TO_LANG['.go']).toBe('go');
  });

  it('maps .rs to "rust"', () => {
    expect(EXT_TO_LANG['.rs']).toBe('rust');
  });

  it('maps .java to "java"', () => {
    expect(EXT_TO_LANG['.java']).toBe('java');
  });

  it('maps .cs to "csharp"', () => {
    expect(EXT_TO_LANG['.cs']).toBe('csharp');
  });

  it('maps .json to "json"', () => {
    expect(EXT_TO_LANG['.json']).toBe('json');
  });

  it('maps .yaml to "yaml"', () => {
    expect(EXT_TO_LANG['.yaml']).toBe('yaml');
  });

  it('maps .yml to "yaml"', () => {
    expect(EXT_TO_LANG['.yml']).toBe('yaml');
  });

  it('maps .html to "html"', () => {
    expect(EXT_TO_LANG['.html']).toBe('html');
  });

  it('maps .css to "css"', () => {
    expect(EXT_TO_LANG['.css']).toBe('css');
  });
});

// ─── getFilesForLanguage ──────────────────────────────────────────────────────

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

// ─── formatMatch ─────────────────────────────────────────────────────────────

describe('formatMatch', () => {
  const fileContent = [
    'line 1',
    'line 2',
    'const foo = 1;',
    'line 4',
    'line 5',
    'line 6',
    'line 7',
  ].join('\n');

  it('includes the file path and start line in the header', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      0,
      fileContent,
    );
    expect(result).toContain('/path/to/file.ts:3');
  });

  it('marks matched lines with ">" prefix', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      0,
      fileContent,
    );
    expect(result).toMatch(/^>\s+3:/m);
  });

  it('marks non-matched context lines with " " prefix', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      1,
      fileContent,
    );
    // Line 2 (before match) should not have ">"
    expect(result).toMatch(/^ \s+2:/m);
    // Line 4 (after match) should not have ">"
    expect(result).toMatch(/^ \s+4:/m);
  });

  it('shows context lines before and after the match', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      2,
      fileContent,
    );
    // context=2 → lines 1..5 should be present
    expect(result).toContain('line 1');
    expect(result).toContain('line 5');
  });

  it('does not exceed file boundaries when context is large', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'line 1',
      1,
      1,
      10,
      fileContent,
    );
    // Should not throw; just show what is available
    expect(result).toContain('line 1');
  });

  it('includes match content on the matched line', () => {
    const result = formatMatch(
      '/path/to/file.ts',
      'const foo = 1;',
      3,
      3,
      0,
      fileContent,
    );
    expect(result).toContain('const foo = 1;');
  });

  it('formats multi-line matches with all match lines marked ">"', () => {
    const multiContent = 'a\nb\nc\nd\ne';
    // Lines 2-3 are the match (1-indexed)
    const result = formatMatch('/file.ts', 'b\nc', 2, 3, 0, multiContent);
    expect(result).toMatch(/^>\s+2:/m);
    expect(result).toMatch(/^>\s+3:/m);
    expect(result).not.toMatch(/^>\s+1:/m);
    expect(result).not.toMatch(/^>\s+4:/m);
  });

  it('pads line numbers to 4 characters', () => {
    const result = formatMatch('/f.ts', 'line 1', 1, 1, 0, fileContent);
    // Line number 1 should be right-padded to 4 chars: "   1"
    expect(result).toMatch(/\s{3}1:/);
  });
});
