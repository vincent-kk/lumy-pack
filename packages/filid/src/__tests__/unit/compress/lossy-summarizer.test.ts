import { describe, it, expect } from 'vitest';
import { summarizeLossy } from '../../../compress/lossy-summarizer.js';

describe('lossy-summarizer', () => {
  it('should merge multiple tool call entries into a summary', () => {
    const entries = [
      { tool: 'Read', path: '/app/a.ts', timestamp: '2026-01-01T00:00:00Z' },
      { tool: 'Read', path: '/app/b.ts', timestamp: '2026-01-01T00:01:00Z' },
      { tool: 'Edit', path: '/app/a.ts', timestamp: '2026-01-01T00:02:00Z' },
    ];
    const result = summarizeLossy(entries);
    expect(result.summary.toolCounts.Read).toBe(2);
    expect(result.summary.toolCounts.Edit).toBe(1);
    expect(result.summary.uniqueFiles).toContain('/app/a.ts');
    expect(result.summary.uniqueFiles).toContain('/app/b.ts');
    expect(result.recoverable).toBe(false);
  });

  it('should count total entries', () => {
    const entries = [
      { tool: 'Write', path: '/app/x.ts', timestamp: '2026-01-01T00:00:00Z' },
      { tool: 'Write', path: '/app/y.ts', timestamp: '2026-01-02T00:00:00Z' },
    ];
    const result = summarizeLossy(entries);
    expect(result.summary.totalEntries).toBe(2);
  });

  it('should capture time range', () => {
    const entries = [
      { tool: 'Read', path: '/a.ts', timestamp: '2026-01-01T00:00:00Z' },
      { tool: 'Read', path: '/b.ts', timestamp: '2026-01-05T12:00:00Z' },
    ];
    const result = summarizeLossy(entries);
    expect(result.summary.timeRange.earliest).toBe('2026-01-01T00:00:00Z');
    expect(result.summary.timeRange.latest).toBe('2026-01-05T12:00:00Z');
  });

  it('should handle empty entries', () => {
    const result = summarizeLossy([]);
    expect(result.summary.totalEntries).toBe(0);
    expect(result.summary.uniqueFiles).toHaveLength(0);
    expect(result.summary.toolCounts).toEqual({});
  });

  it('should produce a JSON-serializable result', () => {
    const entries = [
      { tool: 'Read', path: '/a.ts', timestamp: '2026-01-01T00:00:00Z' },
    ];
    const result = summarizeLossy(entries);
    const json = JSON.stringify(result);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should include compression meta with method "lossy"', () => {
    const entries = [
      { tool: 'Read', path: '/a.ts', timestamp: '2026-01-01T00:00:00Z' },
    ];
    const result = summarizeLossy(entries);
    expect(result.meta.method).toBe('lossy');
    expect(result.meta.recoverable).toBe(false);
  });
});
