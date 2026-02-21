import { describe, it, expect } from 'vitest';
import {
  classifyNode,
  isOrganDirectory,
  ORGAN_DIR_NAMES,
} from '../../../core/organ-classifier.js';

describe('organ-classifier', () => {
  describe('ORGAN_DIR_NAMES', () => {
    it('should include standard organ directory names', () => {
      const expected = ['components', 'utils', 'types', 'hooks', 'helpers', 'lib', 'styles', 'assets', 'constants'];
      for (const name of expected) {
        expect(ORGAN_DIR_NAMES).toContain(name);
      }
    });
  });

  describe('isOrganDirectory', () => {
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
      expect(classifyNode({
        dirName: 'auth',
        hasClaudeMd: true,
        hasSpecMd: false,
        isInsideFractal: false,
      })).toBe('fractal');
    });

    it('should classify as fractal when CLAUDE.md exists even with organ-like name', () => {
      // If someone explicitly gave CLAUDE.md to a "utils" dir, treat it as fractal
      expect(classifyNode({
        dirName: 'utils',
        hasClaudeMd: true,
        hasSpecMd: false,
        isInsideFractal: true,
      })).toBe('fractal');
    });

    it('should classify as organ for known organ dirs inside a fractal without CLAUDE.md', () => {
      expect(classifyNode({
        dirName: 'components',
        hasClaudeMd: false,
        hasSpecMd: false,
        isInsideFractal: true,
      })).toBe('organ');

      expect(classifyNode({
        dirName: 'utils',
        hasClaudeMd: false,
        hasSpecMd: false,
        isInsideFractal: true,
      })).toBe('organ');
    });

    it('should classify as pure-function when no side effects and no CLAUDE.md', () => {
      expect(classifyNode({
        dirName: 'math-helpers',
        hasClaudeMd: false,
        hasSpecMd: false,
        isInsideFractal: false,
        hasSideEffects: false,
      })).toBe('pure-function');
    });

    it('should classify as fractal (without CLAUDE.md) when not organ and has side effects', () => {
      // A non-organ directory with side effects that lacks CLAUDE.md
      // is still a fractal — it just needs a CLAUDE.md added
      expect(classifyNode({
        dirName: 'payments',
        hasClaudeMd: false,
        hasSpecMd: false,
        isInsideFractal: false,
        hasSideEffects: true,
      })).toBe('fractal');
    });

    it('should default hasSideEffects to true when not provided', () => {
      // Unknown dir without CLAUDE.md, no hasSideEffects info → assume fractal
      expect(classifyNode({
        dirName: 'checkout',
        hasClaudeMd: false,
        hasSpecMd: false,
        isInsideFractal: false,
      })).toBe('fractal');
    });

    it('should classify organ dirs at top level (not inside fractal) as organ', () => {
      // Even at top level, a "components" dir without CLAUDE.md is organ-like
      expect(classifyNode({
        dirName: 'components',
        hasClaudeMd: false,
        hasSpecMd: false,
        isInsideFractal: false,
      })).toBe('organ');
    });
  });
});
