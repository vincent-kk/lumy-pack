/**
 * Shared utilities for hook modules.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check if the cwd is an FCA-AI project.
 * Treats presence of .filid/ directory or CLAUDE.md as indicator.
 */
export function isFcaProject(cwd: string): boolean {
  return existsSync(join(cwd, '.filid')) || existsSync(join(cwd, 'CLAUDE.md'));
}

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
