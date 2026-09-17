import { describe, expect, it } from 'vitest';
import { buildFrameChange } from '../../../core/utils/metadata/change/build-frame-change.js';

describe('buildFrameChange', () => {
  it('aggregates raw scores and only non-animation union area before output scaling', () => {
    const result = buildFrameChange({
      spanEdges: [
        { sourceId: 0, targetId: 1, score: 0.12345678, change: {
          regions: [{ x: 0, y: 0, width: 10, height: 10 }],
          animatedRegions: [{ x: 0, y: 0, width: 20, height: 20 }],
        } },
        { sourceId: 1, targetId: 2, score: 0.00000078, change: {
          regions: [{ x: 5, y: 5, width: 10, height: 10 }], animatedRegions: [],
        } },
        { sourceId: 2, targetId: 3, score: 0.1 },
      ],
      fromFrameId: 1, skippedCandidates: 2,
      analysisResolution: { width: 20, height: 20 }, outputResolution: { width: 31, height: 41 }, regionLimit: 5,
    });
    expect(result).toEqual({
      fromFrameId: 1, skippedCandidates: 2, peakScore: 0.123457, sumScore: 0.223458, areaRatio: 0.4375,
      regions: [{ x: 0, y: 0, width: 16, height: 21 }, { x: 8, y: 10, width: 16, height: 21 }],
    });
  });
  it('uses zero area and no regions when analysis dimensions are zero', () => {
    expect(buildFrameChange({
      spanEdges: [{ sourceId: 0, targetId: 1, score: 0.3, change: { regions: [{ x: 0, y: 0, width: 1, height: 1 }], animatedRegions: [] } }],
      fromFrameId: 1, skippedCandidates: 0, analysisResolution: { width: 0, height: 0 },
      outputResolution: { width: 20, height: 20 }, regionLimit: 5,
    })).toMatchObject({ peakScore: 0.3, sumScore: 0.3, areaRatio: 0, regions: [] });
  });
  it('handles absent edges and clamps oversized area', () => {
    const input = { fromFrameId: 1, skippedCandidates: 0, analysisResolution: { width: 3, height: 3 }, outputResolution: { width: 3, height: 3 }, regionLimit: 5 };
    expect(buildFrameChange({ ...input, spanEdges: [] })).toMatchObject({ peakScore: 0, sumScore: 0, areaRatio: 0, regions: [] });
    expect(buildFrameChange({ ...input, spanEdges: [{ sourceId: 0, targetId: 1, score: 1, change: { regions: [{ x: 0, y: 0, width: 5, height: 5 }], animatedRegions: [] } }] }).areaRatio).toBe(1);
  });
});
