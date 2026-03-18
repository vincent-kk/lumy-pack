import { describe, expect, it } from 'vitest';

import type { TraceFullResult } from '@/core/core.js';

import { formatHuman, formatJson, formatQuiet } from '../formats.js';

const mockResult: TraceFullResult = {
  nodes: [
    {
      type: 'original_commit',
      sha: 'abc1234567890123456789012345678901234567',
      trackingMethod: 'blame-CMw',
      confidence: 'exact',
    },
    {
      type: 'pull_request',
      sha: 'def4567890123456789012345678901234567890',
      trackingMethod: 'api',
      confidence: 'exact',
      prNumber: 42,
      prTitle: 'Fix auth bug',
      prUrl: 'https://github.com/org/repo/pull/42',
    },
  ],
  operatingLevel: 2,
  featureFlags: {
    astDiff: true,
    deepTrace: false,
    commitGraph: false,
    issueGraph: false,
    graphql: true,
  },
  warnings: [],
};

describe('formatHuman', () => {
  it('formats trace result for human reading', () => {
    const output = formatHuman(mockResult);
    expect(output).toContain('abc1234');
    expect(output).toContain('PR #42');
  });
});

describe('formatJson', () => {
  it('formats trace result as JSON', () => {
    const output = formatJson(mockResult);
    const parsed = JSON.parse(output);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.operatingLevel).toBe(2);
  });
});

describe('formatQuiet', () => {
  it('returns PR number only', () => {
    expect(formatQuiet(mockResult)).toBe('42');
  });

  it('returns commit SHA when no PR found', () => {
    const noPR: TraceFullResult = {
      ...mockResult,
      nodes: [mockResult.nodes[0]],
    };
    expect(formatQuiet(noPR)).toBe('abc1234');
  });
});
