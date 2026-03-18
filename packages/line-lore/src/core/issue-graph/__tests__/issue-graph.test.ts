import { describe, expect, it, vi } from 'vitest';

import type { IssueInfo, PRInfo, PlatformAdapter } from '@/types/index.js';

import { traverseIssueGraph } from '../issue-graph.js';

function createMockAdapter(
  linkedIssues: IssueInfo[] = [],
  linkedPRs: PRInfo[] = [],
): PlatformAdapter {
  return {
    platform: 'github',
    checkAuth: vi.fn(),
    getPRForCommit: vi.fn().mockResolvedValue(null),
    getPRCommits: vi.fn().mockResolvedValue([]),
    getLinkedIssues: vi.fn().mockResolvedValue(linkedIssues),
    getLinkedPRs: vi.fn().mockResolvedValue(linkedPRs),
    getRateLimit: vi.fn(),
  };
}

describe('traverseIssueGraph', () => {
  it('traverses PR → linked issues', async () => {
    const adapter = createMockAdapter([
      { number: 55, title: 'Bug fix', url: '', state: 'closed', labels: [] },
    ]);

    const result = await traverseIssueGraph(adapter, 'pr', 102, {
      maxDepth: 1,
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].type).toBe('pull_request');
    expect(result.nodes[0].prNumber).toBe(102);
    expect(result.nodes[1].type).toBe('issue');
    expect(result.nodes[1].issueNumber).toBe(55);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].relation).toBe('closes');
  });

  it('traverses issue → linked PRs', async () => {
    const adapter = createMockAdapter(
      [],
      [
        {
          number: 42,
          title: 'Fix',
          author: '',
          url: '',
          mergeCommit: '',
          baseBranch: 'main',
        },
      ],
    );

    const result = await traverseIssueGraph(adapter, 'issue', 55, {
      maxDepth: 1,
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].type).toBe('issue');
    expect(result.nodes[1].type).toBe('pull_request');
  });

  it('prevents cycle detection', async () => {
    const adapter = createMockAdapter(
      [{ number: 1, title: '', url: '', state: 'open', labels: [] }],
      [
        {
          number: 2,
          title: '',
          author: '',
          url: '',
          mergeCommit: '',
          baseBranch: '',
        },
      ],
    );

    const result = await traverseIssueGraph(adapter, 'pr', 2, { maxDepth: 5 });

    // Should not infinite loop
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.nodes.length).toBeLessThan(10);
  });

  it('respects max depth', async () => {
    const adapter = createMockAdapter([
      { number: 1, title: '', url: '', state: 'open', labels: [] },
    ]);

    const result = await traverseIssueGraph(adapter, 'pr', 100, {
      maxDepth: 0,
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });
});
