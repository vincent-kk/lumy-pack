import type { BoundingBox } from '../../../../types/index.js';

import { YCoverageTree } from './union-area/y-coverage-tree.js';

/** One vertical edge entering or leaving the sweep's active rectangle union. */
interface SweepEvent {
  /** Horizontal coordinate at which coverage changes. */
  x: number;
  /** Inclusive lower coordinate of the covered y interval. */
  start: number;
  /** Exclusive upper coordinate of the covered y interval. */
  end: number;
  /** Add coverage on a left edge and remove it on a right edge. */
  delta: number;
}

/**
 * Measure rectangle union with an x sweep in O(n log n) time and O(n) space.
 * @param boxes - Finite rectangles; nonpositive dimensions are ignored.
 * @returns Covered area in the input coordinate system, or zero for empty input.
 */
export function unionArea(boxes: BoundingBox[]): number {
  const events: SweepEvent[] = [];
  const endpoints: number[] = [];
  for (const box of boxes) {
    if (!(box.width > 0 && box.height > 0)) continue;
    const end = box.y + box.height;
    if (end === box.y) continue;
    events.push({ x: box.x, start: box.y, end, delta: 1 });
    events.push({ x: box.x + box.width, start: box.y, end, delta: -1 });
    endpoints.push(box.y, end);
  }
  if (events.length === 0) return 0;
  events.sort((a, b) => a.x - b.x);
  endpoints.sort((a, b) => a - b);
  const bounds = endpoints.filter((value, index) => index === 0 || value !== endpoints[index - 1]);
  const indices = new Map(bounds.map((value, index) => [value, index]));
  const coverage = new YCoverageTree(bounds);
  let area = 0;
  let previousX = events[0].x;
  for (const event of events) {
    area += (event.x - previousX) * coverage.coveredLength;
    coverage.update(indices.get(event.start)!, indices.get(event.end)!, event.delta);
    previousX = event.x;
  }
  return area;
}
