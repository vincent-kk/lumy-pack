import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gitExec } from '@/git/executor.js';
import type { CachedPRInfo, PRInfo, PlatformAdapter } from '@/types/index.js';

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

  describe('skipPatchIdScan and recursion depth', () => {
    it('skips Strategy 4 when skipPatchIdScan is true', async () => {
      const commitSha = 'skip01'.padEnd(40, '0');

      // findMergeCommit: first-parent returns nothing, fallback returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const adapter = createMockAdapter(null);

      const result = await lookupPR(commitSha, adapter, {
        skipPatchIdScan: true,
      });

      // Should return null without attempting patch-id scan
      expect(result).toBeNull();
      // gitExec called only for findMergeCommit (first-parent + fallback), NOT for patch-id
      expect(mockGitExec).toHaveBeenCalledTimes(2);
    });

    it('stops recursion at max depth 2', async () => {
      const commitSha = 'rec01'.padEnd(40, '0');

      // findMergeCommit returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const adapter = createMockAdapter(null);

      // Call with _recursionDepth = 2 (at max)
      const result = await lookupPR(commitSha, adapter, {}, 2);

      // Should return null — patch-id scan skipped due to depth limit
      expect(result).toBeNull();
    });

    it('allows patch-id scan at depth < max when skipPatchIdScan is false', async () => {
      const commitSha = 'rec02'.padEnd(40, '0');

      // findMergeCommit returns nothing (first-parent + fallback)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const adapter = createMockAdapter(null);

      // At depth 0, skipPatchIdScan false — patch-id should be attempted
      // (will fail because execa is mocked to reject, but it should be attempted)
      const result = await lookupPR(commitSha, adapter, {
        skipPatchIdScan: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('cache timestamp convention', () => {
    it('stores mergedAt as numeric timestamp and round-trips to ISO string', async () => {
      const commitSha = 'aaa111'.padEnd(40, '0');
      const isoDate = '2024-01-15T10:00:00.000Z';
      const prInfo: PRInfo = {
        number: 42,
        title: 'Test PR',
        author: 'user',
        url: 'https://github.com/org/repo/pull/42',
        mergeCommit: 'merge'.padEnd(40, '0'),
        baseBranch: 'main',
        mergedAt: isoDate,
      };

      // findMergeCommit returns nothing so we fall through to adapter
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const adapter = createMockAdapter(prInfo);
      await lookupPR(commitSha, adapter);

      // Cache should contain CachedPRInfo with numeric mergedAt
      const stored = mockStore.get(commitSha) as CachedPRInfo;
      expect(typeof stored.mergedAt).toBe('number');
      expect(stored.mergedAt).toBe(new Date(isoDate).getTime());

      // Second call reads from cache — round-trip should produce correct ISO string
      const result = await lookupPR(commitSha, adapter, { cacheOnly: true });
      expect(result).not.toBeNull();
      expect(result!.mergedAt).toBe(isoDate);
    });

    it('handles legacy ISO string mergedAt in cache (backward compatibility)', async () => {
      const commitSha = 'bbb222'.padEnd(40, '0');
      const isoDate = '2024-06-01T08:30:00.000Z';

      // Pre-populate cache with old-format CachedPRInfo (mergedAt as string via type cast)
      const legacyCached = {
        number: 10,
        title: 'Legacy PR',
        author: 'olduser',
        url: 'https://github.com/org/repo/pull/10',
        mergeCommit: 'legacy'.padEnd(40, '0'),
        baseBranch: 'main',
        mergedAt: isoDate as unknown as number,
      } satisfies CachedPRInfo;
      mockStore.set(commitSha, legacyCached);

      const result = await lookupPR(commitSha, null, { cacheOnly: true });

      expect(result).not.toBeNull();
      expect(result!.mergedAt).toBe(isoDate);
    });

    it('handles undefined mergedAt round-trip correctly', async () => {
      const commitSha = 'ccc333'.padEnd(40, '0');
      const prInfo: PRInfo = {
        number: 20,
        title: 'No date PR',
        author: 'user',
        url: 'https://github.com/org/repo/pull/20',
        mergeCommit: 'nodate'.padEnd(40, '0'),
        baseBranch: 'main',
        // mergedAt intentionally omitted
      };

      const cached: CachedPRInfo = {
        number: prInfo.number,
        title: prInfo.title,
        author: prInfo.author,
        url: prInfo.url,
        mergeCommit: prInfo.mergeCommit,
        baseBranch: prInfo.baseBranch,
        // mergedAt intentionally omitted
      };
      mockStore.set(commitSha, cached);

      const result = await lookupPR(commitSha, null, { cacheOnly: true });

      expect(result).not.toBeNull();
      expect(result!.mergedAt).toBeUndefined();
    });
  });
});
