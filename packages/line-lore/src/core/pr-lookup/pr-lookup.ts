import type { RepoIdentity } from '../../cache/index.js';
import { ShardedCache } from '../../cache/index.js';
import type {
  CachedPRInfo,
  GitExecOptions,
  PRInfo,
  PlatformAdapter,
} from '../../types/index.js';
import {
  extractPRFromMergeMessage,
  findMergeCommit,
} from '../ancestry/index.js';
import { findPatchIdMatch } from '../patch-id/index.js';

const cacheRegistry = new Map<string, ShardedCache<CachedPRInfo>>();

function repoKey(repoId: RepoIdentity): string {
  return `${repoId.host}/${repoId.owner}/${repoId.repo}`;
}

function getCache(
  repoId?: RepoIdentity,
  noCache?: boolean,
): ShardedCache<CachedPRInfo> {
  if (noCache) {
    return new ShardedCache<CachedPRInfo>('pr', { repoId, enabled: false });
  }
  const key = repoKey(
    repoId ?? { host: '_local', owner: '_', repo: '_default' },
  );
  let cache = cacheRegistry.get(key);
  if (!cache) {
    cache = new ShardedCache<CachedPRInfo>('pr', { repoId });
    cacheRegistry.set(key, cache);
  }
  return cache;
}

function toCachedPR(pr: PRInfo): CachedPRInfo {
  return {
    number: pr.number,
    title: pr.title,
    author: pr.author,
    url: pr.url,
    mergeCommit: pr.mergeCommit,
    baseBranch: pr.baseBranch,
    mergedAt: pr.mergedAt ? new Date(pr.mergedAt).getTime() : undefined,
  };
}

function fromCachedPR(cached: CachedPRInfo): PRInfo {
  let mergedAt: string | undefined;
  if (cached.mergedAt != null) {
    // Handle both number (new format) and string (legacy ISO format) for backward compatibility
    mergedAt =
      typeof cached.mergedAt === 'number'
        ? new Date(cached.mergedAt).toISOString()
        : String(cached.mergedAt);
  }
  return {
    number: cached.number,
    title: cached.title,
    author: cached.author,
    url: cached.url,
    mergeCommit: cached.mergeCommit,
    baseBranch: cached.baseBranch,
    mergedAt,
  };
}

export interface PRLookupOptions extends GitExecOptions {
  noCache?: boolean;
  /** Return cached results only — skip all fallback strategies */
  cacheOnly?: boolean;
  deep?: boolean;
  repoId?: RepoIdentity;
  /** Skip Strategy 4 (patch-id scan) — set automatically for partial clone environments */
  skipPatchIdScan?: boolean;
}

const DEEP_SCAN_DEPTH = 2000;
const MAX_RECURSION_DEPTH = 2;

export async function lookupPR(
  commitSha: string,
  adapter: PlatformAdapter | null,
  options?: PRLookupOptions,
  /** @internal recursion depth tracker — do not set from external callers */
  _recursionDepth = 0,
): Promise<PRInfo | null> {
  const cache = getCache(
    options?.repoId,
    options?.cacheOnly ? false : options?.noCache,
  );
  const cached = await cache.get(commitSha);
  if (cached) return fromCachedPR(cached);
  if (options?.cacheOnly) return null;

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
        await cache.set(commitSha, toCachedPR(mergeBasedPR));
        return mergeBasedPR;
      }
    }
  }

  if (mergeBasedPR) {
    await cache.set(commitSha, toCachedPR(mergeBasedPR));
    return mergeBasedPR;
  }

  // Strategy 3: API direct lookup (fast single request, try before expensive patch-id scan)
  if (adapter) {
    const prInfo = await adapter.getPRForCommit(commitSha);
    if (prInfo?.mergedAt) {
      await cache.set(commitSha, toCachedPR(prInfo));
      return prInfo;
    }
  }

  // Strategy 4: Patch-ID matching (expensive — streams full log through patch-id)
  // Skip on partial clone environments (blob download risk) or max recursion depth reached
  if (!options?.skipPatchIdScan && _recursionDepth < MAX_RECURSION_DEPTH) {
    const patchIdMatch = await findPatchIdMatch(commitSha, {
      ...options,
      scanDepth: options?.deep ? DEEP_SCAN_DEPTH : undefined,
    });
    if (patchIdMatch) {
      const result = await lookupPR(
        patchIdMatch.matchedSha,
        adapter,
        options,
        _recursionDepth + 1,
      );
      if (result) {
        await cache.set(commitSha, toCachedPR(result));
        return result;
      }
    }
  }

  return null;
}

export function resetPRCache(): void {
  cacheRegistry.clear();
}
