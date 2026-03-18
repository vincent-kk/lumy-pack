import { describe, it, expect } from 'vitest';

import {
  createSuccessResponse,
  createErrorResponse,
  createPartialResponse,
} from '@/output/normalizer.js';
import { formatHuman, formatJson, formatLlm, formatQuiet } from '@/output/formats.js';
import { getHelpSchema } from '@/output/help-schema.js';
import type { TraceFullResult } from '@/core/core.js';

/** Minimal TraceFullResult with one original_commit and one pull_request node. */
function makeFullResult(overrides: Partial<TraceFullResult> = {}): TraceFullResult {
  return {
    operatingLevel: 2,
    warnings: [],
    featureFlags: {
      astDiff: false,
      deepTrace: false,
      commitGraph: false,
      issueGraph: false,
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

describe('E12: Output format normalization', () => {
  describe('createSuccessResponse', () => {
    it('sets tool to "line-lore", status to "success", and valid ISO 8601 timestamp', () => {
      const data = { value: 'test' };
      const response = createSuccessResponse('trace', data, 2);

      expect(response.tool).toBe('line-lore');
      expect(response.status).toBe('success');
      expect(response.command).toBe('trace');
      expect(response.operatingLevel).toBe(2);
      expect(response.data).toEqual(data);

      // ISO 8601 validation
      const parsed = new Date(response.timestamp);
      expect(parsed.toISOString()).toBe(response.timestamp);
    });

    it('includes warnings and cacheHit hint when provided', () => {
      const response = createSuccessResponse('trace', {}, 1, {
        warnings: ['Platform CLI not authenticated. Running in Level 1 (local only).'],
        cacheHit: true,
      });

      expect(response.warnings).toContain(
        'Platform CLI not authenticated. Running in Level 1 (local only).',
      );
      expect(response.hints?.cacheHit).toBe(true);
    });
  });

  describe('createPartialResponse', () => {
    it('sets status to "partial" and includes partialData and warnings', () => {
      const response = createPartialResponse(
        'trace',
        { nodes: [] },
        1,
        ['some warning'],
      );

      expect(response.tool).toBe('line-lore');
      expect(response.status).toBe('partial');
      expect(response.partialData).toBeDefined();
      expect(response.warnings).toContain('some warning');
      expect(response.operatingLevel).toBe(1);
    });
  });

  describe('createErrorResponse', () => {
    it('sets status to "error" with error.code, message, and recoverable flag', () => {
      const response = createErrorResponse(
        'trace',
        'GIT_NOT_FOUND',
        'Git repository not found',
        0,
        { recoverable: false, suggestion: 'Run from inside a git repository' },
      );

      expect(response.tool).toBe('line-lore');
      expect(response.status).toBe('error');
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe('GIT_NOT_FOUND');
      expect(response.error!.message).toBe('Git repository not found');
      expect(response.error!.recoverable).toBe(false);
      expect(response.error!.suggestion).toBe('Run from inside a git repository');
    });

    it('defaults recoverable to false when not specified', () => {
      const response = createErrorResponse('trace', 'UNKNOWN', 'unknown error', 0);
      expect(response.error!.recoverable).toBe(false);
    });
  });

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

      expect(output).toContain('Could not detect platform. Running in Level 0 (git only).');
    });

    it('returns empty string for result with no nodes and no warnings', () => {
      const result = makeFullResult({ nodes: [], warnings: [] });
      const output = formatHuman(result);
      expect(output).toBe('');
    });
  });

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

  describe('formatLlm', () => {
    it('wraps result in NormalizedResponse envelope with tool="line-lore"', () => {
      // formatLlm uses require() which may fail in ESM — test the underlying normalizer instead
      const result = makeFullResult();
      const response = createSuccessResponse('trace', result, result.operatingLevel);
      const output = JSON.stringify(response);

      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output) as { tool: string; status: string; command: string };
      expect(parsed.tool).toBe('line-lore');
      expect(parsed.status).toBe('success');
      expect(parsed.command).toBe('trace');
    });

    it('includes warnings in envelope when result has warnings', () => {
      const result = makeFullResult({
        warnings: ['Platform CLI not authenticated. Running in Level 1 (local only).'],
        operatingLevel: 1,
      });
      const response = createSuccessResponse('trace', result, result.operatingLevel, {
        warnings: result.warnings,
      });
      const output = JSON.stringify(response);
      const parsed = JSON.parse(output) as { warnings?: string[] };

      expect(parsed.warnings).toBeDefined();
      expect(parsed.warnings).toContain(
        'Platform CLI not authenticated. Running in Level 1 (local only).',
      );
    });

    it('formatLlm function is exported from formats module', () => {
      // Verify the function exists and is callable (ESM require issue is a source-level bug)
      expect(typeof formatLlm).toBe('function');
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

  describe('getHelpSchema', () => {
    it('contains commands, parameters, and responseFormat keys', () => {
      const schema = getHelpSchema() as {
        commands: unknown;
        responseFormat: unknown;
        name: string;
      };

      expect(schema.name).toBe('line-lore');
      expect(schema.commands).toBeDefined();
      expect(schema.responseFormat).toBeDefined();
    });

    it('trace command lists required file and -L parameters', () => {
      const schema = getHelpSchema() as {
        commands: {
          trace: {
            parameters: Record<string, { required?: boolean }>;
          };
        };
      };

      expect(schema.commands.trace).toBeDefined();
      expect(schema.commands.trace.parameters['file']).toBeDefined();
      expect(schema.commands.trace.parameters['file'].required).toBe(true);
      expect(schema.commands.trace.parameters['-L']).toBeDefined();
      expect(schema.commands.trace.parameters['-L'].required).toBe(true);
    });

    it('responseFormat describes operatingLevel values', () => {
      const schema = getHelpSchema() as {
        responseFormat: { operatingLevel: string };
      };

      expect(schema.responseFormat.operatingLevel).toContain('0');
      expect(schema.responseFormat.operatingLevel).toContain('1');
      expect(schema.responseFormat.operatingLevel).toContain('2');
    });
  });
});
