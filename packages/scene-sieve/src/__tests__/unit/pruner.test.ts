import { describe, expect, it } from 'vitest';
import { pruneTo, pruneByThreshold, pruneByThresholdWithCap } from '../../core/pruner.js';
import type { FrameNode, ScoreEdge } from '../../types/index.js';

function makeFrames(count: number): FrameNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    timestamp: i,
    extractPath: `/tmp/frame_${i}.jpg`,
  }));
}

function makeChainEdges(
  count: number,
  scores: number[],
): ScoreEdge[] {
  return scores.slice(0, count - 1).map((score, i) => ({
    sourceId: i,
    targetId: i + 1,
    score,
  }));
}

describe('pruneTo', () => {
  // ── 기존 테스트 (동작 유지) ──

  it('empty graph — no edges means no removals', () => {
    const frames = makeFrames(5);
    const result = pruneTo([], frames, 3);
    // edge가 없으면 제거 불가 → 전체 프레임 생존
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
    // frame 1 제거 후, 0과 2는 경계 프레임이므로 보호됨
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });

  // ── 핵심 버그 수정 검증 ──

  it('chain 15 frames → target 5 — always reaches exact targetCount', () => {
    const frames = makeFrames(15);
    // 교대 패턴: 낮은/높은 score (기존 알고리즘에서 targetCount 미달 유발)
    const scores = [0.1, 0.8, 0.1, 0.7, 0.1, 0.6, 0.1, 0.5, 0.1, 0.4, 0.1, 0.3, 0.1, 0.2];
    const edges = makeChainEdges(15, scores);
    const result = pruneTo(edges, frames, 5);
    expect(result.size).toBe(5);
    // 경계 보존
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

  // ── 경계 프레임 보호 ──

  it('boundary frames always preserved', () => {
    const frames = makeFrames(5);
    // 첫 프레임과 마지막 프레임 인접 edge가 가장 낮아도 보호됨
    const edges = makeChainEdges(5, [0.01, 0.5, 0.5, 0.01]);
    const result = pruneTo(edges, frames, 3);
    expect(result.has(0)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  // ── Re-linking 동작 검증 ──

  it('re-linking uses max(left, right) for synthetic edge', () => {
    const frames = makeFrames(5);
    // edges: 0→1(0.1), 1→2(0.9), 2→3(0.2), 3→4(0.8)
    const edges = makeChainEdges(5, [0.1, 0.9, 0.2, 0.8]);
    const result = pruneTo(edges, frames, 3);
    expect(result.size).toBe(3);
    // 0→1(0.1) 제거 → frame 1 제거, synthetic 0→2 = max(0.1, 0.9) = 0.9
    // 다음 lowest: 2→3(0.2) → frame 3 제거, synthetic 2→4 = max(0.2, 0.8) = 0.8
    // 결과: {0, 2, 4}
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  // ── 클러스터링 방지 ──

  it('high-score adjacent edges — selects temporally distributed frames', () => {
    const frames = makeFrames(10);
    // 전반부에 높은 변화, 후반부에 낮은 변화
    const scores = [0.1, 0.8, 0.9, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1];
    const edges = makeChainEdges(10, scores);
    const result = pruneTo(edges, frames, 5);
    expect(result.size).toBe(5);
    expect(result.has(0)).toBe(true);
    expect(result.has(9)).toBe(true);
    // 높은 변화 경계 근처 프레임이 보존되되, 시간 분포가 고르게 됨
  });

  // ── 대규모 입력 ──

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

  it('all normalized scores >= threshold — all frames preserved', () => {
    const frames = makeFrames(4);
    // scores: [0.8, 0.9, 0.7], max=0.9
    // normalized: [0.889, 1.0, 0.778] — all >= 0.5
    const edges = makeChainEdges(4, [0.8, 0.9, 0.7]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.size).toBe(4);
  });

  it('partial edges above threshold — keeps boundary + matching targetIds', () => {
    const frames = makeFrames(5);
    // scores: [0.1, 0.8, 0.1, 0.9], max=0.9
    // normalized: [0.111, 0.889, 0.111, 1.0]
    // threshold=0.5: edges 1->2(0.889) and 3->4(1.0) pass
    const edges = makeChainEdges(5, [0.1, 0.8, 0.1, 0.9]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.has(0)).toBe(true);   // boundary
    expect(result.has(1)).toBe(false);  // normalized 0.111 < 0.5
    expect(result.has(2)).toBe(true);   // normalized 0.889 >= 0.5
    expect(result.has(3)).toBe(false);  // normalized 0.111 < 0.5
    expect(result.has(4)).toBe(true);   // boundary + normalized 1.0
  });

  it('boundary value: normalized score === threshold — preserved (>= comparison)', () => {
    const frames = makeFrames(3);
    // scores: [0.3, 0.6], max=0.6
    // normalized: [0.5, 1.0]
    // threshold=0.5: both pass (0.5 >= 0.5)
    const edges = makeChainEdges(3, [0.3, 0.6]);
    const result = pruneByThreshold(edges, frames, 0.5);
    expect(result.size).toBe(3);
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
    expect(result.has(0)).toBe(true);   // boundary
    expect(result.has(2)).toBe(true);   // normalized 1.0 >= 0.5
    expect(result.has(4)).toBe(true);   // boundary
    expect(result.has(1)).toBe(false);  // NaN → 0
    expect(result.has(3)).toBe(false);  // negative → 0
  });
});

describe('pruneByThresholdWithCap', () => {
  it('survivors < cap -- returns threshold result as-is', () => {
    const frames = makeFrames(6);
    const edges = makeChainEdges(6, [0.1, 0.8, 0.1, 0.9, 0.2]);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 10);
    const thresholdOnly = pruneByThreshold(edges, frames, 0.5);
    expect(result).toEqual(thresholdOnly);
  });

  it('survivors > cap -- reduces to cap count', () => {
    const frames = makeFrames(10);
    const scores = [0.9, 0.8, 0.7, 0.85, 0.95, 0.6, 0.75, 0.88, 0.92];
    const edges = makeChainEdges(10, scores);
    const result = pruneByThresholdWithCap(edges, frames, 0.5, 4);
    expect(result.size).toBe(4);
    expect(result.has(0)).toBe(true);
    expect(result.has(9)).toBe(true);
  });

  it('survivors === cap -- returns exact cap count', () => {
    // Need a scenario where threshold survivors = exactly 3
    const frames = makeFrames(6);
    const edges = makeChainEdges(6, [0.2, 0.9, 0.1, 0.8, 0.3]);
    // max=0.9, normalized: [0.222, 1.0, 0.111, 0.889, 0.333]
    // threshold=0.8: edges with norm >= 0.8: 1->2(1.0), 3->4(0.889)
    // survivors: {0, 2, 4, 5} = 4 frames
    const thresholdOnly = pruneByThreshold(edges, frames, 0.8);
    const result = pruneByThresholdWithCap(edges, frames, 0.8, thresholdOnly.size);
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
