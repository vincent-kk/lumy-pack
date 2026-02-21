import type { PreToolUseInput, HookOutput } from '../types/hooks.js';
import { validateClaudeMd } from '../core/document-validator.js';
import { validateSpecMd } from '../core/document-validator.js';

/**
 * Check if a file path targets CLAUDE.md.
 */
function isClaudeMd(filePath: string): boolean {
  return filePath.endsWith('/CLAUDE.md') || filePath === 'CLAUDE.md';
}

/**
 * Check if a file path targets SPEC.md.
 */
function isSpecMd(filePath: string): boolean {
  return filePath.endsWith('/SPEC.md') || filePath === 'SPEC.md';
}

/**
 * PreToolUse hook logic for CLAUDE.md/SPEC.md validation.
 *
 * For Write tool targeting CLAUDE.md:
 * - Blocks if content exceeds 100-line limit (error)
 * - Warns if missing 3-tier boundary sections (warning, no block)
 *
 * For Write tool targeting SPEC.md:
 * - Blocks if detected as append-only (when oldSpecContent provided)
 *
 * For Edit tool: partial edits cannot be validated for line limit,
 * so they pass through.
 */
export function validatePreToolUse(
  input: PreToolUseInput,
  oldSpecContent?: string,
): HookOutput {
  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';
  const content = input.tool_input.content;

  // Only validate Write tool with full content
  if (input.tool_name !== 'Write' || !content) {
    return { continue: true };
  }

  // CLAUDE.md validation
  if (isClaudeMd(filePath)) {
    const result = validateClaudeMd(content);

    if (!result.valid) {
      const errorMessages = result.violations
        .filter((v) => v.severity === 'error')
        .map((v) => v.message)
        .join('; ');
      return {
        continue: false,
        hookSpecificOutput: {
          additionalContext: `BLOCKED: ${errorMessages}`,
        },
      };
    }

    // Check for warnings (don't block, but inform)
    const warnings = result.violations.filter((v) => v.severity === 'warning');
    if (warnings.length > 0) {
      return {
        continue: true,
        hookSpecificOutput: {
          additionalContext: warnings.map((w) => w.message).join('; '),
        },
      };
    }

    return { continue: true };
  }

  // SPEC.md validation
  if (isSpecMd(filePath) && oldSpecContent !== undefined) {
    const result = validateSpecMd(content, oldSpecContent);

    if (!result.valid) {
      const errorMessages = result.violations
        .filter((v) => v.severity === 'error')
        .map((v) => v.message)
        .join('; ');
      return {
        continue: false,
        hookSpecificOutput: {
          additionalContext: `BLOCKED: ${errorMessages}`,
        },
      };
    }
  }

  return { continue: true };
}
