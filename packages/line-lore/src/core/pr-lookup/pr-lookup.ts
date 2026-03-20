import { FileCache } from '../../cache/file-cache.js';
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

let prCache: FileCache<PRInfo> | null = null;

function getCache(noCache?: boolean): FileCache<PRInfo> {
  if (noCache) {
    return new FileCache<PRInfo>('sha-to-pr.json', { enabled: false });
  }
  if (!prCache) {
    prCache = new FileCache<PRInfo>('sha-to-pr.json');
  }
  return prCache;
}

export interface PRLookupOptions extends GitExecOptions {
  noCache?: boolean;
  deep?: boolean;
}

const DEEP_SCAN_DEPTH = 2000;

export async function lookupPR(
  commitSha: string,
  adapter: PlatformAdapter | null,
  options?: PRLookupOptions,
): Promise<PRInfo | null> {
  // Level 0: Check cache first
  const cache = getCache(options?.noCache);
  const cached = await cache.get(commitSha);
  if (cached) return cached;

  // Level 1: Git-only — merge commit message parsing
  let mergeBasedPR: PRInfo | null = null;
  const mergeResult = await findMergeCommit(commitSha, options);
  if (mergeResult) {
    const prNumber = extractPRFromMergeMessage(mergeResult.subject);
    if (prNumber) {
      // Try to get full PR info via API if available
      if (adapter) {
        const prInfo = await adapter.getPRForCommit(mergeResult.mergeCommitSha);
        if (prInfo) {
          mergeBasedPR = prInfo;
        }
      }

      if (!mergeBasedPR) {
        // Fallback: construct minimal PR info from message
        mergeBasedPR = {
          number: prNumber,
          title: mergeResult.subject,
          author: '',
          url: '',
          mergeCommit: mergeResult.mergeCommitSha,
          baseBranch: '',
        };
      }

      // In non-deep mode, return immediately with merge-based result
      if (!options?.deep) {
        await cache.set(commitSha, mergeBasedPR);
        return mergeBasedPR;
      }
      // In deep mode, continue to patch-id matching for additional context
    }
  }

  // Level 2: Patch-ID matching for rebased/squashed commits
  // In deep mode, use expanded scan depth (2000 vs default 500)
  const patchIdMatch = await findPatchIdMatch(commitSha, {
    ...options,
    scanDepth: options?.deep ? DEEP_SCAN_DEPTH : undefined,
  });
  if (patchIdMatch) {
    // Try the matched commit instead
    const result = await lookupPR(patchIdMatch.matchedSha, adapter, options);
    if (result) {
      await cache.set(commitSha, result);
      return result;
    }
  }

  // If deep mode found a merge-based PR but patch-id didn't improve, use it
  if (mergeBasedPR) {
    await cache.set(commitSha, mergeBasedPR);
    return mergeBasedPR;
  }

  // Level 3: Direct API lookup (most expensive)
  if (adapter) {
    const prInfo = await adapter.getPRForCommit(commitSha);
    if (prInfo) {
      await cache.set(commitSha, prInfo);
      return prInfo;
    }
  }

  return null;
}

export function resetPRCache(): void {
  prCache = null;
}
