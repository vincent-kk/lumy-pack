import { describe, expect, it } from 'vitest';
import { unionArea } from '../../../core/utils/metadata/change/union-area.js';
import { inclusionExclusionArea } from './union-area/inclusion-exclusion-area.js';

describe('unionArea', () => {
  it('returns zero for no boxes', () => expect(unionArea([])).toBe(0));
  it('adds disjoint boxes', () => expect(unionArea([{ x: 0, y: 0, width: 2, height: 3 }, { x: 4, y: 4, width: 2, height: 2 }])).toBe(10));
  it('counts containment once', () => expect(unionArea([{ x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 2, width: 3, height: 3 }])).toBe(100));
  it('counts partial overlap once', () => expect(unionArea([{ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }])).toBe(175));
  it('preserves fractional coordinates', () => expect(unionArea([{ x: 0.5, y: 0.25, width: 1.5, height: 2.5 }])).toBe(3.75));
  it('ignores zero and negative dimensions', () => expect(unionArea([{ x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -1 }])).toBe(0));
  it('handles duplicate, nested, touching and simultaneous entering/leaving boxes', () => {
    const boxes = [
      { x: -2, y: -1, width: 2, height: 4 },
      { x: -2, y: -1, width: 2, height: 4 },
      { x: -1.5, y: 0, width: 1, height: 1 },
      { x: 0, y: -1, width: 2, height: 2 },
      { x: 0, y: 1, width: 2, height: 2 },
      { x: 2, y: 3, width: 1, height: 1 },
    ];
    expect(unionArea(boxes)).toBe(17);
    expect(unionArea([...boxes].reverse())).toBe(17);
  });
  it('matches an independent oracle on deterministic small fractional unions', () => {
    let state = 0x51e7e;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    for (let sample = 0; sample < 240; sample++) {
      const boxes = Array.from({ length: sample % 9 }, () => ({
        x: Math.floor(random() * 30 - 15) / 7,
        y: Math.floor(random() * 30 - 15) / 7,
        width: Math.floor(random() * 18 - 2) / 7,
        height: Math.floor(random() * 18 - 2) / 7,
      }));
      expect(unionArea(boxes)).toBeCloseTo(inclusionExclusionArea(boxes), 10);
    }
  });
  it('does not reorder or mutate input boxes', () => {
    const boxes = [
      { x: 3, y: 0.2, width: 0.3, height: 1.1 },
      { x: -2, y: 0, width: 6, height: 2 },
      { x: 0, y: 0, width: -1, height: 2 },
    ];
    const original = structuredClone(boxes);
    boxes.forEach(Object.freeze);
    Object.freeze(boxes);
    expect(unionArea(boxes)).toBeCloseTo(12, 10);
    expect(boxes).toEqual(original);
  });
  it('ignores positive heights whose endpoints collapse at floating-point precision', () => {
    const collapsed = { x: 0, y: 1e20, width: 1, height: 1 };
    expect(unionArea([collapsed, { x: 2, y: 0, width: 2, height: 2 }])).toBe(4);
    expect(unionArea([collapsed])).toBe(0);
  });
});
