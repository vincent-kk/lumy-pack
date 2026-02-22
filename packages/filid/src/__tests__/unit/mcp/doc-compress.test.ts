import { describe, expect, it } from 'vitest';

import { handleDocCompress } from '../../../mcp/tools/doc-compress.js';

describe('doc-compress tool', () => {
  describe('mode: reversible', () => {
    it('should compact a file into a reference', () => {
      const result = handleDocCompress({
        mode: 'reversible',
        filePath: '/app/src/auth/login.ts',
        content: 'export function login() {}\nexport function logout() {}\n',
        exports: ['login', 'logout'],
      });
      expect(result.compacted).toContain('[REF]');
      expect(result.compacted).toContain('login');
      expect(result.meta?.method).toBe('reversible');
      expect(result.meta?.recoverable).toBe(true);
    });
  });

  describe('mode: lossy', () => {
    it('should summarize tool call entries', () => {
      const result = handleDocCompress({
        mode: 'lossy',
        toolCallEntries: [
          { tool: 'Read', path: '/a.ts', timestamp: '2026-01-01T00:00:00Z' },
          { tool: 'Read', path: '/b.ts', timestamp: '2026-01-01T00:01:00Z' },
          { tool: 'Edit', path: '/a.ts', timestamp: '2026-01-01T00:02:00Z' },
        ],
      });
      expect(result.summary).toBeDefined();
      expect(result.summary!.totalEntries).toBe(3);
      expect(result.summary!.toolCounts.Read).toBe(2);
      expect(result.meta?.method).toBe('lossy');
      expect(result.meta?.recoverable).toBe(false);
    });
  });

  describe('mode: auto', () => {
    it('should choose reversible when file content is provided', () => {
      const result = handleDocCompress({
        mode: 'auto',
        filePath: '/app/src/x.ts',
        content: 'export const x = 1;\n',
        exports: ['x'],
      });
      expect(result.meta?.method).toBe('reversible');
    });

    it('should choose lossy when tool call entries are provided', () => {
      const result = handleDocCompress({
        mode: 'auto',
        toolCallEntries: [
          { tool: 'Read', path: '/a.ts', timestamp: '2026-01-01T00:00:00Z' },
        ],
      });
      expect(result.meta?.method).toBe('lossy');
    });
  });

  describe('error handling', () => {
    it('should return error when reversible mode has no content', () => {
      const result = handleDocCompress({
        mode: 'reversible',
        filePath: '/app/x.ts',
      });
      expect(result.error).toBeDefined();
    });
  });
});
