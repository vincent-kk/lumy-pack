import { describe, expect, it } from 'vitest';
import { scaleBoundingBox } from '../../../core/utils/metadata/scale-bounding-box.js';

describe('scaleBoundingBox', () => {
  it('rounds each axis independently', () => {
    expect(scaleBoundingBox({ x: 5, y: 20, width: 7, height: 9 }, 101 / 50, 67 / 33, 101, 67))
      .toEqual({ x: 10, y: 41, width: 14, height: 18 });
  });
  it('clamps origins and dimensions to the remaining output space', () => {
    expect(scaleBoundingBox({ x: 45, y: 30, width: 20, height: 20 }, 101 / 50, 67 / 33, 101, 67))
      .toEqual({ x: 91, y: 61, width: 10, height: 6 });
    expect(scaleBoundingBox({ x: -2, y: -3, width: 80, height: 90 }, 2, 2, 101, 67))
      .toEqual({ x: 0, y: 0, width: 101, height: 67 });
    expect(scaleBoundingBox({ x: 60, y: 40, width: 5, height: 5 }, 2, 2, 101, 67))
      .toEqual({ x: 101, y: 67, width: 0, height: 0 });
  });
});
