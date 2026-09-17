import { describe, expect, it } from 'vitest';

import { classifyError } from '../../cli/errors/classify-error.js';
import { resolveOptions } from '../../core/input-resolver/index.js';
import type { SieveOptions } from '../../types/index.js';

describe('resolveOptions sheet input boundary', () => {
  it.each([
    { name: 'empty array', sheet: [] },
    { name: 'populated array', sheet: [{ columns: 2 }] },
    { name: 'array with named fields', sheet: Object.assign([], { columns: 2 }) },
    { name: 'array containing a symbol', sheet: [Symbol('invalid')] },
    { name: 'array containing an unstringifiable object', sheet: [Object.create(null)] },
    { name: 'null', sheet: null },
  ])(
    'rejects $name as INVALID_INPUT', ({ sheet }) => {
      const options = { mode: 'frames', inputFrames: [], sheet } as unknown as SieveOptions;
      expect(() => resolveOptions(options)).toThrow('sheet must be a boolean or an object');
      try {
        resolveOptions(options);
      } catch (error) {
        expect(classifyError(error as Error)).toBe('INVALID_INPUT');
      }
    },
  );

  it('preserves empty object defaults and disabled sheets', () => {
    expect(resolveOptions({ mode: 'frames', inputFrames: [], sheet: {} }).sheet)
      .toEqual({ columns: 4, tileWidth: 320, maxTiles: 40, label: true });
    expect(resolveOptions({ mode: 'frames', inputFrames: [], sheet: false }).sheet).toBeNull();
  });
});
