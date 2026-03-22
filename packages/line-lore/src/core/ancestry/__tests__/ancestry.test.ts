import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '@/errors.js';
import { gitExec } from '@/git/executor.js';

import {
  DEFAULT_ANCESTRY_TIMEOUT,
  extractPRFromMergeMessage,
  findMergeCommit,
} from '../ancestry.js';

vi.mock('@/git/executor.js', () => ({
  gitExec: vi.fn(),
}));

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;

describe('findMergeCommit', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  it('finds the closest merge commit via ancestry-path', async () => {
    mockGitExec.mockResolvedValueOnce({
      stdout:
        'aaa1111111111111111111111111111111111111 bbb2222222222222222222222222222222222222 ccc3333333333333333333333333333333333333 Merge pull request #42 from feature\n',
      stderr: '',
      exitCode: 0,
    });

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
});
