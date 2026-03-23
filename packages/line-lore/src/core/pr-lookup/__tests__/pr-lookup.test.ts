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

    // Strategy 3: findMergeCommit (first-parent) — finds merge commit
    mockGitExec.mockResolvedValueOnce({
      stdout: `${mergeSha} ${'p1'.padEnd(40, '0')} ${'p2'.padEnd(40, '0')} Merge pull request #42 from feature/branch\n`,
      stderr: '',
      exitCode: 0,
    });
    // isAncestor(target, firstParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent) → is ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

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

    // Strategy 3: findMergeCommit (first-parent) → empty
    mockGitExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    // Strategy 3: findMergeCommit (fallback) → empty
    mockGitExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    // Strategy 4: getCommitSubject — no PR pattern
    mockGitExec.mockResolvedValueOnce({
      stdout: 'chore: nothing here\n',
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

  describe('strategy reorder: API direct lookup first at Level 2', () => {
    it('Level 2: API direct tried first, succeeds → ancestry skipped', async () => {
      const commitSha = 'api01'.padEnd(40, '0');
      const prInfo: PRInfo = {
        number: 77,
        title: 'Direct PR',
        author: 'dev',
        url: 'https://github.com/org/repo/pull/77',
        mergeCommit: 'merge77'.padEnd(40, '0'),
        baseBranch: 'main',
        mergedAt: new Date().toISOString(),
      };

      const adapter = createMockAdapter(prInfo);

      const result = await lookupPR(commitSha, adapter);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(77);
      // API was called with the blame commit SHA (direct lookup)
      expect(adapter.getPRForCommit).toHaveBeenCalledWith(commitSha, undefined);
      // findMergeCommit was NOT called (ancestry skipped)
      expect(mockGitExec).not.toHaveBeenCalled();
    });

    it('Level 2: API direct returns no mergedAt → falls through to ancestry', async () => {
      const commitSha = 'api02'.padEnd(40, '0');
      const mergeSha = 'merge02'.padEnd(40, '0');

      // API direct returns PR without mergedAt (not merged yet or unresolvable)
      const noMergedAtPR: PRInfo = {
        number: 88,
        title: 'Unmerged PR',
        author: 'dev',
        url: 'https://github.com/org/repo/pull/88',
        mergeCommit: '',
        baseBranch: 'main',
      };
      const adapter = createMockAdapter(noMergedAtPR);

      // Strategy 3: findMergeCommit ancestry result (first-parent) — finds merge commit
      mockGitExec.mockResolvedValueOnce({
        stdout: `${mergeSha} ${'p1'.padEnd(40, '0')} ${'p2'.padEnd(40, '0')} Merge pull request #55 from feature\n`,
        stderr: '',
        exitCode: 0,
      });
      // isAncestor(target, firstParent) → not ancestor
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      // isAncestor(target, secondParent) → is ancestor
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await lookupPR(commitSha, adapter);

      expect(result).not.toBeNull();
      // API direct was tried first (called with commitSha)
      expect(adapter.getPRForCommit).toHaveBeenCalledWith(commitSha, undefined);
      // Then ancestry fallback was used
      expect(mockGitExec).toHaveBeenCalled();
    });

    it('Level 0/1: no adapter → goes directly to ancestry', async () => {
      const commitSha = 'api03'.padEnd(40, '0');
      const mergeSha = 'merge03'.padEnd(40, '0');

      // Strategy 3: findMergeCommit (first-parent) — finds merge commit
      mockGitExec.mockResolvedValueOnce({
        stdout: `${mergeSha} ${'p1'.padEnd(40, '0')} ${'p2'.padEnd(40, '0')} Merge pull request #33 from feature\n`,
        stderr: '',
        exitCode: 0,
      });
      // isAncestor(target, firstParent) → not ancestor
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      // isAncestor(target, secondParent) → is ancestor
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await lookupPR(commitSha, null);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(33);
      // Ancestry was called directly (no API)
      expect(mockGitExec).toHaveBeenCalled();
    });
  });

  describe('preferredBase PR selection', () => {
    it('without preferredBase: oldest PR selected (FP-6 fix)', async () => {
      const commitSha = 'fpbase01'.padEnd(40, '0');

      // Adapter returns PR — getPRForCommit is called in Strategy 2
      // The adapter mock returns the same PR for all calls,
      // but this test verifies preferredBase=undefined is passed
      const prInfo: PRInfo = {
        number: 10,
        title: 'Feature PR (oldest)',
        author: 'dev',
        url: 'https://github.com/org/repo/pull/10',
        mergeCommit: 'merge10'.padEnd(40, '0'),
        baseBranch: 'release',
        mergedAt: new Date().toISOString(),
      };

      const adapter = createMockAdapter(prInfo);

      const result = await lookupPR(commitSha, adapter);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(10);
      // Without preferredBase, adapter is called with undefined options
      expect(adapter.getPRForCommit).toHaveBeenCalledWith(commitSha, undefined);
    });

    it('with preferredBase: matching PR selected (FP-9 Case B fix)', async () => {
      const commitSha = 'fpbase02'.padEnd(40, '0');

      const prInfo: PRInfo = {
        number: 15,
        title: 'Release PR (backport)',
        author: 'dev',
        url: 'https://github.com/org/repo/pull/15',
        mergeCommit: 'merge15'.padEnd(40, '0'),
        baseBranch: 'release/1',
        mergedAt: new Date().toISOString(),
      };

      const adapter = createMockAdapter(prInfo);

      const result = await lookupPR(commitSha, adapter, {
        preferredBase: 'release/1',
      });

      expect(result).not.toBeNull();
      expect(result!.number).toBe(15);
      // preferredBase is forwarded to adapter
      expect(adapter.getPRForCommit).toHaveBeenCalledWith(commitSha, {
        preferredBase: 'release/1',
      });
    });
  });

  describe('skipPatchIdScan and recursion depth', () => {
    it('skips Strategy 5 when skipPatchIdScan is true', async () => {
      const commitSha = 'skip01'.padEnd(40, '0');

      // Strategy 3: findMergeCommit first-parent returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommit fallback returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      // Strategy 4: getCommitSubject — no PR pattern
      mockGitExec.mockResolvedValueOnce({
        stdout: 'chore: nothing\n',
        stderr: '',
        exitCode: 0,
      });

      const adapter = createMockAdapter(null);

      const result = await lookupPR(commitSha, adapter, {
        skipPatchIdScan: true,
      });

      // Should return null without attempting patch-id scan
      expect(result).toBeNull();
      // gitExec: findMergeCommit(2) + getCommitSubject(1) = 3
      expect(mockGitExec).toHaveBeenCalledTimes(3);
    });

    it('stops recursion at max depth 2', async () => {
      const commitSha = 'rec01'.padEnd(40, '0');

      // Strategy 3: findMergeCommit first-parent returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommit fallback returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      // Strategy 4: getCommitSubject — no PR pattern
      mockGitExec.mockResolvedValueOnce({
        stdout: 'chore: nothing\n',
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

      // Strategy 3: findMergeCommit first-parent returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommit fallback returns nothing
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      // Strategy 4: getCommitSubject — no PR pattern
      mockGitExec.mockResolvedValueOnce({
        stdout: 'chore: nothing\n',
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

  describe('squash merge pre-check (Strategy 3a)', () => {
    it('Level 0/1: extracts PR from blame commit message with (#N) pattern', async () => {
      const commitSha = 'sqsh01'.padEnd(40, '0');

      // Strategy 3: findMergeCommit first-parent returns nothing (empty)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommit fallback returns nothing (empty)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      // Strategy 4: getCommitSubject returns squash merge message with PR number
      mockGitExec.mockResolvedValueOnce({
        stdout: 'feat: add new feature (#55)\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await lookupPR(commitSha, null);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(55);
      expect(result!.title).toBe('feat: add new feature (#55)');
      expect(result!.url).toBe('');
      expect(result!.mergeCommit).toBe(commitSha);
      // findMergeCommit called first (empty x2), then getCommitSubject
      expect(mockGitExec).toHaveBeenCalledTimes(3);
    });

    it('Level 2: API direct resolves squash merge before pre-check runs', async () => {
      const commitSha = 'sqsh02'.padEnd(40, '0');

      const apiPR: PRInfo = {
        number: 55,
        title: 'feat: add new feature',
        author: 'dev',
        url: 'https://github.com/org/repo/pull/55',
        mergeCommit: commitSha,
        baseBranch: 'main',
        mergedAt: new Date().toISOString(),
      };
      const adapter = createMockAdapter(apiPR);

      // Strategy 2 returns mergedAt → exits before Strategy 3a (pre-check)
      const result = await lookupPR(commitSha, adapter);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(55);
      // Strategy 2 returned, so gitExec not called (no getCommitSubject needed)
      expect(mockGitExec).not.toHaveBeenCalled();
    });

    it('Level 2: adapter returns null, pre-check extracts PR without duplicate API call', async () => {
      const commitSha = 'sqsh04'.padEnd(40, '0');

      // Adapter exists but returns null for this SHA
      const adapter = createMockAdapter(null);

      // Strategy 3: findMergeCommit first-parent returns nothing (empty)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommit fallback returns nothing (empty)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      // Strategy 4: getCommitSubject returns squash merge message with PR number
      mockGitExec.mockResolvedValueOnce({
        stdout: 'feat: add new feature (#42)\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await lookupPR(commitSha, adapter);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(42);
      expect(result!.title).toBe('feat: add new feature (#42)');
      expect(result!.url).toBe('');
      expect(result!.mergeCommit).toBe(commitSha);
      // getPRForCommit called exactly once (Strategy 2 only), not duplicated in Strategy 4
      expect(adapter.getPRForCommit).toHaveBeenCalledTimes(1);
      expect(adapter.getPRForCommit).toHaveBeenCalledWith(commitSha, undefined);
    });

    it('deep mode falls through to Strategy 4 when mergeBasedPR has no mergedAt', async () => {
      const commitSha = 'a'.repeat(40);
      const mergeSha = 'b'.repeat(40);
      const parent1 = 'c'.repeat(40);
      const parent2 = 'd'.repeat(40);

      // Strategy 3: findMergeCommits — first-parent finds merge with PR#99
      mockGitExec.mockResolvedValueOnce({
        stdout: `${mergeSha} ${parent1} ${parent2} Merge pull request #99 from feature\n`,
        stderr: '',
        exitCode: 0,
      });
      // isAncestor(target, firstParent) → not ancestor
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      // isAncestor(target, secondParent) → is ancestor
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommits — full ancestry path
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 4: getCommitSubject (deep mode falls through because no mergedAt)
      mockGitExec.mockResolvedValueOnce({
        stdout: 'feat: some feature\n',
        stderr: '',
        exitCode: 0,
      });

      // No adapter → mergeBasedPR will lack mergedAt → deep mode should fall through
      const result = await lookupPR(commitSha, null, { deep: true });

      // Should still resolve to PR#99 from ancestry (returned after Strategy 4 finds nothing better)
      expect(result).not.toBeNull();
      expect(result!.number).toBe(99);
      // Verify Strategy 4 was reached (getCommitSubject called)
      expect(mockGitExec).toHaveBeenCalledTimes(5);
    });

    it('ancestry finds merge commit directly without needing commit message', async () => {
      const commitSha = 'a'.repeat(40);
      const mergeSha = 'b'.repeat(40);
      const parent1 = 'c'.repeat(40);
      const parent2 = 'd'.repeat(40);

      // Strategy 3: findMergeCommits — first-parent path finds a merge commit
      mockGitExec.mockResolvedValueOnce({
        stdout: `${mergeSha} ${parent1} ${parent2} Merge pull request #64 from feature\n`,
        stderr: '',
        exitCode: 0,
      });
      // isAncestor(target, firstParent) → not ancestor (exit code 1)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 1,
      });
      // isAncestor(target, secondParent) → is ancestor (exit code 0)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      // Strategy 3: findMergeCommits — full ancestry path (also searched)
      mockGitExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await lookupPR(commitSha, null);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(64);
      // findMergeCommits: first-parent(1) + isAncestor(2) + full-ancestry(1) = 4
      expect(mockGitExec).toHaveBeenCalledTimes(4);
    });

    it('tries later ancestry candidates when the first merge candidate has no PR', async () => {
      const commitSha = 'a'.repeat(40);
      const mergeWithoutPr = 'b'.repeat(40);
      const mergeWithPr = 'c'.repeat(40);
      const parent1 = 'd'.repeat(40);
      const parent2 = 'e'.repeat(40);

      mockGitExec.mockResolvedValueOnce({
        stdout: `${mergeWithoutPr} ${parent1} ${parent2} Merge dev into main\n`,
        stderr: '',
        exitCode: 0,
      });
      mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
      mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

      mockGitExec.mockResolvedValueOnce({
        stdout: `${mergeWithoutPr} ${parent1} ${parent2} Merge dev into main\n${mergeWithPr} ${parent1} ${parent2} Merge pull request #64 from feature\n`,
        stderr: '',
        exitCode: 0,
      });
      mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
      mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
      mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
      mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

      const result = await lookupPR(commitSha, null);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(64);
    });
  });
});
