import { describe, expect, it } from 'vitest';

import { pruneByThreshold, pruneByThresholdWithCap } from '../../core/pruner.js';
import type { FrameNode } from '../../types/index.js';

function makeFrames(count: number): FrameNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    timestamp: i,
    extractPath: `/tmp/frame_${i}.jpg`,
  }));
}

function makeChainEdges(count: number, scores: number[]) {
  return scores.slice(0, count - 1).map((score, i) => ({
    sourceId: i,
    targetId: i + 1,
    score,
  }));
}

describe('pruneByThresholdWithCap', () => {
  it('survivors < cap -- returns threshold result as-is', () => {
    const frames = makeFrames(6);
    const edges = makeChainEdges(6, [0.1, 0.8, 0.1, 0.9, 0.2]);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 10);
    const thresholdOnly = pruneByThreshold(edges, frames, 0.5);
    expect(result).toEqual(thresholdOnly);
  });

  it('survivors > cap -- reduces to cap count', () => {
    const frames = makeFrames(12);
    // High scores at non-consecutive positions to survive NMS
    // scores: [0.9, 0.1, 0.85, 0.1, 0.95, 0.1, 0.8, 0.1, 0.88, 0.1, 0.92]
    // P90: sorted positive [0.1,0.1,0.1,0.1,0.1, 0.8,0.85,0.88,0.9,0.92,0.95]
    //   11 positive scores, pIdx = floor(11*0.9) = 9, sorted[9] = 0.92, ref = 0.92
    // normalized: [0.978, 0.109, 0.924, 0.109, 1.0, 0.109, 0.870, 0.109, 0.957, 0.109, 1.0]
    // threshold=0.5: indices 0,2,4,6,8,10 pass (all >= 0.870)
    // NMS: [0,2,4,6,8,10] -- all non-consecutive (gaps of 1) -> all kept (6 peaks)
    // targetIds: {1, 3, 5, 7, 9, 11}; boundaries: {0, 11}
    // survivors: {0, 1, 3, 5, 7, 9, 11} = 7 frames
    // Cap = 4, 7 > 4 -> Stage 2 triggers pruneTo
    const scores = [0.9, 0.1, 0.85, 0.1, 0.95, 0.1, 0.8, 0.1, 0.88, 0.1, 0.92];
    const edges = makeChainEdges(12, scores);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 4);
    expect(result.size).toBe(4);
    expect(result.has(0)).toBe(true);
    expect(result.has(11)).toBe(true);
  });

  it('survivors === cap -- returns exact cap count', () => {
    // Need a scenario where threshold survivors = exactly 3
    const frames = makeFrames(6);
    const edges = makeChainEdges(6, [0.2, 0.9, 0.1, 0.8, 0.3]);
    // max=0.9, normalized: [0.222, 1.0, 0.111, 0.889, 0.333]
    // threshold=0.8: edges with norm >= 0.8: 1->2(1.0), 3->4(0.889)
    // survivors: {0, 2, 4, 5} = 4 frames
    const thresholdOnly = pruneByThreshold(edges, frames, 0.8);
    const result = pruneByThresholdWithCap(
      edges,
      frames,
      0.8,
      thresholdOnly.size,
    );
    expect(result).toEqual(thresholdOnly);
  });

  it('only boundary frames survive when all scores are zero', () => {
    const frames = makeFrames(5);
    const edges = makeChainEdges(5, [0, 0, 0, 0]);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 10);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  it('synthetic edge uses min score across gap', () => {
    // 6 frames, edges: 0->1(0.2), 1->2(0.9), 2->3(0.1), 3->4(0.8), 4->5(0.3)
    // max=0.9, normalized: [0.222, 1.0, 0.111, 0.889, 0.333]
    // threshold=0.8: passing edges 1->2(1.0), 3->4(0.889)
    // survivors: {0, 2, 4, 5}
    // maxCount=3 -> Stage 2
    // Synthetic: 0->2: min(0.2,0.9)=0.2, 2->4: min(0.1,0.8)=0.1, 4->5: 0.3
    // pruneTo removes lowest edge 2->4(0.1) -> frame 4 removed
    // Result: {0, 2, 5}
    const frames = makeFrames(6);
    const edges = makeChainEdges(6, [0.2, 0.9, 0.1, 0.8, 0.3]);
    const result = pruneByThresholdWithCap(edges, frames, 0.8, 3);
    expect(result.size).toBe(3);
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(5)).toBe(true);
    expect(result.has(4)).toBe(false);
  });

  it('cap=1 -- boundary protection keeps at least 2 frames', () => {
    const frames = makeFrames(5);
    const edges = makeChainEdges(5, [0.8, 0.9, 0.7, 0.85]);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 1);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  it('empty frames -- returns empty set', () => {
    const result = pruneByThresholdWithCap([], [], 0.5, 5);
    expect(result.size).toBe(0);
  });
});

