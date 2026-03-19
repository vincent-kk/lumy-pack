import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gitExec, shellExec } from '@/git/executor.js';

import {
  computePatchId,
  findPatchIdMatch,
  resetPatchIdCache,
} from '../patch-id.js';

const mockStore = new Map<string, unknown>();

vi.mock('@/git/executor.js', () => ({
  gitExec: vi.fn(),
  shellExec: vi.fn(),
}));

vi.mock('@/cache/file-cache.js', () => ({
  FileCache: class {
    get(key: string) {
      return Promise.resolve(mockStore.get(key) ?? null);
    }
    set(key: string, value: unknown) {
      mockStore.set(key, value);
      return Promise.resolve();
    }
  },
}));

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;
const mockShellExec = shellExec as ReturnType<typeof vi.fn>;

describe('computePatchId', () => {
  beforeEach(() => {
    mockShellExec.mockReset();
    mockGitExec.mockReset();
    mockStore.clear();
    resetPatchIdCache();
  });

  it('computes patch-id for a commit via shell pipe', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: 'abc123patchid def456commitsha\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await computePatchId('abc'.padEnd(40, '0'));
    expect(result).toBe('abc123patchid');
  });

  it('returns null on failure', async () => {
    mockShellExec.mockRejectedValueOnce(new Error('git failed'));

    const result = await computePatchId('abc'.padEnd(40, '0'));
    expect(result).toBeNull();
  });
});

describe('findPatchIdMatch', () => {
  beforeEach(() => {
    mockShellExec.mockReset();
    mockGitExec.mockReset();
    mockStore.clear();
    resetPatchIdCache();
  });

  it('finds matching commit by patch-id', async () => {
    const targetSha = 'aaa'.padEnd(40, '0');
    const matchSha = 'bbb'.padEnd(40, '0');

    // computePatchId for target
    mockShellExec.mockResolvedValueOnce({
      stdout: 'samepatchid ' + targetSha,
      stderr: '',
      exitCode: 0,
    });

    // git log for candidates
    mockGitExec.mockResolvedValueOnce({
      stdout: matchSha + '\n' + 'ccc'.padEnd(40, '0') + '\n',
      stderr: '',
      exitCode: 0,
    });

    // computePatchId for match candidate
    mockShellExec.mockResolvedValueOnce({
      stdout: 'samepatchid ' + matchSha,
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

    // computePatchId for target
    mockShellExec.mockResolvedValueOnce({
      stdout: 'uniquepatchid ' + targetSha,
      stderr: '',
      exitCode: 0,
    });

    // git log
    mockGitExec.mockResolvedValueOnce({
      stdout: 'bbb'.padEnd(40, '0') + '\n',
      stderr: '',
      exitCode: 0,
    });

    // computePatchId for candidate - different
    mockShellExec.mockResolvedValueOnce({
      stdout: 'differentpatchid bbb',
      stderr: '',
      exitCode: 0,
    });

    const result = await findPatchIdMatch(targetSha, { scanDepth: 5 });
    expect(result).toBeNull();
  });
});
