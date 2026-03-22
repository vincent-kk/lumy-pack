import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '@/errors.js';
import { gitExec } from '@/git/executor.js';

import {
  DEFAULT_ANCESTRY_TIMEOUT,
  extractPRFromMergeMessage,
  findMergeCommit,
  verifyMergeIntroducesCommit,
} from '../ancestry.js';
import type { AncestryResult } from '../ancestry.js';

vi.mock('@/git/executor.js', () => ({
  gitExec: vi.fn(),
}));

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;

describe('findMergeCommit', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  it('finds the closest merge commit via ancestry-path', async () => {
    // git log --merges --ancestry-path --first-parent
    mockGitExec.mockResolvedValueOnce({
      stdout:
        'aaa1111111111111111111111111111111111111 bbb2222222222222222222222222222222222222 ccc3333333333333333333333333333333333333 Merge pull request #42 from feature\n',
      stderr: '',
      exitCode: 0,
    });
    // isAncestor(target, firstParent=bbb...) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent=ccc...) → is ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await findMergeCommit('abc123'.padEnd(40, '0'));

    expect(result).not.toBeNull();
    expect(result!.mergeCommitSha).toBe(
      'aaa1111111111111111111111111111111111111',
    );
    expect(result!.parentShas).toHaveLength(2);
    expect(result!.subject).toContain('Merge pull request #42');
  });

  it('returns null when no merge commits found', async () => {
    mockGitExec.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const result = await findMergeCommit('abc123'.padEnd(40, '0'));
    expect(result).toBeNull();
  });

  it('returns null on git error', async () => {
    mockGitExec.mockRejectedValueOnce(
      new LineLoreError(LineLoreErrorCode.GIT_COMMAND_FAILED, 'failed'),
    );

    const result = await findMergeCommit('abc123'.padEnd(40, '0'));
    expect(result).toBeNull();
  });

  it('applies default 30s timeout budget when no timeout specified', async () => {
    mockGitExec.mockRejectedValue(new Error('timeout'));
    await findMergeCommit('abc123');
    // First call (first-parent) should have timeout=30000
    expect(vi.mocked(gitExec).mock.calls[0][1]).toEqual(
      expect.objectContaining({ timeout: DEFAULT_ANCESTRY_TIMEOUT }),
    );
  });

  it('allocates remaining time to fallback after first-parent', async () => {
    // First-parent returns null (no result), takes ~0ms in test
    mockGitExec
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // first-parent: empty
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }); // fallback: empty

    await findMergeCommit('abc123');

    // Second call should have a timeout <= 30000 (remaining budget)
    const secondCallTimeout = vi.mocked(gitExec).mock.calls[1]?.[1]?.timeout;
    expect(secondCallTimeout).toBeDefined();
    expect(secondCallTimeout).toBeLessThanOrEqual(DEFAULT_ANCESTRY_TIMEOUT);
    expect(secondCallTimeout).toBeGreaterThan(0);
  });

  it('uses user-provided timeout as budget', async () => {
    mockGitExec.mockRejectedValue(new Error('timeout'));
    await findMergeCommit('abc123', { timeout: 10_000 });
    expect(vi.mocked(gitExec).mock.calls[0][1]).toEqual(
      expect.objectContaining({ timeout: 10_000 }),
    );
  });
});

