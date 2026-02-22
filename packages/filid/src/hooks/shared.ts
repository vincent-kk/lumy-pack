/**
 * Shared utilities for hook modules.
 */

/**
 * Check if a file path targets CLAUDE.md.
 */
export function isClaudeMd(filePath: string): boolean {
  return filePath.endsWith('/CLAUDE.md') || filePath === 'CLAUDE.md';
}

/**
 * Check if a file path targets SPEC.md.
 */
export function isSpecMd(filePath: string): boolean {
  return filePath.endsWith('/SPEC.md') || filePath === 'SPEC.md';
}
