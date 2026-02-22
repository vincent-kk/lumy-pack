import type { CategoryType } from '../types/fractal.js';

/**
 * Standard directory names classified as Organ.
 * @deprecated Structure-based classification is now preferred. Use classifyNode() instead.
 */
export const LEGACY_ORGAN_DIR_NAMES: readonly string[] = [
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
 * @deprecated Use LEGACY_ORGAN_DIR_NAMES or structure-based classification via classifyNode().
 */
export const ORGAN_DIR_NAMES = LEGACY_ORGAN_DIR_NAMES;

/**
 * Check if a directory name matches the Organ pattern.
 * Case-sensitive comparison.
 * @deprecated Structure-based classification is preferred. Use classifyNode() with hasFractalChildren and isLeafDirectory.
 */
export function isOrganDirectory(dirName: string): boolean {
  return LEGACY_ORGAN_DIR_NAMES.includes(dirName);
}

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
}

/**
 * Classify a directory as fractal / organ / pure-function based on structure.
 *
 * Priority order:
 * 1. CLAUDE.md exists → fractal (explicit declaration)
 * 2. SPEC.md exists → fractal (documented module boundary)
 * 3. No fractal children + leaf directory → organ
 * 4. No side effects → pure-function
 * 5. Default → fractal (CLAUDE.md should be added)
 *
 * Ambiguous cases should be delegated to LLM via context-injector by the caller.
 */
export function classifyNode(input: ClassifyInput): CategoryType {
  if (input.hasClaudeMd) return 'fractal';
  if (input.hasSpecMd) return 'fractal';
  if (!input.hasFractalChildren && input.isLeafDirectory) return 'organ';
  const hasSideEffects = input.hasSideEffects ?? true;
  if (!hasSideEffects) return 'pure-function';
  return 'fractal';
}
