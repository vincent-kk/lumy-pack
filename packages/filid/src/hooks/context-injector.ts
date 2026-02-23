/**
 * context-injector.ts — UserPromptSubmit hook for FCA-AI context injection.
 *
 * Layer Architecture:
 *
 * Layer 1 (SessionStart hook) — NOT IMPLEMENTED
 *   - Role: Prepare context assets at session start (e.g., compute fractal tree)
 *   - Would write: {cwdHash}/context-text  (plain text, pre-computed content)
 *   - Integration point: hooks/entries/session-start.entry.ts (future)
 *   - Status: Architecture reserved, content unspecified, implementation deferred
 *
 * Layer 2 (UserPromptSubmit hook) — THIS FILE
 *   - Role: Inject FCA-AI rules + fractal structure rules on session's first prompt
 *   - Session gate: session-{sessionIdHash} marker file in cache directory
 *   - Cache: content hash-based invalidation (no TTL)
 *
 * Cache functions are provided by src/core/cache-manager.ts.
 */
import {
  isFirstInSession,
  markSessionInjected,
  readCachedContext,
  writeCachedContext,
} from '../core/cache-manager.js';
import { getActiveRules, loadBuiltinRules } from '../core/rule-engine.js';
import type { HookOutput, UserPromptSubmitInput } from '../types/hooks.js';

import { isFcaProject } from './shared.js';

const CATEGORY_GUIDE = [
  '- fractal: independent module with CLAUDE.md or SPEC.md',
  '- organ: leaf directory with no fractal children',
  '- pure-function: collection of pure functions with no side effects',
  '- hybrid: transitional node with both fractal and organ characteristics',
].join('\n');

/**
 * Builds the FCA-AI rules text to inject into Claude's context.
 */
function buildFcaContext(cwd: string): string {
  return [
    `[FCA-AI] Active in: ${cwd}`,
    'Rules:',
    '- CLAUDE.md: max 100 lines, must include 3-tier boundary sections',
    '- SPEC.md: no append-only growth, must restructure on updates',
    '- Organ directories (auto-classified by structure analysis) must NOT have CLAUDE.md',
    '- Test files: max 15 cases per spec.ts (3 basic + 12 complex)',
    '- LCOM4 >= 2 → split module, CC > 15 → compress/abstract',
    '',
    'Development Workflow:',
    '- When planning, include CLAUDE.md/SPEC.md updates for affected fractal modules',
    '- Update SPEC.md (requirements) BEFORE code, CLAUDE.md when boundaries change',
  ].join('\n');
}

/**
 * UserPromptSubmit hook: inject FCA-AI context reminders.
 *
 * Injects FCA-AI rules only on the first prompt of each session.
 * Subsequent prompts return { continue: true } immediately.
 *
 * Never blocks user prompts (always continue: true).
 */
export async function injectContext(
  input: UserPromptSubmitInput,
): Promise<HookOutput> {
  const { cwd, session_id } = input;

  // Gate 1: skip if not an FCA-AI project
  if (!isFcaProject(cwd)) {
    return { continue: true };
  }

  // Gate 2: skip if not the first prompt in this session
  if (!isFirstInSession(session_id, cwd)) {
    return { continue: true };
  }

  // use cached context if content hash matches
  const cached = readCachedContext(cwd);
  if (cached) {
    markSessionInjected(session_id, cwd);
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: cached },
    };
  }

  // Step 1: FCA-AI rules (always included)
  const fcaContext = buildFcaContext(cwd);

  // Step 2: fractal rules section (rule list + category guide only, no scan)
  let fractalSection = '';
  try {
    const rules = getActiveRules(loadBuiltinRules());
    const rulesText = rules
      .map((r) => `- ${r.id}: ${r.description}`)
      .join('\n');

    fractalSection = [
      '',
      '[filid] Fractal Structure Rules:',
      rulesText,
      '',
      'Category Classification:',
      CATEGORY_GUIDE,
    ].join('\n');
  } catch {
    // on rule load failure, omit fractal section and return FCA-AI rules only
  }

  const additionalContext = (fcaContext + fractalSection).trim();

  // persist cache and record session marker
  writeCachedContext(cwd, additionalContext);
  markSessionInjected(session_id, cwd);

  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext,
    },
  };
}
