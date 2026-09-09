/**
 * Unit tests for analyzer.ts pure functions:
 * - computeIoU
 * - computeInformationGain
 * - IoUTracker
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  IoUTracker,
  computeInformationGain,
  computeIoU,
} from '../../core/analyzer.js';
import type { BoundingBox } from '../../types/index.js';

// ── computeIoU ────────────────────────────────────────────────────────────────

describe('computeIoU', () => {
  it('같은 박스는 IoU = 1.0', () => {
    const box: BoundingBox = { x: 10, y: 10, width: 50, height: 50 };
    expect(computeIoU(box, box)).toBe(1.0);
  });

  it('완전히 분리된 박스는 IoU = 0', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };
    const b: BoundingBox = { x: 20, y: 20, width: 10, height: 10 };
    expect(computeIoU(a, b)).toBe(0);
  });

  it('부분 겹침 — 정확한 값 검증', () => {
    // a: [0,0] to [10,10], area = 100
    // b: [5,5] to [15,15], area = 100
    // intersection: [5,5] to [10,10] = 5*5 = 25
    // union = 100 + 100 - 25 = 175
    // IoU = 25/175 ≈ 0.142857...
    const a: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };
    const b: BoundingBox = { x: 5, y: 5, width: 10, height: 10 };
    expect(computeIoU(a, b)).toBeCloseTo(25 / 175, 8);
  });

  it('한 박스가 다른 박스를 완전히 포함하는 경우', () => {
    // a: [0,0] to [20,20], area = 400
    // b: [5,5] to [15,15], area = 100
    // intersection = 100
    // union = 400 + 100 - 100 = 400
    // IoU = 100/400 = 0.25
    const a: BoundingBox = { x: 0, y: 0, width: 20, height: 20 };
    const b: BoundingBox = { x: 5, y: 5, width: 10, height: 10 };
    expect(computeIoU(a, b)).toBeCloseTo(0.25, 8);
  });

  it('width=0인 박스 → IoU = 0', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 0, height: 10 };
    const b: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };
    expect(computeIoU(a, b)).toBe(0);
  });

  it('height=0인 박스 → IoU = 0', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 10, height: 0 };
    const b: BoundingBox = { x: 0, y: 0, width: 10, height: 10 };
    expect(computeIoU(a, b)).toBe(0);
  });

  it('교환법칙 — computeIoU(a,b) == computeIoU(b,a)', () => {
    const a: BoundingBox = { x: 0, y: 0, width: 30, height: 20 };
    const b: BoundingBox = { x: 15, y: 10, width: 30, height: 20 };
    expect(computeIoU(a, b)).toBeCloseTo(computeIoU(b, a), 10);
  });
});

// ── computeInformationGain ────────────────────────────────────────────────────

describe('computeInformationGain', () => {
  it('빈 클러스터 배열 → 0', () => {
    expect(computeInformationGain([], [], 1000, new Set(), [])).toBe(0);
  });

  it('단일 클러스터, animationIndices 비어있음 → positive', () => {
    const clusters: BoundingBox[] = [{ x: 0, y: 0, width: 100, height: 100 }];
    const clusterPoints = [10];
    const imageArea = 1000 * 1000;
    // normalizedArea = (100*100) / (1000*1000) = 0.01
    // featureDensity = 10 / (100*100) = 0.001
    // contribution = 0.01 * 0.001 = 0.00001
    const result = computeInformationGain(
      clusters,
      clusterPoints,
      imageArea,
      new Set(),
      [],
    );
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(0.01 * (10 / (100 * 100)), 10);
  });

  it('다중 클러스터 — gain이 각 contribution의 합', () => {
    const imageArea = 1000 * 1000;
    const clusters: BoundingBox[] = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 200, y: 200, width: 50, height: 50 },
    ];
    const clusterPoints = [10, 5];
    // cluster0: normalizedArea=0.01, density=10/10000=0.001, contribution=0.00001
    // cluster1: normalizedArea=0.0025, density=5/2500=0.002, contribution=0.000005
    const expected = 0.01 * (10 / 10000) + 0.0025 * (5 / 2500);
    const result = computeInformationGain(
      clusters,
      clusterPoints,
      imageArea,
      new Set(),
      [],
    );
    expect(result).toBeCloseTo(expected, 10);
  });

  it('animationIndices에 포함된 클러스터는 contribution이 감쇄됨', () => {
    const imageArea = 1000 * 1000;
    const clusters: BoundingBox[] = [{ x: 0, y: 0, width: 100, height: 100 }];
    const clusterPoints = [10];
    const animWeight = 0.5;

    const withoutAnim = computeInformationGain(
      clusters,
      clusterPoints,
      imageArea,
      new Set(),
      [animWeight],
    );
    const withAnim = computeInformationGain(
      clusters,
      clusterPoints,
      imageArea,
      new Set([0]),
      [animWeight],
    );

    // withAnim = withoutAnim * (1 - animWeight) = withoutAnim * 0.5
    expect(withAnim).toBeCloseTo(withoutAnim * (1 - animWeight), 10);
    expect(withAnim).toBeLessThan(withoutAnim);
  });

  it('clusterArea <= 0 인 경우 contribution은 0', () => {
    const clusters: BoundingBox[] = [{ x: 0, y: 0, width: 0, height: 100 }];
    const result = computeInformationGain(clusters, [10], 10000, new Set(), []);
    expect(result).toBe(0);
  });
});

// ── IoUTracker ─────────────────────────────────────────────────────────────────

describe('IoUTracker', () => {
  let tracker: IoUTracker;

  beforeEach(() => {
    tracker = new IoUTracker();
  });

  it('첫 update 호출 시 animationIndices가 비어있음 (consecutiveCount < threshold)', () => {
    const boxes: BoundingBox[] = [{ x: 0, y: 0, width: 50, height: 50 }];
    const animIndices = tracker.update(boxes, 0);
    expect(animIndices.size).toBe(0);
  });

  it('높은 IoU 박스 연속 update → 리전이 매칭됨', () => {
    // Use nearly identical boxes because IoU_THRESHOLD = 0.9
    const box: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const slightlyDiff: BoundingBox = { x: 1, y: 1, width: 99, height: 99 };
    // IoU: intersection=[1,1] to [100,100] = 99*99=9801
    // union = 100*100 + 99*99 - 9801 = 10000 + 9801 - 9801 = 10000
    // IoU = 9801/10000 = 0.9801 > 0.9 → matched

    // Reach consecutiveCount 3 (below ANIMATION_FRAME_THRESHOLD=5)
    tracker.update([box], 0);
    tracker.update([slightlyDiff], 1);
    const animIndices = tracker.update([box], 2);
    expect(animIndices.size).toBe(0); // consecutiveCount=3, below threshold=5
  });

  it('ANIMATION_FRAME_THRESHOLD(5) 도달 시 animationIndices에 포함', () => {
    const box: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    // Update the same box five times: pairIndex 0 pushes it with consecutiveCount=1.
    // Matches at pairIndex 1, 2, and 3 set consecutiveCount to 2, 3, and 4, respectively.
    // The match at pairIndex 4 sets consecutiveCount=5, including it in animationIndices.

    tracker.update([box], 0); // count=1 (newly pushed)
    tracker.update([box], 1); // count=2
    tracker.update([box], 2); // count=3
    tracker.update([box], 3); // count=4
    const animIndices = tracker.update([box], 4); // count=5 → animation
    expect(animIndices.has(0)).toBe(true);
  });

  it('가중치 감쇄: gap이 있으면 weight가 DECAY_LAMBDA^gap으로 감쇄', () => {
    const DECAY_LAMBDA = 0.95;
    const box: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };

    // Five consecutive updates create an animation region; pairIndex 0 pushes it with weight=1.0, lastSeen=0.
    // At pairIndex 1, 2, 3, and 4, each update applies gap=1 and multiplies weight by 0.95^1.
    // The four consecutive decays yield a cumulative weight of 0.95^4 at pairIndex 4.
    tracker.update([box], 0);
    tracker.update([box], 1);
    tracker.update([box], 2);
    tracker.update([box], 3);
    tracker.update([box], 4); // count=5, animation → weight = 0.95^4

    // pairIndex=10: gap=6, weight = 0.95^4 * 0.95^6 = 0.95^10
    tracker.update([box], 10);

    const weight = tracker.getAnimationWeight(0, [box]);
    // Four consecutive gap=1 decays (pairIndex 1~4) + gap=6 decay = 0.95^10
    expect(weight).toBeCloseTo(Math.pow(DECAY_LAMBDA, 10), 5);
  });

  it('박스가 크게 이동하면 새 리전으로 추가됨 (낮은 IoU)', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 50, height: 50 };
    const box2: BoundingBox = { x: 500, y: 500, width: 50, height: 50 };

    tracker.update([box1], 0);
    const animIndices = tracker.update([box2], 1);
    // Add box2 as a new region because its IoU with box1 is 0
    expect(animIndices.size).toBe(0);
  });

  it('flushAndGetAnimations()가 지속된 애니메이션을 반환함', () => {
    const box: BoundingBox = { x: 10, y: 10, width: 100, height: 100 };
    // Five consecutive updates (ANIMATION_FRAME_THRESHOLD=5)
    for (let i = 0; i < 5; i++) {
      tracker.update([box], i);
    }

    const animations = tracker.flushAndGetAnimations();
    expect(animations).toHaveLength(1);
    expect(animations[0].startFrameId).toBe(0);
    expect(animations[0].endFrameId).toBe(4);
    expect(animations[0].type).toBe('loading_spinner');
  });

  it('weight가 임계값(0.01) 이하로 떨어질 때 애니메이션 수집', () => {
    const box: BoundingBox = { x: 10, y: 10, width: 100, height: 100 };
    // Five consecutive updates
    for (let i = 0; i < 5; i++) {
      tracker.update([box], i);
    }

    // Use a large gap (100) to sharply reduce the weight
    // DECAY_LAMBDA=0.95, 0.95^100 < 0.01
    tracker.update([], 105);

    // Must already be collected before flushing (stored in the internal array)
    const animations = tracker.flushAndGetAnimations();
    expect(animations).toHaveLength(1);
    expect(animations[0].endFrameId).toBe(4);
  });
});
