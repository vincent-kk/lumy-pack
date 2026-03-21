import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gitPipe } from '@/git/executor.js';

import {
  computePatchId,
  findPatchIdMatch,
  resetPatchIdCache,
} from '../patch-id.js';

const mockStore = new Map<string, unknown>();

vi.mock('@/git/executor.js', () => ({
  gitPipe: vi.fn(),
}));

vi.mock('@/cache/sharded-cache.js', () => ({
  ShardedCache: class {
    get(key: string) {
      return Promise.resolve(mockStore.get(key) ?? null);
    }
    set(key: string, value: unknown) {
      mockStore.set(key, value);
      return Promise.resolve();
    }
  },
  cleanupLegacyCache: () => Promise.resolve(),
}));

const mockGitPipe = gitPipe as ReturnType<typeof vi.fn>;

describe('computePatchId', () => {
  beforeEach(() => {
    mockGitPipe.mockReset();
    mockStore.clear();
    resetPatchIdCache();
  });

  it('computes patch-id via gitPipe (git diff | git patch-id)', async () => {
    mockGitPipe.mockResolvedValueOnce({
      stdout: 'abc123patchid def456commitsha\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await computePatchId('abc'.padEnd(40, '0'));
    expect(result).toBe('abc123patchid');
  });

  it('returns null on failure', async () => {
    mockGitPipe.mockRejectedValueOnce(new Error('git failed'));

    const result = await computePatchId('abc'.padEnd(40, '0'));
    expect(result).toBeNull();
  });
});

describe('findPatchIdMatch', () => {
  beforeEach(() => {
    mockGitPipe.mockReset();
    mockStore.clear();
    resetPatchIdCache();
  });

  it('finds matching commit by patch-id via batch pipe', async () => {
    const targetSha = 'aaa'.padEnd(40, '0');
    const matchSha = 'bbb'.padEnd(40, '0');
    const otherSha = 'ccc'.padEnd(40, '0');

    // computePatchId for target (git diff | git patch-id)
    mockGitPipe.mockResolvedValueOnce({
      stdout: 'samepatchid ' + targetSha,
      stderr: '',
      exitCode: 0,
    });

    // batch scan (git log -p | git patch-id --stable)
    mockGitPipe.mockResolvedValueOnce({
      stdout: `samepatchid ${matchSha}\ndifferentid ${otherSha}\n`,
      stderr: '',
      exitCode: 0,
    });

    const result = await findPatchIdMatch(targetSha, { scanDepth: 10 });
    expect(result).not.toBeNull();
    expect(result!.matchedSha).toBe(matchSha);
    expect(result!.patchId).toBe('samepatchid');
  });

  it('returns null when no match found', async () => {
    const targetSha = 'aaa'.padEnd(40, '0');
    const otherSha = 'bbb'.padEnd(40, '0');

    // computePatchId for target
    mockGitPipe.mockResolvedValueOnce({
      stdout: 'uniquepatchid ' + targetSha,
      stderr: '',
      exitCode: 0,
    });

    // batch scan
    mockGitPipe.mockResolvedValueOnce({
      stdout: `differentpatchid ${otherSha}\n`,
      stderr: '',
      exitCode: 0,
    });

    const result = await findPatchIdMatch(targetSha, { scanDepth: 5 });
    expect(result).toBeNull();
  });
});
