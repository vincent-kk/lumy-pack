import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';

import { buildFrameChange } from '../../../core/utils/metadata/change/build-frame-change.js';
import { unionArea } from '../../../core/utils/metadata/change/union-area.js';
import type { BoundingBox } from '../../../types/index.js';

/**
 * Generate overlapping x spans and disjoint y strips with distinct endpoints.
 * @param count - Positive rectangle count; every rectangle has area count.
 * @returns Rectangles whose union is count squared, stressing cell-by-cell scans.
 */
function overlappingStrips(count: number): BoundingBox[] {
  return Array.from({ length: count }, (_, index) => ({
    x: index, y: 2 * index, width: count, height: 1,
  }));
}

describe('unionArea performance regression', () => {
  it('processes 2000 distinct strips within a generous synchronous budget', () => {
    const boxes = overlappingStrips(2000);
    const start = performance.now();
    const area = unionArea(boxes);
    const elapsed = performance.now() - start;
    console.info(`unionArea strips=2000 elapsedMs=${elapsed.toFixed(3)}`);
    expect(area).toBe(4_000_000);
    expect(elapsed).toBeLessThan(1000);
  });

  it('accumulates every region across 2000 edges before applying the display limit', () => {
    const count = 2000;
    const boxes = overlappingStrips(count);
    const spanEdges = boxes.map((box, index) => ({
      sourceId: index, targetId: index + 1, score: 0.125,
      change: { regions: [box], animatedRegions: [{ x: 0, y: 0, width: 4000, height: 4000 }] },
    }));
    const start = performance.now();
    const change = buildFrameChange({
      spanEdges, fromFrameId: 1, skippedCandidates: count - 1,
      analysisResolution: { width: 4000, height: 4000 },
      outputResolution: { width: 4000, height: 4000 }, regionLimit: 5,
    });
    const elapsed = performance.now() - start;
    console.info(`buildFrameChange edges=2000 elapsedMs=${elapsed.toFixed(3)}`);
    expect(change).toMatchObject({
      fromFrameId: 1, skippedCandidates: 1999, peakScore: 0.125,
      sumScore: 250, areaRatio: 0.25, regions: boxes.slice(0, 5),
    });
    expect(elapsed).toBeLessThan(1000);
  });

  it('reports reproducible median scaling without a timing-ratio assertion', () => {
    const sizes = process.env.SCENE_SIEVE_UNION_LARGE_BENCH === '1'
      ? [2000, 4000, 8000, 16000, 32000]
      : [250, 500, 1000];
    unionArea(overlappingStrips(100));
    for (const count of sizes) {
      const boxes = overlappingStrips(count);
      const samples = Array.from({ length: 5 }, () => {
        const start = performance.now();
        const area = unionArea(boxes);
        const elapsed = performance.now() - start;
        expect(area).toBe(count * count);
        return elapsed;
      }).sort((a, b) => a - b);
      console.info(`unionArea strips=${count} medianMs=${samples[2].toFixed(3)}`);
    }
  });
});
