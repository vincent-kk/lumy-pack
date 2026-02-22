import { describe, expect, it } from 'vitest';

import type { NodeEntry } from '../../../core/fractal-tree.js';
import { handleFractalNavigate } from '../../../mcp/tools/fractal-navigate.js';

describe('fractal-navigate tool', () => {
  const sampleEntries: NodeEntry[] = [
    {
      name: 'src',
      path: '/app/src',
      type: 'fractal',
      hasClaudeMd: true,
      hasSpecMd: false,
    },
    {
      name: 'auth',
      path: '/app/src/auth',
      type: 'fractal',
      hasClaudeMd: true,
      hasSpecMd: true,
    },
    {
      name: 'utils',
      path: '/app/src/utils',
      type: 'organ',
      hasClaudeMd: false,
      hasSpecMd: false,
    },
    {
      name: 'components',
      path: '/app/src/components',
      type: 'organ',
      hasClaudeMd: false,
      hasSpecMd: false,
    },
  ];

  describe('action: classify', () => {
    it('should classify a fractal directory', () => {
      const result = handleFractalNavigate({
        action: 'classify',
        path: '/app/src/auth',
        entries: sampleEntries,
      });
      expect(result.classification).toBe('fractal');
    });

    it('should classify an organ directory', () => {
      const result = handleFractalNavigate({
        action: 'classify',
        path: '/app/src/utils',
        entries: sampleEntries,
      });
      expect(result.classification).toBe('organ');
    });
  });

  describe('action: sibling-list', () => {
    it('should list siblings of a directory', () => {
      const result = handleFractalNavigate({
        action: 'sibling-list',
        path: '/app/src/auth',
        entries: sampleEntries,
      });
      expect(result.siblings).toBeDefined();
      expect(result.siblings!.length).toBeGreaterThan(0);
    });
  });

  describe('action: tree', () => {
    it('should build a fractal tree from entries', () => {
      const result = handleFractalNavigate({
        action: 'tree',
        path: '/app',
        entries: sampleEntries,
      });
      expect(result.tree).toBeDefined();
      expect(result.tree!.root).toBe('/app/src');
      expect(result.tree!.nodes.size).toBeGreaterThan(0);
    });
  });

  describe('handleFractalNavigate — classify action (bug fix)', () => {
    it('should classify as fractal when entry has fractal children', () => {
      const result = handleFractalNavigate({
        action: 'classify',
        path: '/project/auth',
        entries: [
          {
            path: '/project/auth',
            name: 'auth',
            type: 'fractal',
            hasClaudeMd: false,
            hasSpecMd: false,
          },
          {
            path: '/project/auth/login',
            name: 'login',
            type: 'fractal',
            hasClaudeMd: false,
            hasSpecMd: false,
            hasIndex: true,
          },
        ],
      });
      expect(result.classification).toBe('fractal');
    });

    it('should classify as organ when entry is leaf with no fractal children', () => {
      const result = handleFractalNavigate({
        action: 'classify',
        path: '/project/auth/utils',
        entries: [
          {
            path: '/project/auth/utils',
            name: 'utils',
            type: 'organ',
            hasClaudeMd: false,
            hasSpecMd: false,
          },
        ],
      });
      expect(result.classification).toBe('organ');
    });

    it('should classify as fractal when entry hasIndex=true and non-organ name', () => {
      const result = handleFractalNavigate({
        action: 'classify',
        path: '/project/auth/login',
        entries: [
          {
            path: '/project/auth/login',
            name: 'login',
            type: 'fractal',
            hasClaudeMd: false,
            hasSpecMd: false,
            hasIndex: true,
          },
        ],
      });
      expect(result.classification).toBe('fractal');
    });
  });

  describe('error handling', () => {
    it('should return error for unknown action', () => {
      const result = handleFractalNavigate({
        action: 'unknown' as any,
        path: '/app',
        entries: sampleEntries,
      });
      expect(result.error).toBeDefined();
    });

    it('should handle empty entries', () => {
      const result = handleFractalNavigate({
        action: 'tree',
        path: '/app',
        entries: [],
      });
      expect(result.tree).toBeDefined();
      expect(result.tree!.nodes.size).toBe(0);
    });
  });
});
