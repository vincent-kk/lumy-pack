import type { BoundingBox } from '../../../types/index.js';

/**
 * Convert an analysis box to clamped integer output pixels.
 * @param box - Analysis-space rectangle; the input remains unchanged.
 * @param sx - Horizontal output-to-analysis scale.
 * @param sy - Vertical output-to-analysis scale.
 * @param width - Nonnegative output image width.
 * @param height - Nonnegative output image height.
 * @returns A rectangle contained within the output dimensions.
 */
export function scaleBoundingBox(
  box: BoundingBox, sx: number, sy: number, width: number, height: number,
): BoundingBox {
  const x = Math.max(0, Math.min(width, Math.round(box.x * sx)));
  const y = Math.max(0, Math.min(height, Math.round(box.y * sy)));
  return {
    x, y,
    width: Math.max(0, Math.min(width - x, Math.round(box.width * sx))),
    height: Math.max(0, Math.min(height - y, Math.round(box.height * sy))),
  };
}
