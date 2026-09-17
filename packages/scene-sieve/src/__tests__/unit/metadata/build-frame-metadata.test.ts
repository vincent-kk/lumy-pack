import { describe, expect, it } from 'vitest';
import { buildFrameMetadata } from '../../../core/utils/metadata/build-frame-metadata.js';

describe('buildFrameMetadata', () => {
  it('summarizes candidate spans with missing pairs, deterministic names and holds', () => {
    const frames = Array.from({ length: 6 }, (_, id) => ({ id, timestamp: id / 3, extractPath: '' }));
    const result = buildFrameMetadata({
      frames, selected: [frames[0], frames[2], frames[5]],
      graph: [
        { sourceId: 4, targetId: 5, score: 0.4 },
        { sourceId: 0, targetId: 1, score: 0.1 },
        { sourceId: 1, targetId: 2, score: 0.2 },
        { sourceId: 0, targetId: 5, score: 9 },
      ],
      originalDurationMs: 2000, analysisResolution: { width: 10, height: 10 }, outputResolution: { width: 20, height: 20 },
    });
    expect(result[0]).toEqual({ step: 1, fileName: 'frame_0001.jpg', frameId: 1, timestampMs: 0, holdsMs: 667, change: null });
    expect(result[1]).toMatchObject({ frameId: 3, timestampMs: 667, holdsMs: 1000, change: { fromFrameId: 1, skippedCandidates: 1, sumScore: 0.3 } });
    expect(result[2]).toMatchObject({ frameId: 6, holdsMs: 333, change: { fromFrameId: 3, skippedCandidates: 2, peakScore: 0.4 } });
  });
  it('uses candidate-count padding and clamps a negative final hold', () => {
    const frames = Array.from({ length: 12000 }, (_, id) => ({ id, timestamp: id, extractPath: '' }));
    expect(buildFrameMetadata({ frames, selected: [frames[999]], graph: [], originalDurationMs: 1,
      analysisResolution: { width: 0, height: 0 }, outputResolution: { width: 0, height: 0 } })[0])
      .toMatchObject({ fileName: 'frame_01000.jpg', holdsMs: 0, change: null });
  });
  it('returns no metadata for an empty selection', () => {
    expect(buildFrameMetadata({ frames: [], selected: [], graph: [], originalDurationMs: 0,
      analysisResolution: { width: 0, height: 0 }, outputResolution: { width: 0, height: 0 } })).toEqual([]);
  });
});
