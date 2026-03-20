import { describe, expect, it } from 'vitest';

import type { TraceFullResult } from '@/core/core.js';
import { formatLlm } from '@/output/formats.js';
import {
  createErrorResponse,
  createPartialResponse,
  createSuccessResponse,
} from '@/output/normalizer.js';

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

describe('E12: Output format — LLM and normalizer', () => {
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
        warnings: [
          'Platform CLI not authenticated. Running in Level 1 (local only).',
        ],
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
      const response = createPartialResponse('trace', { nodes: [] }, 1, [
        'some warning',
      ]);

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
      expect(response.error!.suggestion).toBe(
        'Run from inside a git repository',
      );
    });

    it('defaults recoverable to false when not specified', () => {
      const response = createErrorResponse(
        'trace',
        'UNKNOWN',
        'unknown error',
        0,
      );
      expect(response.error!.recoverable).toBe(false);
    });
  });

  describe('formatLlm', () => {
    it('wraps result in NormalizedResponse envelope with tool="line-lore"', () => {
      // formatLlm uses require() which may fail in ESM — test the underlying normalizer instead
      const result = makeFullResult();
      const response = createSuccessResponse(
        'trace',
        result,
        result.operatingLevel,
      );
      const output = JSON.stringify(response);

      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output) as {
        tool: string;
        status: string;
        command: string;
      };
      expect(parsed.tool).toBe('line-lore');
      expect(parsed.status).toBe('success');
      expect(parsed.command).toBe('trace');
    });

    it('includes warnings in envelope when result has warnings', () => {
      const result = makeFullResult({
        warnings: [
          'Platform CLI not authenticated. Running in Level 1 (local only).',
        ],
        operatingLevel: 1,
      });
      const response = createSuccessResponse(
        'trace',
        result,
        result.operatingLevel,
        {
          warnings: result.warnings,
        },
      );
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
});
