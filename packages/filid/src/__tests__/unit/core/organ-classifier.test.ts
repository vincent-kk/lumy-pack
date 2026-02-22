import { describe, expect, it } from 'vitest';

import {
  KNOWN_ORGAN_DIR_NAMES,
  classifyNode,
  isInfraOrgDirectoryByPattern,
} from '../../../core/organ-classifier.js';

describe('organ-classifier', () => {
  describe('isInfraOrgDirectoryByPattern', () => {
    it('should match double-underscore wrapped names', () => {
      expect(isInfraOrgDirectoryByPattern('__tests__')).toBe(true);
      expect(isInfraOrgDirectoryByPattern('__mocks__')).toBe(true);
      expect(isInfraOrgDirectoryByPattern('__fixtures__')).toBe(true);
      expect(isInfraOrgDirectoryByPattern('__custom__')).toBe(true);
    });

    it('should match dot-prefixed names', () => {
      expect(isInfraOrgDirectoryByPattern('.git')).toBe(true);
      expect(isInfraOrgDirectoryByPattern('.github')).toBe(true);
      expect(isInfraOrgDirectoryByPattern('.vscode')).toBe(true);
      expect(isInfraOrgDirectoryByPattern('.claude')).toBe(true);
    });

    it('should not match single-underscore or non-wrapped names', () => {
      expect(isInfraOrgDirectoryByPattern('_helpers_')).toBe(false);
      expect(isInfraOrgDirectoryByPattern('__')).toBe(false);
      expect(isInfraOrgDirectoryByPattern('tests')).toBe(false);
      expect(isInfraOrgDirectoryByPattern('auth')).toBe(false);
    });
  });

  describe('KNOWN_ORGAN_DIR_NAMES', () => {
    it('should include standard UI/shared organ directory names', () => {
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
        expect(KNOWN_ORGAN_DIR_NAMES).toContain(name);
      }
    });

    it('should include test infrastructure directory names not covered by pattern', () => {
      const nonPatternTestDirs = [
        'test',
        'tests',
        'spec',
        'specs',
        'fixtures',
        'e2e',
      ];
      for (const name of nonPatternTestDirs) {
        expect(KNOWN_ORGAN_DIR_NAMES).toContain(name);
      }
    });

    it('should not include __*__ names (covered by isInfraOrgDirectoryByPattern)', () => {
      expect(KNOWN_ORGAN_DIR_NAMES).not.toContain('__tests__');
      expect(KNOWN_ORGAN_DIR_NAMES).not.toContain('__mocks__');
      expect(KNOWN_ORGAN_DIR_NAMES).not.toContain('__fixtures__');
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

    it('should classify __tests__ as organ even when not a leaf directory', () => {
      expect(
        classifyNode({
          dirName: '__tests__',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
        }),
      ).toBe('organ');
    });

    it('should classify test infrastructure dirs as organ regardless of structure', () => {
      const testDirs = [
        '__mocks__',
        '__fixtures__',
        'test',
        'tests',
        'spec',
        'specs',
        'fixtures',
        'e2e',
      ];
      for (const dirName of testDirs) {
        expect(
          classifyNode({
            dirName,
            hasClaudeMd: false,
            hasSpecMd: false,
            hasFractalChildren: false,
            isLeafDirectory: false,
          }),
        ).toBe('organ');
      }
    });

    it('should still classify __tests__ as fractal when CLAUDE.md explicitly exists', () => {
      expect(
        classifyNode({
          dirName: '__tests__',
          hasClaudeMd: true,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
        }),
      ).toBe('fractal');
    });

    it('should classify any __name__ dir as organ via pattern (non-leaf)', () => {
      expect(
        classifyNode({
          dirName: '__custom__',
          hasClaudeMd: false,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
        }),
      ).toBe('organ');
    });

    it('should classify dot-prefixed dirs as organ via pattern (non-leaf)', () => {
      const dotDirs = ['.git', '.github', '.vscode', '.claude'];
      for (const dirName of dotDirs) {
        expect(
          classifyNode({
            dirName,
            hasClaudeMd: false,
            hasSpecMd: false,
            hasFractalChildren: false,
            isLeafDirectory: false,
          }),
        ).toBe('organ');
      }
    });

    it('should override pattern with CLAUDE.md for dot-prefixed dirs', () => {
      expect(
        classifyNode({
          dirName: '.claude',
          hasClaudeMd: true,
          hasSpecMd: false,
          hasFractalChildren: false,
          isLeafDirectory: false,
        }),
      ).toBe('fractal');
    });
  });
});
