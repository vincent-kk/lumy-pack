import { filter, isTruthy } from '@winglet/common-utils';

import type { RepoIdentity } from '../../cache/index.js';
import { ShardedCache } from '../../cache/index.js';
import { gitExec, shellExec } from '../../git/executor.js';
import type { GitExecOptions } from '../../types/index.js';

export interface PatchIdResult {
  matchedSha: string;
  patchId: string;
}

const DEFAULT_SCAN_DEPTH = 500;

const cacheRegistry = new Map<string, ShardedCache<string>>();

function repoKey(repoId: RepoIdentity): string {
  return `${repoId.host}/${repoId.owner}/${repoId.repo}`;
}

function getCache(repoId?: RepoIdentity, noCache?: boolean): ShardedCache<string> {
  if (noCache) {
    return new ShardedCache<string>('patch-id', { repoId, enabled: false });
  }
  const key = repoKey(repoId ?? { host: '_local', owner: '_', repo: '_default' });
  let cache = cacheRegistry.get(key);
  if (!cache) {
    cache = new ShardedCache<string>('patch-id', { repoId });
    cacheRegistry.set(key, cache);
  }
  return cache;
}

export interface PatchIdOptions extends GitExecOptions {
  noCache?: boolean;
  repoId?: RepoIdentity;
}

export async function computePatchId(
  commitSha: string,
  options?: PatchIdOptions,
): Promise<string | null> {
  const cache = getCache(options?.repoId, options?.noCache);
  const cached = await cache.get(commitSha);
  if (cached) return cached;

  try {
    const cwd = options?.cwd ?? '.';
    const result = await shellExec(
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
  options?: PatchIdOptions & { scanDepth?: number; ref?: string },
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

    const candidates = filter(logResult.stdout.trim().split('\n'), isTruthy);

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
  cacheRegistry.clear();
}
