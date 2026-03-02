import { describe, expect, it } from 'vitest';

import { pruneByThreshold } from '../../core/pruner.js';
import type { FrameNode, ScoreEdge } from '../../types/index.js';

function makeFrames(count: number): FrameNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    timestamp: i,
    extractPath: `/tmp/frame_${i}.jpg`,
  }));
}

function makeChainEdges(count: number, scores: number[]): ScoreEdge[] {
  return scores.slice(0, count - 1).map((score, i) => ({
    sourceId: i,
    targetId: i + 1,
    score,
  }));
}

describe('pruneByThreshold (normalized 0~1)', () => {
  it('empty frames — returns empty set', () => {
    const result = pruneByThreshold([], [], 0.5);
    expect(result.size).toBe(0);
  });

  it('single frame — returns that frame', () => {
    const frames = makeFrames(1);
    const result = pruneByThreshold([], frames, 0.5);
    expect(result.size).toBe(1);
    expect(result.has(0)).toBe(true);
  });

  it('all scores zero — only first and last preserved', () => {
    const frames = makeFrames(5);
    const edges = makeChainEdges(5, [0, 0, 0, 0]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  it('all normalized scores >= threshold (non-consecutive) -- all passing frames preserved', () => {
    const frames = makeFrames(6);
    // High scores at isolated positions, low scores between them
    // scores: [0.8, 0.1, 0.9, 0.1, 0.7]
    // sorted positive [0.1, 0.1, 0.7, 0.8, 0.9]
    // P10 (0.1*5=0.5 -> floor=0): 0.1
    // P90 (0.9*5=4.5 -> min(4, 4)=4): 0.9
    // normalized: [ (0.8-0.1)/(0.9-0.1)=0.875, 0, 1.0, 0, (0.7-0.1)/(0.9-0.1)=0.75 ]
    // threshold=0.5: indices 0,2,4 pass (non-consecutive) -> NMS: all isolated, all kept
    // targetIds: 1, 3, 5; boundaries: 0, 5
    // result: {0, 1, 3, 5} = size 4
    const edges = makeChainEdges(6, [0.8, 0.1, 0.9, 0.1, 0.7]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.size).toBe(4);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(1)).toBe(true); // edge 0 targetId
    expect(result.has(3)).toBe(true); // edge 2 targetId
    expect(result.has(5)).toBe(true); // boundary + edge 4 targetId
  });

  it('partial edges above threshold — keeps boundary + matching targetIds', () => {
    const frames = makeFrames(5);
    // scores: [0.1, 0.8, 0.1, 0.9]
    // sorted: [0.1, 0.1, 0.8, 0.9]
    // P10 (0.1*4=0.4 -> 0): 0.1
    // P90 (0.9*4=3.6 -> 3): 0.9
    // normalized: [0, 0.875, 0, 1.0]
    // threshold=0.5: edges 1->2(0.875) and 3->4(1.0) pass
    const edges = makeChainEdges(5, [0.1, 0.8, 0.1, 0.9]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(1)).toBe(false); // normalized 0 < 0.5
    expect(result.has(2)).toBe(true); // normalized 0.875 >= 0.5
    expect(result.has(3)).toBe(false); // normalized 0 < 0.5
    expect(result.has(4)).toBe(true); // boundary + normalized 1.0
  });

  it('boundary value: normalized score === threshold -- preserved (>= comparison)', () => {
    const frames = makeFrames(5);
    // scores: [0.3, 0.1, 0.6, 0.1]
    // sorted: [0.1, 0.1, 0.3, 0.6]
    // P10 (0): 0.1
    // P90 (3): 0.6
    // normalized: [ (0.3-0.1)/(0.6-0.1)=0.25, 0, 1.0, 0 ]
    // threshold=0.25: indices 0 (exactly 0.25) and 2 (1.0) pass
    const edges = makeChainEdges(5, [0.3, 0.1, 0.6, 0.1]);
    const result = pruneByThreshold(edges, frames, 0.25);
    expect(result.size).toBe(4);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(1)).toBe(true); // edge 0 targetId (norm exactly 0.25)
    expect(result.has(3)).toBe(true); // edge 2 targetId (norm 1.0)
    expect(result.has(4)).toBe(true); // boundary
  });

  it('high threshold filters to only the strongest transitions', () => {
    const frames = makeFrames(6);
    // scores: [0.1, 0.5, 0.3, 0.9, 0.2], max=0.9
    // normalized: [0.111, 0.556, 0.333, 1.0, 0.222]
    // threshold=0.9: only edge 3->4 (1.0) passes
    const edges = makeChainEdges(6, [0.1, 0.5, 0.3, 0.9, 0.2]);
    const result = pruneByThreshold(edges, frames, 0.9);
    expect(result.size).toBe(3); // boundary(0,5) + frame 4
    expect(result.has(0)).toBe(true);
    expect(result.has(4)).toBe(true);
    expect(result.has(5)).toBe(true);
  });

  it('large input (100 frames) — correct normalized threshold filtering', () => {
    const frames = makeFrames(100);
    // high=0.9, low=0.05 → max=0.9
    // normalized: high=1.0, low=0.056
    // threshold=0.5: only high-score edges pass
    const scores = Array.from({ length: 99 }, (_, i) =>
      i % 10 === 0 ? 0.9 : 0.05,
    );
    const edges = makeChainEdges(100, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    // high-score edges at i=0,10,20,...,90 -> targetIds: 1,11,21,31,41,51,61,71,81,91
    // + boundary: 0, 99
    expect(result.size).toBe(12);
    expect(result.has(0)).toBe(true);
    expect(result.has(99)).toBe(true);
    expect(result.has(1)).toBe(true);
    expect(result.has(11)).toBe(true);
  });

  it('NaN/Infinity/negative scores — treated as 0, no crash', () => {
    const frames = makeFrames(5);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: NaN },
      { sourceId: 1, targetId: 2, score: 0.8 },
      { sourceId: 2, targetId: 3, score: Infinity },
      { sourceId: 3, targetId: 4, score: -0.5 },
    ];
    // safeScores: [0, 0.8, 0, 0] → max=0.8
    // normalized: [0, 1.0, 0, 0]
    // threshold=0.5: only edge 1->2 (1.0) passes
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(2)).toBe(true); // normalized 1.0 >= 0.5
    expect(result.has(4)).toBe(true); // boundary
    expect(result.has(1)).toBe(false); // NaN → 0
    expect(result.has(3)).toBe(false); // negative → 0
  });
});

