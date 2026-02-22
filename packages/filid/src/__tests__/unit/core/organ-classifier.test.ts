import { describe, expect, it } from 'vitest';

import {
  LEGACY_ORGAN_DIR_NAMES,
  ORGAN_DIR_NAMES,
  classifyNode,
  isOrganDirectory,
} from '../../../core/organ-classifier.js';

describe('organ-classifier', () => {
  describe('ORGAN_DIR_NAMES (deprecated alias)', () => {
    it('should include standard organ directory names', () => {
      const expected = [
        'components',
        'utils',
        'types',
        'hooks',
        'helpers',
        'lib',
        'styles',
        'assets',
        'constants',
      ];
      for (const name of expected) {
        expect(ORGAN_DIR_NAMES).toContain(name);
      }
    });

    it('LEGACY_ORGAN_DIR_NAMES should equal ORGAN_DIR_NAMES', () => {
      expect(LEGACY_ORGAN_DIR_NAMES).toBe(ORGAN_DIR_NAMES);
    });
  });

  describe('isOrganDirectory (deprecated)', () => {
    it('should return true for known organ directory names', () => {
      expect(isOrganDirectory('components')).toBe(true);
      expect(isOrganDirectory('utils')).toBe(true);
      expect(isOrganDirectory('types')).toBe(true);
      expect(isOrganDirectory('hooks')).toBe(true);
      expect(isOrganDirectory('helpers')).toBe(true);
      expect(isOrganDirectory('lib')).toBe(true);
      expect(isOrganDirectory('styles')).toBe(true);
      expect(isOrganDirectory('assets')).toBe(true);
      expect(isOrganDirectory('constants')).toBe(true);
    });

    it('should return false for non-organ directory names', () => {
      expect(isOrganDirectory('auth')).toBe(false);
      expect(isOrganDirectory('dashboard')).toBe(false);
      expect(isOrganDirectory('payments')).toBe(false);
      expect(isOrganDirectory('src')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isOrganDirectory('Components')).toBe(false);
      expect(isOrganDirectory('UTILS')).toBe(false);
    });
  });

  describe('classifyNode', () => {
    it('should classify as fractal when CLAUDE.md exists', () => {
      expect(
        classifyNode({
          dirName: 'auth',
          hasClaudeMd: true,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('fractal');
    });

    it('should classify as fractal when SPEC.md exists', () => {
      expect(
        classifyNode({
          dirName: 'auth',
          hasClaudeMd: false,
          hasSpecMd: true,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('fractal');
    });

    it('should classify as fractal when CLAUDE.md exists even for leaf directory without fractal children', () => {
      expect(
        classifyNode({
          dirName: 'utils',
          hasClaudeMd: true,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('fractal');
    });

    it('should classify as organ when leaf directory with no fractal children and no CLAUDE.md/SPEC.md', () => {
      expect(
        classifyNode({
          dirName: 'components',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('organ');

      expect(
        classifyNode({
          dirName: 'utils',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('organ');
    });

    it('should classify non-standard dir as organ when leaf with no fractal children', () => {
      expect(
        classifyNode({
          dirName: 'my-custom-dir',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('organ');
    });

    it('should classify as pure-function when no side effects and no CLAUDE.md/SPEC.md', () => {
      expect(
        classifyNode({
          dirName: 'math-helpers',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
          hasSideEffects: false,
        }),
      ).toBe('pure-function');
    });

    it('should classify as fractal when has fractal children even without CLAUDE.md', () => {
      expect(
        classifyNode({
          dirName: 'payments',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: true,
          isLeafDirectory: false,
          hasSideEffects: true,
        }),
      ).toBe('fractal');
    });

    it('should classify as fractal when not leaf and has side effects', () => {
      expect(
        classifyNode({
          dirName: 'checkout',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
          hasSideEffects: true,
        }),
      ).toBe('fractal');
    });

    it('should default hasSideEffects to true when not provided (non-leaf)', () => {
      expect(
        classifyNode({
          dirName: 'checkout',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
        }),
      ).toBe('fractal');
    });

    it('should prioritize CLAUDE.md over SPEC.md', () => {
      expect(
        classifyNode({
          dirName: 'auth',
          hasClaudeMd: true,
          hasSpecMd: true,
          hasFractalChildren: false,
          isLeafDirectory: true,
        }),
      ).toBe('fractal');
    });
  });
});
