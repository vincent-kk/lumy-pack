import { validateClaudeMd } from '../core/document-validator.js';
import { validateSpecMd } from '../core/document-validator.js';
import type { HookOutput, PreToolUseInput } from '../types/hooks.js';

import { isClaudeMd, isSpecMd } from './shared.js';

export { isSpecMd } from './shared.js';

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
 * For Edit tool targeting CLAUDE.md:
 * - Warns when new_string exceeds 20 lines (partial edits cannot be validated for line limit)
 */
export function validatePreToolUse(
  input: PreToolUseInput,
  oldSpecContent?: string,
): HookOutput {
  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';

  // Edit targeting CLAUDE.md: 대규모 편집(>20줄) 시 경고 주입 (차단하지 않음)
  if (input.tool_name === 'Edit' && isClaudeMd(filePath)) {
    const newString = (input.tool_input.new_string as string) ?? '';
    const lineCount = newString.split('\n').length;
    if (lineCount > 20) {
      return {
        continue: true,
        hookSpecificOutput: {
          additionalContext:
            `Note: Editing CLAUDE.md via Edit tool with ${lineCount} new lines — ` +
            'line limit (100) cannot be enforced on partial edits. ' +
            'Verify the final line count does not exceed 100 lines after editing.',
        },
      };
    }
    return { continue: true };
  }

  const content = input.tool_input.content;

  // Write만 검증 (Edit은 위에서 처리됨)
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
