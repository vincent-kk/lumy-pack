import { describe, it, expect } from 'vitest';
import {
  validateClaudeMd,
  validateSpecMd,
  countLines,
  detectAppendOnly,
} from '../../../core/document-validator.js';

describe('document-validator', () => {
  describe('countLines', () => {
    it('should count lines correctly', () => {
      expect(countLines('')).toBe(0);
      expect(countLines('one line')).toBe(1);
      expect(countLines('line1\nline2\nline3')).toBe(3);
    });

    it('should handle trailing newline', () => {
      expect(countLines('line1\nline2\n')).toBe(2);
    });
  });

  describe('validateClaudeMd', () => {
    it('should pass for valid CLAUDE.md under 100 lines', () => {
      const content = [
        '# Module',
        '## Boundaries',
        '### Always do',
        '- Test',
        '### Ask first',
        '- Review',
        '### Never do',
        '- Skip tests',
      ].join('\n');
      const result = validateClaudeMd(content);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should pass for exactly 100 lines', () => {
      const content = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = validateClaudeMd(content);
      expect(result.valid).toBe(true);
    });

    it('should fail for CLAUDE.md exceeding 100 lines', () => {
      const content = Array.from({ length: 101 }, (_, i) => `Line ${i + 1}`).join('\n');
      const result = validateClaudeMd(content);
      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'line-limit',
          severity: 'error',
        }),
      );
    });

    it('should warn when missing 3-tier boundaries', () => {
      const content = '# My Module\nSome description\n';
      const result = validateClaudeMd(content);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'missing-boundaries',
          severity: 'warning',
        }),
      );
    });

    it('should pass when all 3-tier boundaries are present', () => {
      const content = [
        '# My Module',
        '## Boundaries',
        '### Always do',
        '- Run tests',
        '### Ask first',
        '- Change schema',
        '### Never do',
        '- Commit secrets',
      ].join('\n');
      const result = validateClaudeMd(content);
      const boundaryViolations = result.violations.filter(
        (v) => v.rule === 'missing-boundaries',
      );
      expect(boundaryViolations).toHaveLength(0);
    });
  });

  describe('validateSpecMd', () => {
    it('should pass for valid SPEC.md', () => {
      const content = '# Spec\n## Requirements\n- Feature A\n';
      const result = validateSpecMd(content);
      expect(result.valid).toBe(true);
    });

    it('should fail when append-only pattern detected', () => {
      const oldContent = '# Spec\n## Log\n- Entry 1\n- Entry 2\n';
      const newContent = '# Spec\n## Log\n- Entry 1\n- Entry 2\n- Entry 3\n- Entry 4\n';
      const result = validateSpecMd(newContent, oldContent);
      expect(result.valid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'append-only',
          severity: 'error',
        }),
      );
    });

    it('should pass when content is restructured not just appended', () => {
      const oldContent = '# Spec\n## Old Section\n- Item 1\n';
      const newContent = '# Spec\n## Refactored Section\n- Consolidated item\n';
      const result = validateSpecMd(newContent, oldContent);
      const appendViolations = result.violations.filter(
        (v) => v.rule === 'append-only',
      );
      expect(appendViolations).toHaveLength(0);
    });
  });

  describe('detectAppendOnly', () => {
    it('should detect pure append (new lines added at end, nothing removed)', () => {
      const oldContent = 'line1\nline2\n';
      const newContent = 'line1\nline2\nline3\nline4\n';
      expect(detectAppendOnly(oldContent, newContent)).toBe(true);
    });

    it('should not flag when lines are modified', () => {
      const oldContent = 'line1\nline2\n';
      const newContent = 'line1-modified\nline2\nline3\n';
      expect(detectAppendOnly(oldContent, newContent)).toBe(false);
    });

    it('should not flag when lines are removed', () => {
      const oldContent = 'line1\nline2\nline3\n';
      const newContent = 'line1\nline3\nline4\n';
      expect(detectAppendOnly(oldContent, newContent)).toBe(false);
    });

    it('should not flag when old content is empty (initial creation)', () => {
      expect(detectAppendOnly('', 'new content')).toBe(false);
    });
  });
});
