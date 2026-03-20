import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectPlatformAdapter } from '@/platform/index.js';
import type { PlatformAdapter } from '@/types/index.js';

import { graph } from '../core.js';

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

const mockDetectPlatformAdapter = detectPlatformAdapter as ReturnType<
  typeof vi.fn
>;

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

describe('graph()', () => {
  beforeEach(() => {
    mockDetectPlatformAdapter.mockReset();
  });

  it('returns graph result when authenticated', async () => {
    const adapter = createMockAdapter(true);
    (adapter.getLinkedIssues as ReturnType<typeof vi.fn>).mockResolvedValue([
      { number: 10, title: 'Fix bug', state: 'closed', url: '' },
    ]);
    mockDetectPlatformAdapter.mockResolvedValue({ adapter });

    const result = await graph({ type: 'pr', number: 42, depth: 1 });

    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();
    // Should have PR node and issue node
    const prNode = result.nodes.find((n) => n.type === 'pull_request');
    const issueNode = result.nodes.find((n) => n.type === 'issue');
    expect(prNode).toBeDefined();
    expect(prNode!.prNumber).toBe(42);
    expect(issueNode).toBeDefined();
    expect(issueNode!.issueNumber).toBe(10);
  });

  it('throws LineLoreError when not authenticated', async () => {
    const adapter = createMockAdapter(false);
    mockDetectPlatformAdapter.mockResolvedValue({ adapter });

    await expect(graph({ type: 'pr', number: 42 })).rejects.toThrow(
      /not authenticated/i,
    );
  });

  it('throws when platform detection fails', async () => {
    mockDetectPlatformAdapter.mockRejectedValue(new Error('no platform'));

    await expect(graph({ type: 'issue', number: 10 })).rejects.toThrow();
  });
});
