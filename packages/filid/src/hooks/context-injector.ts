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
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { getActiveRules, loadBuiltinRules } from '../core/rule-engine.js';
import type { HookOutput, UserPromptSubmitInput } from '../types/hooks.js';

function cwdHash(cwd: string): string {
  return createHash('sha256').update(cwd).digest('hex').slice(0, 12);
}

function getCacheDir(cwd: string): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  return join(configDir, 'plugins', 'filid', cwdHash(cwd));
}

// Cache directory layout:
//   {cwdHash}/cached-context.txt  -- Layer 2: FCA rules text cache
//   {cwdHash}/timestamp           -- Layer 2: content hash for version-based invalidation (no TTL)
//   {cwdHash}/session-{hash}      -- Layer 2: session inject marker (auto-purged after 24h)
//   {cwdHash}/context-text        -- Layer 1: reserved for future use (not implemented)

function readCachedContext(cwd: string): string | null {
  const cacheDir = getCacheDir(cwd);
  const stampFile = join(cacheDir, 'timestamp');
  const contextFile = join(cacheDir, 'cached-context.txt');

  try {
    if (!existsSync(stampFile) || !existsSync(contextFile)) return null;
    const savedHash = readFileSync(stampFile, 'utf-8').trim();
    const context = readFileSync(contextFile, 'utf-8');
    const currentHash = createHash('sha256').update(context).digest('hex').slice(0, 8);
    if (savedHash !== currentHash) return null; // hash mismatch — regenerate cache
    return context;
  } catch {
    return null;
  }
}

function writeCachedContext(cwd: string, context: string): void {
  const cacheDir = getCacheDir(cwd);
  const stampFile = join(cacheDir, 'timestamp');
  const contextFile = join(cacheDir, 'cached-context.txt');

  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(contextFile, context, 'utf-8');
    const hash = createHash('sha256').update(context).digest('hex').slice(0, 8);
    writeFileSync(stampFile, hash, 'utf-8');
  } catch {
    // silently ignore cache write failures
  }
}

function sessionIdHash(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
}

function isFirstInSession(sessionId: string, cwd: string): boolean {
  const marker = join(getCacheDir(cwd), `session-${sessionIdHash(sessionId)}`);
  try {
    return !existsSync(marker);
  } catch {
    return true; // on I/O error, fall back to inject (safe direction)
  }
}

function pruneOldSessions(cwd: string): void {
  try {
    const dir = getCacheDir(cwd);
    const files = readdirSync(dir);
    const sessionFiles = files.filter((f) => f.startsWith('session-'));
    if (sessionFiles.length <= 10) return; // threshold guard: skip pruning when 10 or fewer session files
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    for (const file of sessionFiles) {
      const fp = join(dir, file);
      try {
        if (now - statSync(fp).mtimeMs > TTL_MS) unlinkSync(fp);
      } catch {
        // ignore individual file deletion failures
      }
    }
  } catch {
    // ignore directory read failures
  }
}

function markSessionInjected(sessionId: string, cwd: string): void {
  const cacheDir = getCacheDir(cwd);
  const marker = join(cacheDir, `session-${sessionIdHash(sessionId)}`);
  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(marker, '', 'utf-8');
    pruneOldSessions(cwd);
  } catch {
    // silently ignore marker write failures
  }
}

const CATEGORY_GUIDE = [
  '- fractal: independent module with CLAUDE.md or SPEC.md',
  '- organ: leaf directory with no fractal children',
  '- pure-function: collection of pure functions with no side effects',
  '- hybrid: transitional node with both fractal and organ characteristics',
].join('\n');

/**
 * Returns true if the cwd is an FCA-AI project.
 * Treats presence of .filid/ directory or CLAUDE.md as indicator.
 *
 * Edge case: returns false before /filid:init on new projects (intentional).
 * The init skill loads rules from its own SKILL.md and does not rely on hook context.
 */
function isFcaProject(cwd: string): boolean {
  return existsSync(join(cwd, '.filid')) || existsSync(join(cwd, 'CLAUDE.md'));
}

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
