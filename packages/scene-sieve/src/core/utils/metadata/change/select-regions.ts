import { filter } from '@winglet/common-utils';

import type { BoundingBox } from '../../../../types/index.js';

/**
 * Select distinct positive-area boxes with deterministic area and coordinate ties.
 * @param boxes - Already scaled output rectangles; the input is not mutated.
 * @param limit - Nonnegative maximum number of regions.
 * @returns Largest boxes ordered by area descending, then y, x and width ascending.
 */
export function selectRegions(boxes: BoundingBox[], limit: number): BoundingBox[] {
  return filter(boxes, (box, index) =>
    box.width > 0 && box.height > 0 &&
    boxes.findIndex((other) => other.x === box.x && other.y === box.y &&
      other.width === box.width && other.height === box.height) === index,
  ).sort((a, b) => b.width * b.height - a.width * a.height ||
    a.y - b.y || a.x - b.x || a.width - b.width).slice(0, limit);
}
