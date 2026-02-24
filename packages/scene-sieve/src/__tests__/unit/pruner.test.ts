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

describe('pruneTo', () => {
  it('empty graph — all frames survive', () => {
    const frames = makeFrames(5);
    const result = pruneTo([], frames, 3);
    expect(result.size).toBe(5);
  });

  it('target >= frames — all frames survive', () => {
    const frames = makeFrames(3);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: 0.1 },
      { sourceId: 1, targetId: 2, score: 0.2 },
    ];
    const result = pruneTo(edges, frames, 5);
    expect(result.size).toBe(3);
  });

  it('single edge — removes correct frame (targetId of lowest score)', () => {
    const frames = makeFrames(3);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: 0.1 },
      { sourceId: 1, targetId: 2, score: 0.9 },
    ];
    // prune from 3 to 2: should remove frame 1 (targetId of lowest score edge)
    const result = pruneTo(edges, frames, 2);
    expect(result.size).toBe(2);
    expect(result.has(1)).toBe(false);
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
  });

  it('multiple edges — respects targetCount', () => {
    // Use non-overlapping edges so each pruning step is independent
    // frames: 0,1,2,3,4 with edges only between pairs that share no targets
    const frames = makeFrames(6);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: 0.1 }, // lowest — frame 1 removed
      { sourceId: 2, targetId: 3, score: 0.2 }, // next — frame 3 removed
      { sourceId: 4, targetId: 5, score: 0.3 }, // next — frame 5 removed
    ];
    // prune from 6 to 3: remove 3 frames (1, 3, 5)
    const result = pruneTo(edges, frames, 3);
    expect(result.size).toBe(3);
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  it('exact target — returns all surviving IDs as Set<number>', () => {
    const frames = makeFrames(4);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: 0.5 },
      { sourceId: 1, targetId: 2, score: 0.3 },
      { sourceId: 2, targetId: 3, score: 0.8 },
    ];
    const result = pruneTo(edges, frames, 3);
    expect(result.size).toBe(3);
    // frame 2 has lowest-score edge from 1->2 (0.3), so frame 2 (targetId) should be removed
    expect(result.has(2)).toBe(false);
  });

  it('target = 1 — greedy algorithm reduces frames as much as possible', () => {
    // With chain edges 0→1→2, removing frame 1 makes edge 1→2 skip (source 1 gone)
    // So only 1 removal happens from 2 edges, leaving 2 frames surviving
    const frames = makeFrames(3);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: 0.1 },
      { sourceId: 1, targetId: 2, score: 0.2 },
    ];
    const result = pruneTo(edges, frames, 1);
    // Chain edges can only remove 1 frame (frame 1), leaving 2 frames [0, 2]
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  it('target = 1 — non-overlapping edges can reach target=1', () => {
    // frames: 0,1,2 with edges 0→1 and 0→2 (source 0 stays, both targets removable)
    const frames = makeFrames(3);
    const edges: ScoreEdge[] = [
      { sourceId: 0, targetId: 1, score: 0.1 },
      { sourceId: 0, targetId: 2, score: 0.2 },
    ];
    const result = pruneTo(edges, frames, 1);
    expect(result.size).toBe(1);
    expect(result.has(0)).toBe(true);
  });
});
