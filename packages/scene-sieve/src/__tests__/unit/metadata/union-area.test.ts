import { describe, expect, it } from 'vitest';
import { unionArea } from '../../../core/utils/metadata/change/union-area.js';

describe('unionArea', () => {
  it('returns zero for no boxes', () => expect(unionArea([])).toBe(0));
  it('adds disjoint boxes', () => expect(unionArea([{ x: 0, y: 0, width: 2, height: 3 }, { x: 4, y: 4, width: 2, height: 2 }])).toBe(10));
  it('counts containment once', () => expect(unionArea([{ x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 2, width: 3, height: 3 }])).toBe(100));
  it('counts partial overlap once', () => expect(unionArea([{ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }])).toBe(175));
  it('preserves fractional coordinates', () => expect(unionArea([{ x: 0.5, y: 0.25, width: 1.5, height: 2.5 }])).toBe(3.75));
  it('ignores zero and negative dimensions', () => expect(unionArea([{ x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -1 }])).toBe(0));
});
