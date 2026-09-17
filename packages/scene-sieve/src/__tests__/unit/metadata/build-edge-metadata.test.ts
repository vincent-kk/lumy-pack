import { expect, it } from 'vitest';
import { buildEdgeMetadata } from '../../../core/utils/metadata/build-edge-metadata.js';

it('preserves graph order, rounds ratios and scores, and uses one-based IDs', () => {
  const graph = [
    { sourceId: 4, targetId: 5, score: 0.12345678, change: { regions: [{ x: 0, y: 0, width: 1, height: 1 }], animatedRegions: [{ x: 0, y: 0, width: 2, height: 2 }] } },
    { sourceId: 0, targetId: 1, score: 0.4 },
  ];
  expect(buildEdgeMetadata(graph, { width: 3, height: 3 })).toEqual([
    { sourceFrameId: 5, targetFrameId: 6, score: 0.123457, areaRatio: 0.1111, animatedAreaRatio: 0.4444 },
    { sourceFrameId: 1, targetFrameId: 2, score: 0.4, areaRatio: 0, animatedAreaRatio: 0 },
  ]);
  expect(buildEdgeMetadata(graph, { width: 0, height: 0 })[0]).toMatchObject({ areaRatio: 0, animatedAreaRatio: 0 });
});
