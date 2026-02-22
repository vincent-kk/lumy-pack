import { getLastRunHash, saveRunHash } from '../../core/cache-manager.js';
import { computeProjectHash } from '../../core/project-hash.js';

export type CacheManageAction = 'compute-hash' | 'save-hash' | 'get-hash';

export interface CacheManageInput {
  action: CacheManageAction;
  cwd: string;
  skillName?: string;
  hash?: string;
}

export interface ComputeHashResult {
  hash: string;
  cwd: string;
}

export interface SaveHashResult {
  saved: true;
  skillName: string;
  hash: string;
}

export interface GetHashResult {
  hash: string | null;
  skillName: string;
  found: boolean;
}

export type CacheManageResult =
  | ComputeHashResult
  | SaveHashResult
  | GetHashResult;

export async function handleCacheManage(
  args: unknown,
): Promise<CacheManageResult> {
  const input = args as CacheManageInput;

  if (!input.cwd) throw new Error('cwd is required');
  if (!input.action) throw new Error('action is required');

  switch (input.action) {
    case 'compute-hash': {
      const hash = await computeProjectHash(input.cwd);
      return { hash, cwd: input.cwd };
    }
    case 'save-hash': {
      if (!input.skillName)
        throw new Error('skillName is required for save-hash');
      if (!input.hash) throw new Error('hash is required for save-hash');
      saveRunHash(input.cwd, input.skillName, input.hash);
      return { saved: true, skillName: input.skillName, hash: input.hash };
    }
    case 'get-hash': {
      if (!input.skillName)
        throw new Error('skillName is required for get-hash');
      const hash = getLastRunHash(input.cwd, input.skillName);
      return { hash, skillName: input.skillName, found: hash !== null };
    }
    default:
      throw new Error(`Unknown action: ${String(input.action)}`);
  }
}
