import { describe, it, expect } from 'vitest';

import {
  createSuccessResponse,
  createErrorResponse,
  createPartialResponse,
} from '../../output/normalizer.js';

describe('createSuccessResponse', () => {
  it('creates a success response envelope', () => {
    const response = createSuccessResponse('trace', { nodes: [] }, 2);
    expect(response.tool).toBe('line-lore');
    expect(response.command).toBe('trace');
    expect(response.status).toBe('success');
    expect(response.operatingLevel).toBe(2);
    expect(response.data).toEqual({ nodes: [] });
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes warnings when provided', () => {
    const response = createSuccessResponse('trace', {}, 1, {
      warnings: ['Auth not available'],
    });
    expect(response.warnings).toEqual(['Auth not available']);
  });
});

describe('createErrorResponse', () => {
  it('creates an error response', () => {
    const response = createErrorResponse(
      'trace',
      'FILE_NOT_FOUND',
      'File not found: src/foo.ts',
      0,
      { stage: 1, recoverable: false },
    );
    expect(response.status).toBe('error');
    expect(response.error?.code).toBe('FILE_NOT_FOUND');
    expect(response.error?.stage).toBe(1);
    expect(response.error?.recoverable).toBe(false);
  });
});

describe('createPartialResponse', () => {
  it('creates a partial response', () => {
    const response = createPartialResponse(
      'trace',
      { nodes: [] },
      1,
      ['API unavailable'],
    );
    expect(response.status).toBe('partial');
    expect(response.partialData).toEqual({ nodes: [] });
    expect(response.warnings).toEqual(['API unavailable']);
  });
});
