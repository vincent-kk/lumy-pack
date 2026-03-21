import { describe, expect, it } from 'vitest';

import type { TraceFullResult } from '@/core/core.js';
import { formatHuman, formatQuiet } from '@/output/formats.js';

/** Minimal TraceFullResult with one original_commit and one pull_request node. */
function makeFullResult(
  overrides: Partial<TraceFullResult> = {},
): TraceFullResult {
  return {
    operatingLevel: 2,
    warnings: [],
    featureFlags: {
      astDiff: false,
      deepTrace: false,
      commitGraph: false,

      graphql: true,
    },
    nodes: [
      {
        type: 'original_commit',
        sha: 'abc1234567890123456789012345678901234567',
        trackingMethod: 'blame-CMw',
        confidence: 'exact',
      },
      {
        type: 'pull_request',
        sha: 'def1234567890123456789012345678901234567',
        trackingMethod: 'api',
        confidence: 'exact',
        prNumber: 42,
        prUrl: 'https://github.com/test/repo/pull/42',
        prTitle: 'feat: add awesome feature',
      },
    ],
    ...overrides,
  };
}

describe('E12: Output format — human-readable', () => {
  describe('formatHuman', () => {
    it('contains commit SHA (short) and PR number', () => {
      const result = makeFullResult();
      const output = formatHuman(result);

      // Short SHA (7 chars) of the commit node
      expect(output).toContain('abc1234');
      // PR number
      expect(output).toContain('42');
    });

    it('includes warning lines when warnings are present', () => {
      const result = makeFullResult({
        warnings: ['Could not detect platform. Running in Level 0 (git only).'],
      });
      const output = formatHuman(result);

      expect(output).toContain(
        'Could not detect platform. Running in Level 0 (git only).',
      );
    });

    it('returns empty string for result with no nodes and no warnings', () => {
      const result = makeFullResult({ nodes: [], warnings: [] });
      const output = formatHuman(result);
      expect(output).toBe('');
    });
  });

  describe('formatQuiet', () => {
    it('returns PR number as string when pull_request node is present', () => {
      const result = makeFullResult();
      const output = formatQuiet(result);
      expect(output).toBe('42');
    });

    it('returns short SHA when no pull_request node is present', () => {
      const result = makeFullResult({
        nodes: [
          {
            type: 'original_commit',
            sha: 'abc1234567890123456789012345678901234567',
            trackingMethod: 'blame-CMw',
            confidence: 'exact',
          },
        ],
      });
      const output = formatQuiet(result);
      expect(output).toBe('abc1234');
    });

    it('returns empty string when nodes array is empty', () => {
      const result = makeFullResult({ nodes: [] });
      const output = formatQuiet(result);
      expect(output).toBe('');
    });
  });
});
