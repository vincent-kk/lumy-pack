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
