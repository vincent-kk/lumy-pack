import type { NodeType } from '../types/fractal.js';

/** Standard directory names classified as Organ */
export const ORGAN_DIR_NAMES: readonly string[] = [
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
 * Check if a directory name matches the Organ pattern.
 * Case-sensitive comparison.
 */
export function isOrganDirectory(dirName: string): boolean {
  return ORGAN_DIR_NAMES.includes(dirName);
}

/** Input for classifyNode */
export interface ClassifyInput {
  /** Directory name */
  dirName: string;
  /** Whether CLAUDE.md exists */
  hasClaudeMd: boolean;
  /** Whether SPEC.md exists */
  hasSpecMd: boolean;
  /** Whether located inside a parent fractal */
  isInsideFractal: boolean;
  /** Whether side effects exist (defaults to true if unspecified) */
  hasSideEffects?: boolean;
}

/**
 * Classify a directory as fractal / organ / pure-function.
 *
 * Priority order:
 * 1. CLAUDE.md exists → fractal (explicit declaration)
 * 2. Organ directory pattern match → organ
 * 3. No side effects → pure-function
 * 4. Default → fractal (needs CLAUDE.md added)
 */
export function classifyNode(input: ClassifyInput): NodeType {
  // Rule 1: CLAUDE.md presence makes it explicitly fractal
  if (input.hasClaudeMd) {
    return 'fractal';
  }

  // Rule 2: Organ directory name pattern match
  if (isOrganDirectory(input.dirName)) {
    return 'organ';
  }

  // Rule 3: No side effects means pure-function module
  const hasSideEffects = input.hasSideEffects ?? true;
  if (!hasSideEffects) {
    return 'pure-function';
  }

  // Rule 4: Default — fractal (CLAUDE.md should be added)
  return 'fractal';
}