describe('verifyMergeIntroducesCommit', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  const targetSha = 'target'.padEnd(40, '0');
  const firstParent = 'first_parent'.padEnd(40, '0');
  const secondParent = 'second_parent'.padEnd(40, '0');

  function makeMerge(parents: string[]): AncestryResult {
    return {
      mergeCommitSha: 'merge'.padEnd(40, '0'),
      parentShas: parents,
      subject: 'Merge pull request #1',
    };
  }

  it('returns true when target is ancestor of second parent only', async () => {
    // isAncestor(target, firstParent) → exit code 1 (not ancestor)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent) → exit code 0 (is ancestor)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent]),
    );

    expect(result).toBe(true);
  });

  it('returns false when target is ancestor of BOTH parents', async () => {
    // isAncestor(target, firstParent) → exit code 0 (is ancestor — already on mainline)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent]),
    );

    expect(result).toBe(false);
  });

  it('returns false when target is not ancestor of any non-first parent', async () => {
    // isAncestor(target, firstParent) → exit code 1 (not on mainline)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent) → exit code 1 (not on branch either)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent]),
    );

    expect(result).toBe(false);
  });

  it('returns false on git command failure (fail-skip)', async () => {
    // isAncestor throws error
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent]),
    );

    expect(result).toBe(false);
  });

  it('returns true when merge has fewer than 2 parents (degenerate)', async () => {
    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent]),
    );

    expect(result).toBe(true);
    expect(mockGitExec).not.toHaveBeenCalled();
  });
});

describe('extractPRFromMergeMessage', () => {
  it('extracts PR from GitHub merge commit message', () => {
    expect(
      extractPRFromMergeMessage('Merge pull request #102 from owner/branch'),
    ).toBe(102);
  });

  it('extracts PR from squash merge convention', () => {
    expect(extractPRFromMergeMessage('feat: add validation (#55)')).toBe(55);
  });

  it('extracts MR from GitLab merge commit message', () => {
    expect(
      extractPRFromMergeMessage('See merge request group/project!123'),
    ).toBe(123);
  });

  it('extracts PR number from Azure DevOps merge message', () => {
    expect(extractPRFromMergeMessage('Merged PR 99: Add feature')).toBe(99);
  });

  it('extracts PR number from Azure DevOps merge message with longer title', () => {
    expect(
      extractPRFromMergeMessage(
        'Merged PR 123: Fix bug in authentication module',
      ),
    ).toBe(123);
  });

  it('returns null when no PR number found', () => {
    expect(extractPRFromMergeMessage('fix: something')).toBeNull();
  });

  it('extracts MR from GitLab with nested namespace', () => {
    expect(
      extractPRFromMergeMessage(
        'See merge request group/subgroup/project!789',
      ),
    ).toBe(789);
  });

  it('extracts MR from GitLab without project path', () => {
    expect(
      extractPRFromMergeMessage('See merge request !123'),
    ).toBe(123);
  });

  it('returns null for bare !N on any platform (false positive prevention)', () => {
    expect(extractPRFromMergeMessage('breaking change!5')).toBeNull();
    expect(extractPRFromMergeMessage('fix: handle edge case!3')).toBeNull();
    expect(extractPRFromMergeMessage('version bump to v2!1')).toBeNull();
  });

  it('returns null for bare !N even with explicit gitlab platform', () => {
    expect(
      extractPRFromMergeMessage('breaking change!5', 'gitlab'),
    ).toBeNull();
  });
});

describe('verifyMergeIntroducesCommit — octopus merge (3+ parents)', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  const targetSha = 'target'.padEnd(40, '0');
  const firstParent = 'first_parent'.padEnd(40, '0');
  const secondParent = 'second_parent'.padEnd(40, '0');
  const thirdParent = 'third_parent'.padEnd(40, '0');

  function makeMerge(parents: string[]): AncestryResult {
    return {
      mergeCommitSha: 'merge'.padEnd(40, '0'),
      parentShas: parents,
      subject: 'Merge branches into main',
    };
  }

  it('returns true when target is ancestor of third parent only', async () => {
    // isAncestor(target, firstParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, thirdParent) → is ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent, thirdParent]),
    );

    expect(result).toBe(true);
    expect(mockGitExec).toHaveBeenCalledTimes(3);
  });

  it('returns true and short-circuits when target is ancestor of second parent', async () => {
    // isAncestor(target, firstParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent) → is ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent, thirdParent]),
    );

    expect(result).toBe(true);
    // Third parent NOT checked — short-circuit
    expect(mockGitExec).toHaveBeenCalledTimes(2);
  });

  it('returns false when target is on mainline (first parent)', async () => {
    // isAncestor(target, firstParent) → is ancestor (on mainline)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent, thirdParent]),
    );

    expect(result).toBe(false);
    // Branch parents NOT checked
    expect(mockGitExec).toHaveBeenCalledTimes(1);
  });

  it('returns false when target is not ancestor of any branch parent', async () => {
    // isAncestor(target, firstParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, secondParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // isAncestor(target, thirdParent) → not ancestor
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });

    const result = await verifyMergeIntroducesCommit(
      targetSha,
      makeMerge([firstParent, secondParent, thirdParent]),
    );

    expect(result).toBe(false);
    expect(mockGitExec).toHaveBeenCalledTimes(3);
  });
});

