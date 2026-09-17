import { describe, expect, it } from 'vitest';
import { selectRegions } from '../../../core/utils/metadata/change/select-regions.js';

describe('selectRegions', () => {
  it('deduplicates, orders by area then y, x, width and limits without mutation', () => {
    const boxes = [
      { x: 1, y: 2, width: 10, height: 4 },
      { x: 1, y: 2, width: 4, height: 10 },
      { x: 0, y: 2, width: 4, height: 10 },
      { x: 2, y: 1, width: 4, height: 10 },
      { x: 9, y: 9, width: 9, height: 9 },
    ];
    const input = [...boxes, { ...boxes[4] }, { x: 0, y: 0, width: 0, height: 9 }];
    const original = structuredClone(input);
    expect(selectRegions(input, 9)).toEqual([boxes[4], boxes[3], boxes[2], boxes[1], boxes[0]]);
    expect(selectRegions(input, 3)).toEqual([boxes[4], boxes[3], boxes[2]]);
    expect(input).toEqual(original);
  });
  it('returns no boxes for a zero limit', () => {
    expect(selectRegions([{ x: 0, y: 0, width: 1, height: 1 }], 0)).toEqual([]);
  });
});
