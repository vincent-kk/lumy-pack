import type { CategoryType } from '../types/fractal.js';

/** Internal base list of UI/shared organ directory names (not exported). */
const ORGAN_BASE_NAMES: readonly string[] = [
  'components',
  'utils',
  'types',
  'hooks',
  'helpers',
  'lib',
  'styles',
  'assets',
  'constants',
] as const;

/**
 * Well-known directory names that are always classified as organ regardless of structure.
 *
 * Note: __*__ and .* naming patterns are handled separately by
 * isInfraOrgDirectoryByPattern and are intentionally not duplicated here.
 */
export const KNOWN_ORGAN_DIR_NAMES: readonly string[] = [
  ...ORGAN_BASE_NAMES,
  'test',
  'tests',
  'spec',
  'specs',
  'fixtures',
  'e2e',
] as const;

/** Input for classifyNode */
export interface ClassifyInput {
  /** Directory name */
  dirName: string;
  /** Whether CLAUDE.md exists */
  hasClaudeMd: boolean;
  /** Whether SPEC.md exists */
  hasSpecMd: boolean;
  /** Whether the directory contains fractal child directories */
  hasFractalChildren: boolean;
  /** Whether this is a leaf directory (no subdirectories) */
  isLeafDirectory: boolean;
  /** Whether side effects exist (defaults to true if unspecified) */
  hasSideEffects?: boolean;
  /** index.ts/js/mjs/cjs 파일 존재 여부. 존재 시 fractal 모듈 진입점으로 간주 */
  hasIndex?: boolean;
}

/**
 * Return true for directory names that are always organ by naming convention:
 * - `__name__` (double-underscore wrapped): test/mock/fixture infrastructure
 * - `.name` (dot-prefixed): hidden/tooling directories (e.g. .git, .github, .vscode)
 */
export function isInfraOrgDirectoryByPattern(dirName: string): boolean {
  const isDoubleUnderscore =
    dirName.startsWith('__') && dirName.endsWith('__') && dirName.length > 4;
  const isDotPrefixed = dirName.startsWith('.');
  return isDoubleUnderscore || isDotPrefixed;
}

/**
 * Classify a directory as fractal / organ / pure-function based on structure.
 *
 * Priority order:
 * 1. CLAUDE.md exists → fractal (explicit declaration)
 * 2. SPEC.md exists → fractal (documented module boundary)
 * 3. Name matches __*__ or .* pattern → organ (infrastructure convention)
 * 4. Directory name in KNOWN_ORGAN_DIR_NAMES → organ (name-based, overrides structure)
 * 5. No fractal children + leaf directory → organ
 * 6. No side effects → pure-function
 * 7. Default → fractal (CLAUDE.md should be added)
 *
 * Ambiguous cases should be delegated to LLM via context-injector by the caller.
 */
export function classifyNode(input: ClassifyInput): CategoryType {
  if (input.hasClaudeMd) return 'fractal';
  if (input.hasSpecMd) return 'fractal';
  if (isInfraOrgDirectoryByPattern(input.dirName)) return 'organ';
  if (KNOWN_ORGAN_DIR_NAMES.includes(input.dirName)) return 'organ';
  // NEW: index 파일이 있는 non-organ, non-infra 디렉토리 = 프렉탈 모듈 진입점
  if (
    (input.hasIndex ?? false) &&
    !KNOWN_ORGAN_DIR_NAMES.includes(input.dirName) &&
    !isInfraOrgDirectoryByPattern(input.dirName)
  )
    return 'fractal';
  if (!input.hasFractalChildren && input.isLeafDirectory) return 'organ';
  const hasSideEffects = input.hasSideEffects ?? true;
  if (!hasSideEffects) return 'pure-function';
  return 'fractal';
}