describe('findMergeCommit — chained failure and warnings', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  const commitSha = 'a'.repeat(40);
  const m1 = 'b'.repeat(40);
  const m2 = 'c'.repeat(40);
  const m3 = 'd'.repeat(40);
  const p1 = 'e'.repeat(40);
  const p2 = 'f'.repeat(40);

  function makeLine(sha: string): string {
    return `${sha} ${p1} ${p2} Merge pull request #1 from feature`;
  }

  it('returns null and pushes warning when all candidates fail verification', async () => {
    const warnings: string[] = [];
    // git log --merges --first-parent returns 3 candidates
    mockGitExec.mockResolvedValueOnce({
      stdout: [makeLine(m1), makeLine(m2), makeLine(m3)].join('\n'),
      stderr: '',
      exitCode: 0,
    });
    // Each candidate: isAncestor(target, firstParent) throws → fail-skip (1 call per candidate)
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));

    const result = await findMergeCommit(commitSha, { warnings });

    expect(result).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /all 3 merge candidate.*failed verification/,
    );
  });

  it('returns second candidate and emits no warning when first fails but second passes', async () => {
    const warnings: string[] = [];
    // git log --merges --first-parent returns 2 candidates
    mockGitExec.mockResolvedValueOnce({
      stdout: [makeLine(m1), makeLine(m2)].join('\n'),
      stderr: '',
      exitCode: 0,
    });
    // First candidate: isAncestor(target, firstParent=p1) throws → fail-skip
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));
    // Second candidate: isAncestor(target, firstParent=p1) → not ancestor (exit code 1)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1 });
    // Second candidate: isAncestor(target, secondParent=p2) → is ancestor (exit code 0)
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    const result = await findMergeCommit(commitSha, { warnings });

    expect(result).not.toBeNull();
    expect(result!.mergeCommitSha).toBe(m2);
    expect(warnings).toHaveLength(0);
  });

  it('emits warnings from both first-parent and fallback paths independently', async () => {
    const warnings: string[] = [];
    // First-parent: 1 candidate, isAncestor throws → fail-skip
    mockGitExec.mockResolvedValueOnce({
      stdout: makeLine(m1),
      stderr: '',
      exitCode: 0,
    });
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));

    // Fallback: 1 candidate, isAncestor throws → fail-skip
    mockGitExec.mockResolvedValueOnce({
      stdout: makeLine(m2),
      stderr: '',
      exitCode: 0,
    });
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));

    const result = await findMergeCommit(commitSha, { warnings });

    expect(result).toBeNull();
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/all 1 merge candidate.*failed verification/);
    expect(warnings[1]).toMatch(/all 1 merge candidate.*failed verification/);
  });

  it('does not crash when warnings array is not provided', async () => {
    // git log --merges --first-parent returns 1 candidate, isAncestor throws → fail-skip
    mockGitExec.mockResolvedValueOnce({
      stdout: makeLine(m1),
      stderr: '',
      exitCode: 0,
    });
    mockGitExec.mockRejectedValueOnce(new Error('git failed'));
    // fallback: empty
    mockGitExec.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    // No warnings in options — should not crash
    const result = await findMergeCommit(commitSha);
    expect(result).toBeNull();
  });
});
