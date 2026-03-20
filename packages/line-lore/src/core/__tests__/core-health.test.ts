import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gitExec } from '@/git/executor.js';
import { detectPlatformAdapter } from '@/platform/index.js';
import type { PlatformAdapter } from '@/types/index.js';

import { health } from '../core.js';

// Module mocks

vi.mock('@/git/executor.js', () => ({
  gitExec: vi.fn(),
}));

vi.mock('@/platform/index.js', () => ({
  detectPlatformAdapter: vi.fn(),
}));

vi.mock('@/ast/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/ast/index.js')>();
  return { ...original, isAstAvailable: vi.fn().mockReturnValue(false) };
});

vi.mock('@/cache/file-cache.js', () => ({
  FileCache: class {
    async get() {
      return null;
    }
    async set() {}
    async clear() {}
  },
}));

vi.mock('execa', () => ({
  execa: vi.fn().mockRejectedValue(new Error('no execa in test')),
}));

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;
const mockDetectPlatformAdapter = detectPlatformAdapter as ReturnType<
  typeof vi.fn
>;

/** Shorthand: resolved GitExecResult */
function gitOk(stdout: string) {
  return Promise.resolve({ stdout, stderr: '', exitCode: 0 });
}

function createMockAdapter(authenticated = true): PlatformAdapter {
  return {
    platform: 'github',
    checkAuth: vi.fn().mockResolvedValue({
      authenticated,
      username: authenticated ? 'test-user' : undefined,
    }),
    getPRForCommit: vi.fn().mockResolvedValue(null),
    getPRCommits: vi.fn().mockResolvedValue([]),
    getLinkedIssues: vi.fn().mockResolvedValue([]),
    getLinkedPRs: vi.fn().mockResolvedValue([]),
    getRateLimit: vi.fn().mockResolvedValue({
      limit: 5000,
      remaining: 4999,
      resetAt: new Date().toISOString(),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('health()', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
    mockDetectPlatformAdapter.mockReset();
  });

  it('returns HealthReport with operatingLevel=2 when authenticated', async () => {
    const adapter = createMockAdapter(true);
    mockDetectPlatformAdapter.mockResolvedValue({ adapter });

    // checkGitHealth calls: git version + git commit-graph verify
    mockGitExec.mockResolvedValueOnce(gitOk('git version 2.40.0'));
    mockGitExec.mockResolvedValueOnce(gitOk('')); // commit-graph verify

    const result = await health();

    expect(result.operatingLevel).toBe(2);
    expect(result.gitVersion).toBe('2.40.0');
    expect(result.bloomFilter).toBe(true);
    expect(result.commitGraph).toBe(true);
  });

  it('returns operatingLevel=0 when platform detection fails', async () => {
    mockDetectPlatformAdapter.mockRejectedValue(new Error('no platform'));

    mockGitExec.mockResolvedValueOnce(gitOk('git version 2.39.0'));
    mockGitExec.mockResolvedValueOnce(gitOk(''));

    const result = await health();

    expect(result.operatingLevel).toBe(0);
    expect(result.gitVersion).toBe('2.39.0');
  });

  it('includes hint when git version is below bloom filter minimum', async () => {
    const adapter = createMockAdapter(true);
    mockDetectPlatformAdapter.mockResolvedValue({ adapter });

    // version 2.26.0 is below 2.27.0 bloom filter threshold
    mockGitExec.mockResolvedValueOnce(gitOk('git version 2.26.0'));
    mockGitExec.mockRejectedValueOnce(new Error('no commit-graph')); // commit-graph verify fails

    const result = await health();

    expect(result.bloomFilter).toBe(false);
    expect(result.hints.some((h) => /bloom/i.test(h))).toBe(true);
  });
});
