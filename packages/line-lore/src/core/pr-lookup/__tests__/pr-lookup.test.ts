import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gitExec } from '@/git/executor.js';
import type { PRInfo, PlatformAdapter } from '@/types/index.js';

import { lookupPR, resetPRCache } from '../pr-lookup.js';

const mockStore = new Map<string, unknown>();

vi.mock('@/git/executor.js', () => ({
  gitExec: vi.fn(),
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

vi.mock('execa', () => ({
  execa: vi.fn().mockRejectedValue(new Error('no patch-id in test')),
}));

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;

function createMockAdapter(prInfo: PRInfo | null): PlatformAdapter {
  return {
    platform: 'github',
    checkAuth: vi.fn(),
    getPRForCommit: vi.fn().mockResolvedValue(prInfo),
    getPRCommits: vi.fn().mockResolvedValue([]),
    getLinkedIssues: vi.fn().mockResolvedValue([]),
    getLinkedPRs: vi.fn().mockResolvedValue([]),
    getRateLimit: vi.fn(),
  };
}

describe('lookupPR', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
    mockStore.clear();
    resetPRCache();
  });

  it('finds PR from merge commit message (Level 1)', async () => {
    const mergeSha = 'merge'.padEnd(40, '0');
    const commitSha = 'aaa'.padEnd(40, '0');

    mockGitExec.mockResolvedValueOnce({
      stdout: `${mergeSha} ${'p1'.padEnd(40, '0')} ${'p2'.padEnd(40, '0')} Merge pull request #42 from feature/branch\n`,
      stderr: '',
      exitCode: 0,
    });

    const result = await lookupPR(commitSha, null);

    expect(result).not.toBeNull();
    expect(result!.number).toBe(42);
  });

  it('uses API adapter when available (Level 3)', async () => {
    const commitSha = 'bbb'.padEnd(40, '0');

    // findMergeCommit returns nothing
    mockGitExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const prInfo: PRInfo = {
      number: 99,
      title: 'Fix bug',
      author: 'dev',
      url: 'https://github.com/org/repo/pull/99',
      mergeCommit: 'abc'.padEnd(40, '0'),
      baseBranch: 'main',
      mergedAt: new Date().toISOString(),
    };

    const adapter = createMockAdapter(prInfo);

    const result = await lookupPR(commitSha, adapter);

    expect(result).not.toBeNull();
    expect(result!.number).toBe(99);
  });

  it('returns null when no PR found at any level', async () => {
    const commitSha = 'ccc'.padEnd(40, '0');

    // findMergeCommit returns nothing
    mockGitExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const adapter = createMockAdapter(null);

    const result = await lookupPR(commitSha, adapter);
    expect(result).toBeNull();
  });

  it('cacheOnly returns cached PRInfo when present', async () => {
    const commitSha = 'ddd'.padEnd(40, '0');
    const prInfo: PRInfo = {
      number: 55,
      title: 'Cached PR',
      author: 'dev',
      url: 'https://github.com/org/repo/pull/55',
      mergeCommit: 'def'.padEnd(40, '0'),
      baseBranch: 'main',
      mergedAt: new Date().toISOString(),
    };
    mockStore.set(commitSha, prInfo);

    const result = await lookupPR(commitSha, null, { cacheOnly: true });

    expect(result).not.toBeNull();
    expect(result!.number).toBe(55);
  });

  it('cacheOnly returns null on cache miss without calling API', async () => {
    const commitSha = 'eee'.padEnd(40, '0');
    const adapter = createMockAdapter(null);

    const result = await lookupPR(commitSha, adapter, { cacheOnly: true });

    expect(result).toBeNull();
    expect(adapter.getPRForCommit).not.toHaveBeenCalled();
    expect(mockGitExec).not.toHaveBeenCalled();
  });

  it('cacheOnly overrides noCache to allow cache reads', async () => {
    const commitSha = 'fff'.padEnd(40, '0');
    const prInfo: PRInfo = {
      number: 77,
      title: 'Override PR',
      author: 'dev',
      url: 'https://github.com/org/repo/pull/77',
      mergeCommit: 'ghi'.padEnd(40, '0'),
      baseBranch: 'main',
      mergedAt: new Date().toISOString(),
    };
    mockStore.set(commitSha, prInfo);

    const result = await lookupPR(commitSha, null, {
      cacheOnly: true,
      noCache: true,
    });

    expect(result).not.toBeNull();
    expect(result!.number).toBe(77);
  });
});
