import type { BoundingBox } from '../../../../types/index.js';

/**
 * Independently measure a small union for the unionArea correctness tests.
 * @param boxes - At most eight finite rectangles, including degenerate ones.
 * @returns Union area by inclusion-exclusion, up to floating-point error.
 */
export function inclusionExclusionArea(boxes: BoundingBox[]): number {
  const valid = boxes.filter((box) => box.width > 0 && box.height > 0);
  let area = 0;
  for (let mask = 1; mask < 2 ** valid.length; mask++) {
    const selected = valid.filter((_, index) => (mask & (1 << index)) !== 0);
    const left = Math.max(...selected.map((box) => box.x));
    const right = Math.min(...selected.map((box) => box.x + box.width));
    const top = Math.max(...selected.map((box) => box.y));
    const bottom = Math.min(...selected.map((box) => box.y + box.height));
    area += (selected.length % 2 === 1 ? 1 : -1) *
      Math.max(0, right - left) * Math.max(0, bottom - top);
  }
  return area;
}
