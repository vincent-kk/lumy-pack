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
import { homedir } from 'node:os';
import { join } from 'node:path';

// Cache directory layout:
//   {cwdHash}/session-context-{hash}   — Layer 2: session inject marker (24h TTL)
//   {cwdHash}/cached-context-{hash}    — Layer 2: per-session FCA rules text cache
//   {cwdHash}/run-{skillName}.hash     — Layer 4: skill run hash for incremental mode

export function cwdHash(cwd: string): string {
  return createHash('sha256').update(cwd).digest('hex').slice(0, 12);
}

export function getCacheDir(cwd: string): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  return join(configDir, 'plugins', 'filid', cwdHash(cwd));
}

export function readCachedContext(
  cwd: string,
  sessionId: string,
): string | null {
  const cacheDir = getCacheDir(cwd);
  const contextFile = join(
    cacheDir,
    `cached-context-${sessionIdHash(sessionId)}`,
  );
  try {
    if (!existsSync(contextFile)) return null;
    return readFileSync(contextFile, 'utf-8');
  } catch {
    return null;
  }
}

export function writeCachedContext(
  cwd: string,
  context: string,
  sessionId: string,
): void {
  const cacheDir = getCacheDir(cwd);
  const contextFile = join(
    cacheDir,
    `cached-context-${sessionIdHash(sessionId)}`,
  );
  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(contextFile, context, 'utf-8');
  } catch {
    // silently ignore cache write failures
  }
}

export function sessionIdHash(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 12);
}

export function isFirstInSession(sessionId: string, cwd: string): boolean {
  const marker = join(
    getCacheDir(cwd),
    `session-context-${sessionIdHash(sessionId)}`,
  );
  try {
    return !existsSync(marker);
  } catch {
    return true;
  }
}

export function pruneOldSessions(cwd: string): void {
  try {
    const dir = getCacheDir(cwd);
    const files = readdirSync(dir);
    const sessionFiles = files.filter((f) => f.startsWith('session-context-'));
    if (sessionFiles.length <= 10) return;
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000;
    for (const file of sessionFiles) {
      const fp = join(dir, file);
      try {
        if (now - statSync(fp).mtimeMs > TTL_MS) {
          unlinkSync(fp);
          // also remove the paired cached-context file
          const hash = file.replace('session-context-', '');
          const contextFp = join(dir, `cached-context-${hash}`);
          try {
            if (existsSync(contextFp)) unlinkSync(contextFp);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore individual file deletion failures
      }
    }
  } catch {
    // ignore directory read failures
  }
}

export function removeSessionFiles(sessionId: string, cwd: string): void {
  const cacheDir = getCacheDir(cwd);
  const hash = sessionIdHash(sessionId);
  const marker = join(cacheDir, `session-context-${hash}`);
  const contextFile = join(cacheDir, `cached-context-${hash}`);
  try {
    if (existsSync(marker)) unlinkSync(marker);
  } catch {
    // silently ignore deletion failures
  }
  try {
    if (existsSync(contextFile)) unlinkSync(contextFile);
  } catch {
    // silently ignore deletion failures
  }
}

export function markSessionInjected(sessionId: string, cwd: string): void {
  const cacheDir = getCacheDir(cwd);
  const marker = join(cacheDir, `session-context-${sessionIdHash(sessionId)}`);
  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(marker, '', 'utf-8');
    pruneOldSessions(cwd);
  } catch {
    // silently ignore marker write failures
  }
}

export function saveRunHash(
  cwd: string,
  skillName: string,
  hash: string,
): void {
  const cacheDir = getCacheDir(cwd);
  const hashFile = join(cacheDir, `run-${skillName}.hash`);
  try {
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    writeFileSync(hashFile, hash, 'utf-8');
  } catch {
    // silently ignore hash write failures
  }
}

export function getLastRunHash(cwd: string, skillName: string): string | null {
  const cacheDir = getCacheDir(cwd);
  const hashFile = join(cacheDir, `run-${skillName}.hash`);
  try {
    return readFileSync(hashFile, 'utf-8').trim();
  } catch {
    return null;
  }
}
