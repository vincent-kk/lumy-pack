import type { RepoIdentity } from '../../cache/index.js';
import { ShardedCache } from '../../cache/index.js';
import type {
  GitExecOptions,
  PRInfo,
  PlatformAdapter,
} from '../../types/index.js';
import {
  extractPRFromMergeMessage,
  findMergeCommit,
} from '../ancestry/index.js';
import { findPatchIdMatch } from '../patch-id/index.js';

const cacheRegistry = new Map<string, ShardedCache<PRInfo>>();

function repoKey(repoId: RepoIdentity): string {
  return `${repoId.host}/${repoId.owner}/${repoId.repo}`;
}

function getCache(
  repoId?: RepoIdentity,
  noCache?: boolean,
): ShardedCache<PRInfo> {
  if (noCache) {
    return new ShardedCache<PRInfo>('pr', { repoId, enabled: false });
  }
  const key = repoKey(
    repoId ?? { host: '_local', owner: '_', repo: '_default' },
  );
  let cache = cacheRegistry.get(key);
  if (!cache) {
    cache = new ShardedCache<PRInfo>('pr', { repoId });
    cacheRegistry.set(key, cache);
  }
  return cache;
}

export interface PRLookupOptions extends GitExecOptions {
  noCache?: boolean;
  deep?: boolean;
  repoId?: RepoIdentity;
}

const DEEP_SCAN_DEPTH = 2000;

export async function lookupPR(
  commitSha: string,
  adapter: PlatformAdapter | null,
  options?: PRLookupOptions,
): Promise<PRInfo | null> {
  const cache = getCache(options?.repoId, options?.noCache);
  const cached = await cache.get(commitSha);
  if (cached) return cached;

  let mergeBasedPR: PRInfo | null = null;
  const mergeResult = await findMergeCommit(commitSha, options);
  if (mergeResult) {
    const prNumber = extractPRFromMergeMessage(mergeResult.subject);
    if (prNumber) {
      if (adapter) {
        const prInfo = await adapter.getPRForCommit(mergeResult.mergeCommitSha);
        if (prInfo?.mergedAt) {
          mergeBasedPR = prInfo;
        }
      }

      if (!mergeBasedPR) {
        mergeBasedPR = {
          number: prNumber,
          title: mergeResult.subject,
          author: '',
          url: '',
          mergeCommit: mergeResult.mergeCommitSha,
          baseBranch: '',
        };
      }

      if (!options?.deep || mergeBasedPR.mergedAt) {
        await cache.set(commitSha, mergeBasedPR);
        return mergeBasedPR;
      }
    }
  }

  const patchIdMatch = await findPatchIdMatch(commitSha, {
    ...options,
    scanDepth: options?.deep ? DEEP_SCAN_DEPTH : undefined,
  });
  if (patchIdMatch) {
    const result = await lookupPR(patchIdMatch.matchedSha, adapter, options);
    if (result) {
      await cache.set(commitSha, result);
      return result;
    }
  }

  if (mergeBasedPR) {
    await cache.set(commitSha, mergeBasedPR);
    return mergeBasedPR;
  }

  if (adapter) {
    const prInfo = await adapter.getPRForCommit(commitSha);
    if (prInfo?.mergedAt) {
      await cache.set(commitSha, prInfo);
      return prInfo;
    }
  }

  return null;
}

export function resetPRCache(): void {
  cacheRegistry.clear();
}
