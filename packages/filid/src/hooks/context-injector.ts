import type { UserPromptSubmitInput, HookOutput } from '../types/hooks.js';

/**
 * UserPromptSubmit hook: inject FCA-AI context reminders.
 *
 * On every user prompt, inject a lightweight reminder of FCA-AI
 * architectural rules. Claude Code handles CLAUDE.md chain loading
 * natively, so this hook only provides rule awareness — not
 * document content.
 *
 * Never blocks user prompts (always continue: true).
 */
export function injectContext(input: UserPromptSubmitInput): HookOutput {
  const cwd = input.cwd;

  const context = [
    `[FCA-AI] Active in: ${cwd}`,
    'Rules:',
    '- CLAUDE.md: max 100 lines, must include 3-tier boundary sections',
    '- SPEC.md: no append-only growth, must restructure on updates',
    '- Organ directories (components, utils, types, hooks, helpers, lib, styles, assets, constants) must NOT have CLAUDE.md',
    '- Test files: max 15 cases per spec.ts (3 basic + 12 complex)',
    '- LCOM4 >= 2 → split module, CC > 15 → compress/abstract',
  ].join('\n');

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: context,
    },
  };
}