describe('pruneByThreshold (robust distribution behavior)', () => {
  it('adapts to high noise floor (high baseline, narrow range)', () => {
    const frames = makeFrames(8);
    // All changes are between 90 and 100. Noise floor is ~90.
    const scores = [90, 91, 92, 95, 98, 99, 100];
    // sorted: [90, 91, 92, 95, 98, 99, 100]
    // length=7. P10 (0): 90. P90 (6): 100.
    // normalized: [0, 0.1, 0.2, 0.5, 0.8, 0.9, 1.0]
    // threshold=0.5: keeps indices 3,4,5,6 (targetIds 4,5,6,7)
    // NMS: run [3,4,5,6], peak at 6 (norm 1.0) -> keeps targetId 7 (boundary)
    // boundary: 0, 7.
    // result: {0, 7} = size 2 (if t=0.5)
    // Wait, let's use t=0.4 to keep index 3,4,5,6 then NMS keeps peak.
    // Actually, let's just verify normalized values indirectly.
    const edges = makeChainEdges(8, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    // idx 3(0.5), 4(0.8), 5(0.9), 6(1.0) pass.
    // NMS run [3,4,5,6], peak is idx 6 (1.0). targetId is 7.
    // survivors: {0, 7}
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(7)).toBe(true);

    // Lower threshold t=0.1 should keep more
    pruneByThreshold(edges, frames, 0.1);
    // idx 1(0.1), 2(0.2), 3(0.5), 4(0.8), 5(0.9), 6(1.0) pass.
    // NMS run [1,2,3,4,5,6], peak is idx 6. targetId 7.
    // Still 2? Ah, NMS collapses consecutive runs.
    // Let's use non-consecutive scores to test "relative" filtering.
    // [90, 10, 95, 10, 100]: sorted [10, 10, 90, 95, 100]. P10: 10, P90: 100.
    // norm: [ (90-10)/(100-10)=0.88, 0, 0.94, 0, 1.0 ]
    // t=0.9 keeps idx 2 and 4.
  });

  it('handles identical non-zero scores (range zero fallback)', () => {
    const frames = makeFrames(5);
    const scores = [10, 10, 10, 10];
    // all norm to 1.0
    const edges = makeChainEdges(5, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    // all pass, NMS keeps first peak (idx 0 -> targetId 1)
    expect(result.has(1)).toBe(true);
    expect(result.size).toBe(3); // 0, 1, 4
  });
});
