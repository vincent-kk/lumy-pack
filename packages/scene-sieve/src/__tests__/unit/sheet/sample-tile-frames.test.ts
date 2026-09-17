import { describe, expect, it } from 'vitest';
import { sampleTileFrames } from '../../../core/utils/sheet/sample-tile-frames.js';

describe('sampleTileFrames', () => {
  it('retains inputs within the tile limit', () => {
    const items = [1, 2, 3];
    expect(sampleTileFrames(items, 3)).toEqual({ items, sampled: false });
    expect(sampleTileFrames([], 2)).toEqual({ items: [], sampled: false });
  });
  it('samples ten frames uniformly including both ends', () => {
    expect(sampleTileFrames(Array.from({ length: 10 }, (_, i) => i), 4)).toEqual({ items: [0, 3, 6, 9], sampled: true });
  });
  it('selects forty distinct increasing indices from forty-one frames', () => {
    const result = sampleTileFrames(Array.from({ length: 41 }, (_, i) => i), 40);
    expect(result.sampled).toBe(true);
    expect(result.items).toHaveLength(40);
    expect(result.items[0]).toBe(0);
    expect(result.items[39]).toBe(40);
    expect(result.items.every((item, i) => i === 0 || item > result.items[i - 1])).toBe(true);
  });
});
