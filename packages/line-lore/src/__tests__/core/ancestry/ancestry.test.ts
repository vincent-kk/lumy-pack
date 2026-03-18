import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '../../../errors.js';

vi.mock('../../../git/executor.js', () => ({
  gitExec: vi.fn(),
}));

import {
  findMergeCommit,
  extractPRFromMergeMessage,
} from '../../../core/ancestry/ancestry.js';
import { gitExec } from '../../../git/executor.js';

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
});

describe('extractPRFromMergeMessage', () => {
  it('extracts PR from GitHub merge commit message', () => {
    expect(
      extractPRFromMergeMessage('Merge pull request #102 from owner/branch'),
    ).toBe(102);
  });

  it('extracts PR from squash merge convention', () => {
    expect(
      extractPRFromMergeMessage('feat: add validation (#55)'),
    ).toBe(55);
  });

  it('extracts MR from GitLab merge commit message', () => {
    expect(
      extractPRFromMergeMessage('See merge request group/project!123'),
    ).toBe(123);
  });

  it('returns null when no PR number found', () => {
    expect(extractPRFromMergeMessage('fix: something')).toBeNull();
  });
});
