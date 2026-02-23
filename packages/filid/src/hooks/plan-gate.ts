import type { HookOutput, PreToolUseInput } from '../types/hooks.js';

import { isFcaProject } from './shared.js';

const PLAN_EXIT_CHECKLIST = [
  '[FCA-AI Plan Compliance Checklist]',
  'Before implementation, ensure the plan includes:',
  '1. CLAUDE.md/SPEC.md updates for ALL affected fractal modules',
  '2. SPEC.md updates BEFORE code changes (spec-driven)',
  '3. CLAUDE.md boundary updates if module responsibilities change',
  '4. New fractal modules: CLAUDE.md (max 100 lines, 3-tier) + SPEC.md',
  'If missing, revise the plan to include document update steps.',
].join('\n');

/**
 * PreToolUse hook for ExitPlanMode: inject FCA-AI document update checklist.
 *
 * When a plan is being finalized (ExitPlanMode), this hook reminds Claude
 * to include CLAUDE.md/SPEC.md update steps in the plan.
 *
 * Never blocks (always continue: true). Only injects context in FCA projects.
 */
export function validatePlanExit(input: PreToolUseInput): HookOutput {
  if (!isFcaProject(input.cwd)) {
    return { continue: true };
  }

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: PLAN_EXIT_CHECKLIST,
    },
  };
}
