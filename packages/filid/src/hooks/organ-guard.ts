import type { PreToolUseInput, HookOutput } from '../types/hooks.js';
import { isOrganDirectory } from '../core/organ-classifier.js';

/**
 * Extract the parent directory name from a file path.
 */
function getParentSegments(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter((p) => p.length > 0);
  // Remove the filename, return directory segments
  return parts.slice(0, -1);
}

/**
 * Check if a file path targets CLAUDE.md.
 */
function isClaudeMd(filePath: string): boolean {
  return filePath.endsWith('/CLAUDE.md') || filePath === 'CLAUDE.md';
}

/**
 * PreToolUse hook: block CLAUDE.md creation inside organ directories.
 *
 * Organ directories (components, utils, types, hooks, helpers, lib,
 * styles, assets, constants) should not have their own CLAUDE.md
 * because they are leaf-level compartments in FCA-AI architecture.
 *
 * Only Write tool creating CLAUDE.md is checked; Edit passes through.
 */
export function guardOrganWrite(input: PreToolUseInput): HookOutput {
  // Only guard Write tool
  if (input.tool_name !== 'Write') {
    return { continue: true };
  }

  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';

  // Only check CLAUDE.md files
  if (!isClaudeMd(filePath)) {
    return { continue: true };
  }

  // Check if any parent directory is an organ directory
  const segments = getParentSegments(filePath);
  for (const segment of segments) {
    if (isOrganDirectory(segment)) {
      return {
        continue: false,
        hookSpecificOutput: {
          additionalContext: `BLOCKED: Cannot create CLAUDE.md inside organ directory "${segment}". Organ directories are leaf-level compartments and should not have their own CLAUDE.md.`,
        },
      };
    }
  }

  return { continue: true };
}
