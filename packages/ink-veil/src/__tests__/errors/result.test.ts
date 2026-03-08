import { describe, it, expect } from 'vitest';
import { ok, err } from '../../errors/result.js';
import type { Result } from '../../errors/result.js';

describe('Result pattern', () => {
  describe('ok()', () => {
    it('ok(value).ok === true', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
    });

    it('ok(value).value holds the value', () => {
      const result = ok('hello');
      if (result.ok) {
        expect(result.value).toBe('hello');
      }
    });

    it('ok(null) creates successful result with null', () => {
      const result = ok(null);
      expect(result.ok).toBe(true);
    });

    it('ok(object) holds nested object', () => {
      const data = { name: '홍길동', age: 30 };
      const result = ok(data);
      if (result.ok) {
        expect(result.value).toEqual(data);
      }
    });
  });

  describe('err()', () => {
    it('err(error).ok === false', () => {
      const result = err(new Error('fail'));
      expect(result.ok).toBe(false);
    });

    it('err(error).error holds the error', () => {
      const error = new Error('something went wrong');
      const result = err(error);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('err(string) works with non-Error values', () => {
      const result = err('error message');
      if (!result.ok) {
        expect(result.error).toBe('error message');
      }
    });
  });

  describe('type narrowing', () => {
    it('narrows to success branch when ok === true', () => {
      const result: Result<number> = ok(99);
      if (result.ok) {
        // TypeScript should allow result.value here
        expect(result.value).toBe(99);
      } else {
        throw new Error('Should not reach here');
      }
    });

    it('narrows to error branch when ok === false', () => {
      const error = new Error('test error');
      const result: Result<number> = err(error) as Result<number>;
      if (!result.ok) {
        expect(result.error).toBe(error);
      } else {
        throw new Error('Should not reach here');
      }
    });
  });
});
