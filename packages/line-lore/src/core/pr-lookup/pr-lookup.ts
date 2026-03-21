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
  const cache = getCache(options?.noCache);
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
  prCache = null;
}
