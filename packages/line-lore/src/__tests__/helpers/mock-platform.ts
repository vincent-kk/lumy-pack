import { vi } from 'vitest';

import type {
  AuthStatus,
  IssueInfo,
  PlatformAdapter,
  PlatformType,
  PRInfo,
  RateLimitInfo,
} from '../../types/index.js';

export interface MockPlatformOptions {
  platform?: PlatformType;
  authenticated?: boolean;
  prMap?: Map<string, PRInfo>;
  issueLinks?: Map<number, IssueInfo[]>;
  prLinks?: Map<number, PRInfo[]>;
}

/**
 * Create a mock PlatformAdapter for testing.
 *
 * The `prMap` maps commit SHA → PRInfo for getPRForCommit lookups.
 * The `issueLinks` maps PR number → linked issues.
 * The `prLinks` maps issue number → linked PRs.
 */
export function createMockPlatformAdapter(
  options: MockPlatformOptions = {},
): PlatformAdapter {
  const {
    platform = 'github',
    authenticated = true,
    prMap = new Map(),
    issueLinks = new Map(),
    prLinks = new Map(),
  } = options;

  return {
    platform,
    checkAuth: vi.fn().mockResolvedValue({
      authenticated,
      username: authenticated ? 'test-user' : undefined,
    } satisfies AuthStatus),
    getPRForCommit: vi.fn().mockImplementation(async (sha: string) => {
      return prMap.get(sha) ?? null;
    }),
    getPRCommits: vi.fn().mockResolvedValue([]),
    getLinkedIssues: vi.fn().mockImplementation(async (prNumber: number) => {
      return issueLinks.get(prNumber) ?? [];
    }),
    getLinkedPRs: vi.fn().mockImplementation(async (issueNumber: number) => {
      return prLinks.get(issueNumber) ?? [];
    }),
    getRateLimit: vi.fn().mockResolvedValue({
      limit: 5000,
      remaining: 4999,
      resetAt: new Date(Date.now() + 3600000).toISOString(),
    } satisfies RateLimitInfo),
  };
}

/** Create a no-auth adapter that simulates Level 1 (CLI not authenticated). */
export function createUnauthenticatedAdapter(
  platform: PlatformType = 'github',
): PlatformAdapter {
  return createMockPlatformAdapter({ platform, authenticated: false });
}

/** Convenience: create a PRInfo object with sensible defaults. */
export function createPRInfo(overrides: Partial<PRInfo> & { number: number }): PRInfo {
  return {
    title: `PR #${overrides.number}`,
    author: 'test-user',
    url: `https://github.com/test/repo/pull/${overrides.number}`,
    mergeCommit: '0'.repeat(40),
    baseBranch: 'main',
    ...overrides,
  };
}
