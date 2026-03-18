import { FileCache } from '../../cache/file-cache.js';
import { extractPRFromMergeMessage, findMergeCommit } from '../ancestry/index.js';
import { findPatchIdMatch } from '../patch-id/index.js';
import type { GitExecOptions, PlatformAdapter, PRInfo } from '../../types/index.js';

let prCache: FileCache<PRInfo> | null = null;

function getCache(): FileCache<PRInfo> {
  if (!prCache) {
    prCache = new FileCache<PRInfo>('sha-to-pr.json');
  }
  return prCache;
}

export async function lookupPR(
  commitSha: string,
  adapter: PlatformAdapter | null,
  options?: GitExecOptions,
): Promise<PRInfo | null> {
  // Level 0: Check cache first
  const cache = getCache();
  const cached = await cache.get(commitSha);
  if (cached) return cached;

  // Level 1: Git-only — merge commit message parsing
  const mergeResult = await findMergeCommit(commitSha, options);
  if (mergeResult) {
    const prNumber = extractPRFromMergeMessage(mergeResult.subject);
    if (prNumber) {
      // Try to get full PR info via API if available
      if (adapter) {
        const prInfo = await adapter.getPRForCommit(mergeResult.mergeCommitSha);
        if (prInfo) {
          await cache.set(commitSha, prInfo);
          return prInfo;
        }
      }

      // Fallback: construct minimal PR info from message
      const minimalPR: PRInfo = {
        number: prNumber,
        title: mergeResult.subject,
        author: '',
        url: '',
        mergeCommit: mergeResult.mergeCommitSha,
        baseBranch: '',
      };
      await cache.set(commitSha, minimalPR);
      return minimalPR;
    }
  }

  // Level 2: Patch-ID matching for rebased/squashed commits
  const patchIdMatch = await findPatchIdMatch(commitSha, options);
  if (patchIdMatch) {
    // Try the matched commit instead
    const result = await lookupPR(patchIdMatch.matchedSha, adapter, options);
    if (result) {
      await cache.set(commitSha, result);
      return result;
    }
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