describe('pruneByThresholdWithCap (NMS + cap integration)', () => {
  it('NMS reduces survivors below cap -- Stage 2 skipped', () => {
    // Without NMS: all 9 consecutive edges pass -> 9 + 2 boundary = 11 survivors > cap
    // With multi-peak NMS: 3 local maxima -> 3 peaks + 2 boundary = 4 survivors < cap of 5
    const frames = makeFrames(10);
    const scores = [0.9, 0.8, 0.7, 0.85, 0.95, 0.6, 0.75, 0.88, 0.92];
    // P90: sorted [0.6, 0.7, 0.75, 0.8, 0.85, 0.88, 0.9, 0.92, 0.95], pIdx=8, ref=0.95
    // normalized: [0.947, 0.842, 0.737, 0.895, 1.0, 0.632, 0.789, 0.926, 0.968]
    // threshold=0.5: all pass -> one run
    // Strict local maxima: idx 0 (0.947 > 0.842), idx 4 (1.0), idx 8 (0.968 > 0.926)
    // targetIds: edge 0 -> frame 1, edge 4 -> frame 5, edge 8 -> frame 9 (boundary)
    // survivors: boundary{0,9} + peaks{1,5,9} = {0,1,5,9} = 4
    // cap=5: 4 <= 5 -> Stage 2 skipped
    const edges = makeChainEdges(10, scores);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 5);
    expect(result.size).toBe(4);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(1)).toBe(true); // peak at idx 0
    expect(result.has(5)).toBe(true); // peak at idx 4
    expect(result.has(9)).toBe(true); // boundary + peak at idx 8
  });

  it('NMS still leaves survivors above cap -- Stage 2 reduces', () => {
    // 20 frames, non-consecutive high scores that survive NMS but exceed cap
    const frames = makeFrames(20);
    const scores: number[] = Array.from({ length: 19 }, () => 0.1);
    // Place 6 isolated high scores (non-consecutive)
    scores[1] = 0.8;
    scores[4] = 0.9;
    scores[7] = 0.85;
    scores[10] = 0.7;
    scores[13] = 0.95;
    scores[16] = 0.75;
    // P90: 19 scores, sorted positive: [0.1x13, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
    //   pIdx = floor(19*0.9) = 17, sorted[17] = 0.9, ref = 0.9
    // normalized at high positions: 0.8/0.9=0.889, 0.9/0.9=1.0, 0.85/0.9=0.944,
    //   0.7/0.9=0.778, 0.95/0.9=min(1.056,1.0)=1.0, 0.75/0.9=0.833
    // threshold=0.5: all 6 high indices pass (all >= 0.778), all non-consecutive -> NMS keeps all 6
    // survivors: boundary{0,19} + 6 peaks = 8 frames
    // cap=4: 8 > 4 -> Stage 2 triggers pruneTo
    const edges = makeChainEdges(20, scores);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 4);
    expect(result.size).toBe(4);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(19)).toBe(true); // boundary
  });
});
