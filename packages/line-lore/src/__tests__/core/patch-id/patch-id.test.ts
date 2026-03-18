import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = new Map<string, unknown>();

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../../../git/executor.js', () => ({
  gitExec: vi.fn(),
}));

vi.mock('../../../cache/file-cache.js', () => ({
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

import {
  computePatchId,
  findPatchIdMatch,
  resetPatchIdCache,
} from '../../../core/patch-id/patch-id.js';
import { gitExec } from '../../../git/executor.js';

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;

async function getExecaMock() {
  const { execa } = await import('execa');
  return execa as ReturnType<typeof vi.fn>;
}

describe('computePatchId', () => {
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockExeca = await getExecaMock();
    mockExeca.mockReset();
    mockGitExec.mockReset();
    mockStore.clear();
    resetPatchIdCache();
  });

  it('computes patch-id for a commit via shell pipe', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: 'abc123patchid def456commitsha\n',
      stderr: '',
      exitCode: 0,
    });

    const result = await computePatchId('abc'.padEnd(40, '0'));
    expect(result).toBe('abc123patchid');
  });

  it('returns null on failure', async () => {
    mockExeca.mockRejectedValueOnce(new Error('git failed'));

    const result = await computePatchId('abc'.padEnd(40, '0'));
    expect(result).toBeNull();
  });
});

describe('findPatchIdMatch', () => {
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockExeca = await getExecaMock();
    mockExeca.mockReset();
    mockGitExec.mockReset();
    mockStore.clear();
    resetPatchIdCache();
  });

  it('finds matching commit by patch-id', async () => {
    const targetSha = 'aaa'.padEnd(40, '0');
    const matchSha = 'bbb'.padEnd(40, '0');

    // computePatchId for target
    mockExeca.mockResolvedValueOnce({
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
    mockExeca.mockResolvedValueOnce({
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
    mockExeca.mockResolvedValueOnce({
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
    mockExeca.mockResolvedValueOnce({
      stdout: 'differentpatchid bbb',
      stderr: '',
      exitCode: 0,
    });

    const result = await findPatchIdMatch(targetSha, { scanDepth: 5 });
    expect(result).toBeNull();
  });
});
