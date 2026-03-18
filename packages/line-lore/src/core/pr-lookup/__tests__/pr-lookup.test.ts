import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = new Map<string, unknown>();

vi.mock('@/git/executor.js', () => ({
  gitExec: vi.fn(),
}));

vi.mock('@/cache/file-cache.js', () => ({
  FileCache: class {
    get(key: string) { return Promise.resolve(mockStore.get(key) ?? null); }
    set(key: string, value: unknown) { mockStore.set(key, value); return Promise.resolve(); }
  },
}));

vi.mock('execa', () => ({
  execa: vi.fn().mockRejectedValue(new Error('no patch-id in test')),
}));

import { lookupPR, resetPRCache } from '../pr-lookup.js';
import { gitExec } from '@/git/executor.js';
import type { PlatformAdapter, PRInfo } from '@/types/index.js';

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
});
