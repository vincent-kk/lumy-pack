import { filter } from '@winglet/common-utils';

import type { BoundingBox } from '../../../../types/index.js';

/**
 * Measure the exact union of axis-aligned rectangles by compressed coordinate cells.
 * @param boxes - Finite rectangles; nonpositive dimensions are ignored.
 * @returns Covered area in the input coordinate system, or zero for empty input.
 */
export function unionArea(boxes: BoundingBox[]): number {
  const valid = filter(boxes, (box) => box.width > 0 && box.height > 0);
  const xs = valid.flatMap((box) => [box.x, box.x + box.width]).sort((a, b) => a - b);
  const ys = valid.flatMap((box) => [box.y, box.y + box.height]).sort((a, b) => a - b);
  const xBounds = filter(xs, (x, index) => index === 0 || x !== xs[index - 1]);
  const yBounds = filter(ys, (y, index) => index === 0 || y !== ys[index - 1]);
  let area = 0;
  for (let xi = 0; xi < xBounds.length - 1; xi++) {
    const left = xBounds[xi];
    const right = xBounds[xi + 1];
    const active = filter(valid, (box) => box.x <= left && box.x + box.width >= right);
    for (let yi = 0; yi < yBounds.length - 1; yi++) {
      const top = yBounds[yi];
      const bottom = yBounds[yi + 1];
      if (active.some((box) => box.y <= top && box.y + box.height >= bottom)) {
        area += (right - left) * (bottom - top);
      }
    }
  }
  return area;
}
