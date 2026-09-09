import { describe, expect, it } from 'vitest';

import { pruneTo } from '../../core/pruner.js';
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

describe('pruneTo', () => {

  it('empty graph — no edges means no removals', () => {
    const frames = makeFrames(5);
    const result = pruneTo([], frames, 3);
    // No edges means no removals → all frames survive
    expect(result.size).toBe(5);
  });

  it('target >= frames — all frames survive', () => {
    const frames = makeFrames(3);
    const edges = makeChainEdges(3, [0.1, 0.2]);
    const result = pruneTo(edges, frames, 5);
    expect(result.size).toBe(3);
  });

  it('single lowest-score edge — removes targetId', () => {
    const frames = makeFrames(3);
    const edges = makeChainEdges(3, [0.1, 0.9]);
    // lowest edge: 0→1 (0.1), removes frame 1
    const result = pruneTo(edges, frames, 2);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it('exact target — removes correct frame', () => {
    const frames = makeFrames(4);
    const edges = makeChainEdges(4, [0.5, 0.3, 0.8]);
    // lowest edge: 1→2 (0.3), removes frame 2
    const result = pruneTo(edges, frames, 3);
    expect(result.size).toBe(3);
    expect(result.has(2)).toBe(false);
  });

  it('target = 1, chain edges — boundary protection keeps 2 frames', () => {
    const frames = makeFrames(3);
    const edges = makeChainEdges(3, [0.1, 0.2]);
    const result = pruneTo(edges, frames, 1);
    // After removing frame 1, frames 0 and 2 are protected as boundary frames
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });


  it('chain 15 frames → target 5 — always reaches exact targetCount', () => {
    const frames = makeFrames(15);
    const scores = [
      0.1, 0.8, 0.1, 0.7, 0.1, 0.6, 0.1, 0.5, 0.1, 0.4, 0.1, 0.3, 0.1, 0.2,
    ];
    const edges = makeChainEdges(15, scores);
    const result = pruneTo(edges, frames, 5);
    expect(result.size).toBe(5);
    // Preserve boundaries
    expect(result.has(0)).toBe(true);
    expect(result.has(14)).toBe(true);
  });

  it('chain 10 frames → target 3 — reaches exact targetCount', () => {
    const frames = makeFrames(10);
    const scores = [0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.8, 0.1, 0.1];
    const edges = makeChainEdges(10, scores);
    const result = pruneTo(edges, frames, 3);
    expect(result.size).toBe(3);
    expect(result.has(0)).toBe(true);
    expect(result.has(9)).toBe(true);
  });

  // ── Boundary frame protection ──

  it('boundary frames always preserved', () => {
    const frames = makeFrames(5);
    // The first and last frames are protected even when their adjacent edges have the lowest scores
    const edges = makeChainEdges(5, [0.01, 0.5, 0.5, 0.01]);
    const result = pruneTo(edges, frames, 3);
    expect(result.has(0)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  // ── Re-linking behavior verification ──

  it('re-linking uses max(left, right) for synthetic edge', () => {
    const frames = makeFrames(5);
    // edges: 0→1(0.1), 1→2(0.9), 2→3(0.2), 3→4(0.8)
    const edges = makeChainEdges(5, [0.1, 0.9, 0.2, 0.8]);
    const result = pruneTo(edges, frames, 3);
    expect(result.size).toBe(3);
    // Remove 0→1(0.1) → remove frame 1, synthetic 0→2 = max(0.1, 0.9) = 0.9
    // Next lowest: 2→3(0.2) → remove frame 3, synthetic 2→4 = max(0.2, 0.8) = 0.8
    // Result: {0, 2, 4}
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  // ── Clustering prevention ──

  it('high-score adjacent edges — selects temporally distributed frames', () => {
    const frames = makeFrames(10);
    // High changes in the first half, low changes in the second half
    const scores = [0.1, 0.8, 0.9, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1];
    const edges = makeChainEdges(10, scores);
    const result = pruneTo(edges, frames, 5);
    expect(result.size).toBe(5);
    expect(result.has(0)).toBe(true);
    expect(result.has(9)).toBe(true);
    // Frames near high-change boundaries are preserved with an even temporal distribution
  });

  // ── Large inputs ──

  it('large input (100 frames) — reaches exact targetCount', () => {
    const frames = makeFrames(100);
    const scores = Array.from({ length: 99 }, (_, i) =>
      i % 10 === 0 ? 0.9 : 0.1,
    );
    const edges = makeChainEdges(100, scores);
    const result = pruneTo(edges, frames, 10);
    expect(result.size).toBe(10);
    expect(result.has(0)).toBe(true);
    expect(result.has(99)).toBe(true);
  });
});
