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
  getCommitSubject,
} from '../ancestry/index.js';
import { findPatchIdMatch } from '../patch-id/index.js';

export type ResolvedVia = 'api' | 'ancestry' | 'message' | 'patch-id';

export interface PRLookupResult extends PRInfo {
  resolvedVia: ResolvedVia;
}

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

function toCachedPR(pr: PRLookupResult): CachedPRInfo {
  return {
    number: pr.number,
    title: pr.title,
    author: pr.author,
    url: pr.url,
    mergeCommit: pr.mergeCommit,
    baseBranch: pr.baseBranch,
    mergedAt: pr.mergedAt ? new Date(pr.mergedAt).getTime() : undefined,
    resolvedVia: pr.resolvedVia,
  };
}

function fromCachedPR(cached: CachedPRInfo): PRLookupResult {
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
    // Preserve original resolvedVia; fallback to url heuristic for legacy cache entries
    resolvedVia:
      (cached.resolvedVia as ResolvedVia) ?? (cached.url ? 'api' : 'message'),
  };
}

export interface PRLookupOptions extends GitExecOptions {
  noCache?: boolean;
  /** Return cached results only — skip all fallback strategies */
  cacheOnly?: boolean;
  deep?: boolean;
  repoId?: RepoIdentity;
  /** Skip Strategy 5 (patch-id scan) — set automatically for partial clone environments */
  skipPatchIdScan?: boolean;
  /** Preferred base branch for PR selection — when multiple PRs match, prefer the one targeting this branch */
  preferredBase?: string;
  /** Platform type for platform-aware merge message parsing */
  platform?: string;
}

const DEEP_SCAN_DEPTH = 2000;
const MAX_RECURSION_DEPTH = 2;

/**
 * Multi-strategy PR lookup pipeline:
 *   Strategy 1: Cache
 *   Strategy 2: API direct (ground truth — Level 2)
 *   Strategy 3: Ancestry-path + merge commit verification (structural proof)
 *   Strategy 4: Blame commit message parsing (heuristic — squash merge detection)
 *   Strategy 5: Patch-ID matching + recursion (last resort)
 */
export async function lookupPR(
  commitSha: string,
  adapter: PlatformAdapter | null,
  options?: PRLookupOptions,
  /** @internal recursion depth tracker — do not set from external callers */
  _recursionDepth = 0,
): Promise<PRLookupResult | null> {
  const cache = getCache(
    options?.repoId,
    options?.cacheOnly ? false : options?.noCache,
  );
  const cached = await cache.get(commitSha);
  if (cached) return fromCachedPR(cached);
  if (options?.cacheOnly) return null;

  // Strategy 2: API direct lookup (ground truth — try first at Level 2)
  const prSelectOptions = options?.preferredBase
    ? { preferredBase: options.preferredBase }
    : undefined;
  if (adapter) {
    const directPR = await adapter.getPRForCommit(commitSha, prSelectOptions);
    if (directPR?.mergedAt) {
      const result: PRLookupResult = { ...directPR, resolvedVia: 'api' };
      await cache.set(commitSha, toCachedPR(result));
      return result;
    }
  }

  // Strategy 3: Ancestry-path + merge message parsing (structural proof)
  // Runs before commit message parsing — ancestry provides structural verification
  // while message parsing is heuristic (could match issue numbers as PR numbers).
  let mergeBasedPR: PRLookupResult | null = null;
  const mergeResult = await findMergeCommit(commitSha, options);
  if (mergeResult) {
    const prNumber = extractPRFromMergeMessage(
      mergeResult.subject,
      options?.platform,
    );
    if (prNumber) {
      if (adapter) {
        const prInfo = await adapter.getPRForCommit(
          mergeResult.mergeCommitSha,
          prSelectOptions,
        );
        if (prInfo?.mergedAt) {
          mergeBasedPR = { ...prInfo, resolvedVia: 'ancestry' };
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
          resolvedVia: 'ancestry',
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

  // Strategy 4: Blame commit message parsing (heuristic — squash merge detection)
  // Handles squash merges invisible to --merges (single parent, no merge commit).
  // Runs after ancestry to ensure structural proof is preferred over heuristic.
  const commitSubject = await getCommitSubject(commitSha, options);
  if (commitSubject) {
    const directPrNumber = extractPRFromMergeMessage(
      commitSubject,
      options?.platform,
    );
    if (directPrNumber) {
      const subjectPR: PRLookupResult = {
        number: directPrNumber,
        title: commitSubject,
        author: '',
        url: '',
        mergeCommit: commitSha,
        baseBranch: '',
        resolvedVia: 'message',
      };
      await cache.set(commitSha, toCachedPR(subjectPR));
      return subjectPR;
    }
  }

  // Strategy 5: Patch-ID matching (expensive — streams full log through patch-id)
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
