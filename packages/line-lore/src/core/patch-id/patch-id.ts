import { filter, isTruthy } from '@winglet/common-utils';

import type { RepoIdentity } from '../../cache/index.js';
import { ShardedCache } from '../../cache/index.js';
import { gitPipe } from '../../git/executor.js';
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

function getCache(
  repoId?: RepoIdentity,
  noCache?: boolean,
): ShardedCache<string> {
  if (noCache) {
    return new ShardedCache<string>('patch-id', { repoId, enabled: false });
  }
  const key = repoKey(
    repoId ?? { host: '_local', owner: '_', repo: '_default' },
  );
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
    const result = await gitPipe(
      ['diff', `${commitSha}^..${commitSha}`],
      ['patch-id', '--stable'],
      { cwd: options?.cwd, timeout: options?.timeout },
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
    // Batch compute all candidate patch-ids in a single streaming pipe
    const result = await gitPipe(
      ['log', `-${scanDepth}`, '-p', ref],
      ['patch-id', '--stable'],
      { cwd: options?.cwd, timeout: options?.timeout ?? 60_000 },
    );

    const lines = filter(result.stdout.trim().split('\n'), isTruthy);
    const cache = getCache(options?.repoId, options?.noCache);

    for (const line of lines) {
      const [patchId, candidateSha] = line.split(/\s+/);
      if (!patchId || !candidateSha) continue;

      await cache.set(candidateSha, patchId);

      if (candidateSha !== commitSha && patchId === targetPatchId) {
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
