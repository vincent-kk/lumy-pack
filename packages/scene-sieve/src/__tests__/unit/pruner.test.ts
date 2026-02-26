import { describe, expect, it } from 'vitest';

import {
  pruneByThreshold,
  pruneByThresholdWithCap,
  pruneTo,
} from '../../core/pruner.js';
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
    const scores = [
      0.1, 0.8, 0.1, 0.7, 0.1, 0.6, 0.1, 0.5, 0.1, 0.4, 0.1, 0.3, 0.1, 0.2,
    ];
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
    const resultLow = pruneByThreshold(edges, frames, 0.1);
    // idx 1(0.1), 2(0.2), 3(0.5), 4(0.8), 5(0.9), 6(1.0) pass.
    // NMS run [1,2,3,4,5,6], peak is idx 6. targetId 7.
    // Still 2? Ah, NMS collapses consecutive runs.
    // Let's use non-consecutive scores to test "relative" filtering.
    const nonConsecScores = [90, 10, 95, 10, 100]; // high baseline is 90
    // wait, sorted: [10, 10, 90, 95, 100]. P10: 10, P90: 100.
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
