import { describe, expect, it } from 'vitest';

import { pruneByThreshold } from '../../core/pruner.js';
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

describe('pruneByThreshold (NMS)', () => {
  it('consecutive high-score edges -- keeps only peak per run', () => {
    // Simulate the real bug: frames 3,4,5,6 all have high scores
    const frames = makeFrames(10);
    const scores = [0.1, 0.1, 0.8, 0.9, 0.7, 0.6, 0.1, 0.1, 0.1];
    // sorted: [0.1x5, 0.6, 0.7, 0.8, 0.9]
    // P10 (0): 0.1
    // P90 (floor(9*0.9)=8): 0.9
    // normalized: [0, 0, 0.875, 1.0, 0.75, 0.625, 0, 0, 0]
    // threshold=0.5: edges 2,3,4,5 pass
    // NMS: one consecutive run [2,3,4,5], peak at index 3 (norm 1.0)
    // Keeps targetId of edge 3 = frame 4
    const edges = makeChainEdges(10, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(9)).toBe(true); // boundary
    expect(result.has(4)).toBe(true); // peak of run (edge 3 targetId)
    expect(result.has(3)).toBe(false); // suppressed by NMS
    expect(result.has(5)).toBe(false); // suppressed by NMS
    expect(result.has(6)).toBe(false); // suppressed by NMS
    expect(result.size).toBe(3); // boundary(0,9) + peak(4)
  });

  it('two separate runs -- keeps one peak per run', () => {
    const frames = makeFrames(12);
    const scores = [0.1, 0.7, 0.9, 0.8, 0.1, 0.1, 0.6, 0.8, 0.7, 0.1, 0.1];
    // sorted: [0.1x5, 0.6, 0.7x2, 0.8x2, 0.9]
    // P10: 0.1
    // P90 (9): 0.8
    // normalized: [0, 0.857, 1.0, 1.0, 0, 0, 0.714, 1.0, 0.857, 0, 0]
    // threshold=0.5: indices 1,2,3,6,7,8 pass
    // Run 1: [1,2,3] -- index 2 and 3 both have norm 1.0, first (index 2) wins -> targetId=3
    // Run 2: [6,7,8] -- index 7 has norm 1.0 -> targetId=8
    const edges = makeChainEdges(12, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(11)).toBe(true); // boundary
    expect(result.has(3)).toBe(true); // peak of run 1 (edge 2 targetId)
    expect(result.has(8)).toBe(true); // peak of run 2 (edge 7 targetId)
    expect(result.size).toBe(4);
  });

  it('single-frame runs -- no suppression, all kept', () => {
    const frames = makeFrames(10);
    // High scores at isolated positions (non-consecutive)
    const scores = [0.1, 0.8, 0.1, 0.9, 0.1, 0.7, 0.1, 0.1, 0.1];
    // P90: sorted positive [0.1x6, 0.7, 0.8, 0.9], pIdx=floor(9*0.9)=8, ref=0.9
    // normalized: [0.111, 0.889, 0.111, 1.0, 0.111, 0.778, 0.111, 0.111, 0.111]
    // threshold=0.5: indices 1, 3, 5 pass (all non-consecutive)
    const edges = makeChainEdges(10, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(2)).toBe(true); // edge 1 targetId
    expect(result.has(4)).toBe(true); // edge 3 targetId
    expect(result.has(6)).toBe(true); // edge 5 targetId
    expect(result.size).toBe(5); // boundary(0,9) + 3 isolated peaks
  });

  it('all scores equal -- all form one run, keeps first peak', () => {
    const frames = makeFrames(5);
    const scores = [0.5, 0.5, 0.5, 0.5];
    // All normalized to 1.0, threshold=0.5: all pass
    // One run [0,1,2,3], all tied at 1.0, first occurrence (index 0) wins
    // Keeps targetId of edge 0 = frame 1
    const edges = makeChainEdges(5, scores);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(4)).toBe(true); // boundary
    expect(result.has(1)).toBe(true); // peak of single run (first tied)
    expect(result.size).toBe(3);
  });

  it('only 2 frames -- no edges to suppress', () => {
    const frames = makeFrames(2);
    const edges = makeChainEdges(2, [0.8]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
  });

  it('threshold=0 -- all edges pass, multi-peak NMS finds distinct peaks', () => {
    const frames = makeFrames(6);
    const scores = [0.3, 0.5, 0.4, 0.2, 0.6];
    // All positive -> all normalized > 0. threshold=0: all pass
    // One run [0,1,2,3,4], normalized: [0.5, 0.833, 0.667, 0.333, 1.0]
    // Strict local maxima: idx 1 (0.833 > 0.5 & > 0.667), idx 4 (1.0 > 0.333)
    // targetIds: edge 1 -> frame 2, edge 4 -> frame 5
    const edges = makeChainEdges(6, scores);
    const result = pruneByThreshold(edges, frames, 0);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(2)).toBe(true); // peak at idx 1
    expect(result.has(5)).toBe(true); // boundary + peak at idx 4
    expect(result.size).toBe(3);
  });

  it('threshold=1 -- only max-normalized edges pass', () => {
    const frames = makeFrames(5);
    const scores = [0.3, 0.6, 0.3, 0.6];
    // P90: sorted [0.3, 0.3, 0.6, 0.6], pIdx=3, ref=0.6
    // normalized: [0.5, 1.0, 0.5, 1.0]
    // threshold=1: only edges 1 and 3 pass (norm=1.0)
    // indices 1,3 non-consecutive -> both kept
    const edges = makeChainEdges(5, scores);
    const result = pruneByThreshold(edges, frames, 1);
    expect(result.has(0)).toBe(true); // boundary
    expect(result.has(4)).toBe(true); // boundary + edge 3 targetId
    expect(result.has(2)).toBe(true); // edge 1 targetId
    expect(result.size).toBe(3);
  });
});
