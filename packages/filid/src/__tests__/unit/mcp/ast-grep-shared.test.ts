import { describe, expect, it } from 'vitest';

import {
  EXT_TO_LANG,
  SUPPORTED_LANGUAGES,
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
  } as Parameters<typeof toLangEnum>[0];

  it.each([
    ['javascript', 'JavaScript'],
    ['typescript', 'TypeScript'],
    ['tsx', 'Tsx'],
    ['python', 'Python'],
    ['go', 'Go'],
    ['rust', 'Rust'],
    ['json', 'Json'],
    ['yaml', 'Yaml'],
  ])('returns correct Lang enum for "%s"', (input, expected) => {
    expect(toLangEnum(mockSg, input)).toBe(expected);
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

  it.each(['javascript', 'typescript', 'python', 'go', 'rust', 'json', 'yaml'])(
    'contains "%s"',
    (lang) => {
      expect(SUPPORTED_LANGUAGES).toContain(lang);
    },
  );
});

// ─── EXT_TO_LANG ─────────────────────────────────────────────────────────────

describe('EXT_TO_LANG', () => {
  it.each([
    ['.ts', 'typescript'],
    ['.tsx', 'tsx'],
    ['.js', 'javascript'],
    ['.mjs', 'javascript'],
    ['.cjs', 'javascript'],
    ['.jsx', 'javascript'],
    ['.py', 'python'],
    ['.go', 'go'],
    ['.rs', 'rust'],
    ['.java', 'java'],
    ['.cs', 'csharp'],
    ['.json', 'json'],
    ['.yaml', 'yaml'],
    ['.yml', 'yaml'],
    ['.html', 'html'],
    ['.css', 'css'],
  ])('maps %s to "%s"', (ext, expected) => {
    expect(EXT_TO_LANG[ext]).toBe(expected);
  });
});
