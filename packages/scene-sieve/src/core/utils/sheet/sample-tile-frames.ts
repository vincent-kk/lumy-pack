/**
 * Sample a sequence uniformly while always retaining both endpoints.
 * @param items - Items in temporal order.
 * @param maxTiles - Validated integer limit of at least two.
 * @returns The original sequence when within the limit, otherwise evenly sampled items.
 */
export function sampleTileFrames<T>(items: T[], maxTiles: number): { items: T[]; sampled: boolean } {
  if (items.length <= maxTiles) return { items, sampled: false };
  return {
    items: Array.from({ length: maxTiles }, (_, i) =>
      items[Math.round(i * (items.length - 1) / (maxTiles - 1))]),
    sampled: true,
  };
}
