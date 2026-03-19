import { execa } from 'execa';

import { FileCache } from '../../cache/file-cache.js';
import { gitExec } from '../../git/executor.js';
import type { GitExecOptions } from '../../types/index.js';

export interface PatchIdResult {
  matchedSha: string;
  patchId: string;
}

const DEFAULT_SCAN_DEPTH = 500;

let patchIdCache: FileCache<string> | null = null;

function getCache(): FileCache<string> {
  if (!patchIdCache) {
    patchIdCache = new FileCache<string>('sha-to-patch-id.json');
  }
  return patchIdCache;
}

export async function computePatchId(
  commitSha: string,
  options?: GitExecOptions,
): Promise<string | null> {
  const cache = getCache();
  const cached = await cache.get(commitSha);
  if (cached) return cached;

  try {
    const cwd = options?.cwd ?? '.';
    const result = await execa(
      'bash',
      [
        '-c',
        `git -C "${cwd}" diff "${commitSha}^..${commitSha}" | git patch-id --stable`,
      ],
      { timeout: options?.timeout },
    );

    const patchId = result.stdout.trim().split(/\s+/)[0];
    if (!patchId) return null;

    await cache.set(commitSha, patchId);
    return patchId;
  } catch {
    return null;
  }
}

export async function findPatchIdMatch(
  commitSha: string,
  options?: GitExecOptions & { scanDepth?: number; ref?: string },
): Promise<PatchIdResult | null> {
  const scanDepth = options?.scanDepth ?? DEFAULT_SCAN_DEPTH;
  const ref = options?.ref ?? 'HEAD';

  const targetPatchId = await computePatchId(commitSha, options);
  if (!targetPatchId) return null;

  try {
    // Get recent commits on main branch
    const logResult = await gitExec(
      ['log', '--format=%H', `-${scanDepth}`, ref],
      { cwd: options?.cwd, timeout: options?.timeout },
    );

    const candidates = logResult.stdout.trim().split('\n').filter(Boolean);

    for (const candidateSha of candidates) {
      if (candidateSha === commitSha) continue;

      const candidatePatchId = await computePatchId(candidateSha, options);
      if (candidatePatchId && candidatePatchId === targetPatchId) {
        return { matchedSha: candidateSha, patchId: targetPatchId };
      }
    }
  } catch {
    // Scan failed — return null for API fallback
  }

  return null;
}

export function resetPatchIdCache(): void {
  patchIdCache = null;
}
