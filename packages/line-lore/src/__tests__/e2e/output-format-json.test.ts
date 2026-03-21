import { describe, expect, it } from 'vitest';

import type { TraceFullResult } from '@/core/core.js';
import { formatJson } from '@/output/formats.js';
import { ALL_COMMANDS, TRACE_COMMAND } from '@/utils/command-registry.js';

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

describe('E12: Output format — JSON and command registry', () => {
  describe('formatJson', () => {
    it('returns valid JSON that parses back to the original result', () => {
      const result = makeFullResult();
      const output = formatJson(result);

      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output) as TraceFullResult;
      expect(parsed.operatingLevel).toBe(2);
      expect(parsed.nodes).toHaveLength(2);
    });

    it('pretty-prints with 2-space indentation', () => {
      const result = makeFullResult({ nodes: [] });
      const output = formatJson(result);

      // Pretty-printed JSON has newlines and spaces
      expect(output).toContain('\n');
      expect(output).toContain('  ');
    });
  });

  describe('command-registry', () => {
    it('ALL_COMMANDS contains all 4 commands', () => {
      expect(ALL_COMMANDS).toHaveLength(4);
      const names = ALL_COMMANDS.map((c) => c.name);
      expect(names).toContain('trace');
      expect(names).toContain('health');
      expect(names).toContain('cache');
      expect(names).toContain('graph');
    });

    it('trace command has required file argument and options', () => {
      expect(TRACE_COMMAND.arguments).toBeDefined();
      expect(TRACE_COMMAND.arguments![0].name).toBe('file');
      expect(TRACE_COMMAND.arguments![0].required).toBe(true);
      expect(TRACE_COMMAND.options).toBeDefined();
      expect(TRACE_COMMAND.options!.length).toBeGreaterThan(0);
    });

    it('graph and cache commands have subcommands', () => {
      const graph = ALL_COMMANDS.find((c) => c.name === 'graph')!;
      const cache = ALL_COMMANDS.find((c) => c.name === 'cache')!;
      expect(graph.subcommands).toBeDefined();
      expect(graph.subcommands!.length).toBe(2);
      expect(cache.subcommands).toBeDefined();
      expect(cache.subcommands!.length).toBe(2);
    });
  });
});
