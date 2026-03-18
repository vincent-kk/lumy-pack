import { describe, expect, it } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '@/errors.js';

import { parseLineRange } from '../line-range.js';

describe('parseLineRange', () => {
  it('parses single line "42"', () => {
    expect(parseLineRange('42')).toEqual({ start: 42, end: 42 });
  });

  it('parses range "10,50"', () => {
    expect(parseLineRange('10,50')).toEqual({ start: 10, end: 50 });
  });

  it('throws on reversed range "50,10"', () => {
    try {
      parseLineRange('50,10');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.INVALID_LINE);
    }
  });

  it('throws on zero', () => {
    try {
      parseLineRange('0');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.INVALID_LINE);
    }
  });

  it('throws on negative number', () => {
    try {
      parseLineRange('-5');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.INVALID_LINE);
    }
  });

  it('throws on non-numeric input', () => {
    try {
      parseLineRange('abc');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.INVALID_LINE);
    }
  });

  it('throws on float input "3.5"', () => {
    try {
      parseLineRange('3.5');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.INVALID_LINE);
    }
  });
});
