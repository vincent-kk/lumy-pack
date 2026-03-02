import { describe, expect, it } from 'vitest';

import { mergeSegmentFrames } from '../../core/segmenter.js';
import type {
  AnimationMetadata,
  FrameNode,
  ScoreEdge,
  SegmentPlan,
  SegmentResult,
} from '../../types/index.js';

// ── Helpers ──

function makeSegmentPlan(overrides: Partial<SegmentPlan> = {}): SegmentPlan {
  return {
    index: 0,
    startTime: 0,
    endTime: 300,
    duration: 300,
    allocatedFrames: 150,
    effectiveFps: 0.5,
    overlapBefore: 0,
    overlapAfter: 0,
    extractStartTime: 0,
    extractDuration: 300,
    ...overrides,
  };
}

function makeFrames(
  count: number,
  segmentIndex = 0,
  timestampOffset = 0,
): FrameNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    timestamp: timestampOffset + i * 1.0,
    extractPath: `/tmp/seg${segmentIndex}_frame_${i}.jpg`,
  }));
}

function makeSegmentResult(
  plan: SegmentPlan,
  frames: FrameNode[],
  edges: ScoreEdge[] = [],
  animations: AnimationMetadata[] = [],
): SegmentResult {
  return { segment: plan, frames, edges, animations };
}

// ── mergeSegmentFrames ──

describe('mergeSegmentFrames', () => {
  it('empty input → returns empty arrays', () => {
    const result = mergeSegmentFrames([]);
    expect(result.frames).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.animations).toEqual([]);
  });

  it('single segment: timestamps adjusted by extractStartTime and IDs remapped to 0-based sequential', () => {
    const plan = makeSegmentPlan({ index: 0, extractStartTime: 10 });
    const frames = makeFrames(3, 0, 0); // timestamps: 0, 1, 2
    const result = makeSegmentResult(plan, frames);

    const merged = mergeSegmentFrames([result]);

    // Each frame.timestamp += extractStartTime (10)
    expect(merged.frames[0].timestamp).toBeCloseTo(10);
    expect(merged.frames[1].timestamp).toBeCloseTo(11);
    expect(merged.frames[2].timestamp).toBeCloseTo(12);
    // IDs are remapped to 0-based sequential
    expect(merged.frames.map((f) => f.id)).toEqual([0, 1, 2]);
  });

  it('merged frames are sorted by global timestamp', () => {
    // Segment 0 ends at t=5, segment 1 starts at t=3 (overlap)
    const plan0 = makeSegmentPlan({
      index: 0,
      extractStartTime: 0,
      effectiveFps: 1,
      overlapAfter: 1,
    });
    const plan1 = makeSegmentPlan({
      index: 1,
      extractStartTime: 3,
      effectiveFps: 1,
      overlapBefore: 1,
    });

    // Frames with local timestamps 0,1,2 → global 0,1,2
    const frames0 = makeFrames(3, 0, 0);
    // Frames with local timestamps 0,1,2 → global 3,4,5
    const frames1 = makeFrames(3, 1, 0);

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0),
      makeSegmentResult(plan1, frames1),
    ]);

    const timestamps = merged.frames.map((f) => f.timestamp);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it('two segments with overlap: duplicate frames within threshold are removed (keep first)', () => {
    // effectiveFps=1 → dupThreshold = 1/(1*2) = 0.5
    // segment 0: frame at global t=2.0
    // segment 1: frame at global t=2.1 (within 0.5 threshold → duplicate, drop)
    const plan0 = makeSegmentPlan({
      index: 0,
      extractStartTime: 0,
      effectiveFps: 1,
    });
    const plan1 = makeSegmentPlan({
      index: 1,
      extractStartTime: 0.1,
      effectiveFps: 1,
    });

    // frames at local t=2 → global t=2.0 (plan0) and t=2.1 (plan1)
    const frames0: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/s0f0.jpg' },
      { id: 1, timestamp: 2, extractPath: '/tmp/s0f1.jpg' },
    ];
    const frames1: FrameNode[] = [
      { id: 0, timestamp: 2, extractPath: '/tmp/s1f0.jpg' }, // global=2.1, dup
      { id: 1, timestamp: 5, extractPath: '/tmp/s1f1.jpg' },
    ];

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0),
      makeSegmentResult(plan1, frames1),
    ]);

    // 4 frames: t=0, t=2.0, t=2.1(dup), t=5.1 → 3 unique after dedup
    expect(merged.frames).toHaveLength(3);
    // The kept frame at ~t=2 should be from segment 0 (extractPath s0f1)
    const nearT2 = merged.frames.find((f) => Math.abs(f.timestamp - 2.0) < 0.5);
    expect(nearT2?.extractPath).toBe('/tmp/s0f1.jpg');
  });

  it.each([
    [
      'frames outside duplicate threshold are both kept',
      // effectiveFps=1 → dupThreshold = 0.5
      // Two frames at t=0 and t=1.0 (exactly 1.0 apart → NOT a duplicate)
      { index: 0, extractStartTime: 0, effectiveFps: 1 },
      { index: 1, extractStartTime: 1.0, effectiveFps: 1 },
      { id: 0, timestamp: 0, extractPath: '/tmp/s0.jpg' },
      { id: 0, timestamp: 0, extractPath: '/tmp/s1.jpg' },
      2,
    ],
    [
      'two-segment merge: frames from both segments present in sorted order',
      { index: 0, extractStartTime: 0, effectiveFps: 1 },
      { index: 1, extractStartTime: 10, effectiveFps: 1 },
      null, // use makeFrames(3, 0, 0)
      null, // use makeFrames(3, 1, 0)
      6,
    ],
  ] as const)(
    '%s',
    (_label, plan0Overrides, plan1Overrides, singleFrame0, singleFrame1, expectedLength) => {
      const plan0 = makeSegmentPlan(plan0Overrides);
      const plan1 = makeSegmentPlan(plan1Overrides);

      const frames0: FrameNode[] = singleFrame0
        ? [singleFrame0]
        : makeFrames(3, 0, 0);
      const frames1: FrameNode[] = singleFrame1
        ? [singleFrame1]
        : makeFrames(3, 1, 0);

      const merged = mergeSegmentFrames([
        makeSegmentResult(plan0, frames0),
        makeSegmentResult(plan1, frames1),
      ]);

      expect(merged.frames).toHaveLength(expectedLength);

      if (!singleFrame0 && !singleFrame1) {
        // two-segment merge: verify sorted timestamps
        const timestamps = merged.frames.map((f) => f.timestamp);
        expect(timestamps[0]).toBe(0);
        expect(timestamps[3]).toBe(10);
        expect(timestamps[5]).toBe(12);
      }
    },
  );

  it('ID remapping: after dedup, IDs are sequential 0..N-1', () => {
    const plan0 = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const plan1 = makeSegmentPlan({ index: 1, extractStartTime: 10, effectiveFps: 1 });

    const frames0 = makeFrames(3, 0, 0);
    const frames1 = makeFrames(3, 1, 0);

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0),
      makeSegmentResult(plan1, frames1),
    ]);

    expect(merged.frames.map((f) => f.id)).toEqual(
      Array.from({ length: merged.frames.length }, (_, i) => i),
    );
  });

  it('edge remapping: sourceId/targetId updated to global IDs', () => {
    const plan0 = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });

    const frames: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/f0.jpg' },
      { id: 1, timestamp: 1, extractPath: '/tmp/f1.jpg' },
    ];
    const edges: ScoreEdge[] = [{ sourceId: 0, targetId: 1, score: 0.8 }];

    const merged = mergeSegmentFrames([makeSegmentResult(plan0, frames, edges)]);

    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0].sourceId).toBe(0);
    expect(merged.edges[0].targetId).toBe(1);
    expect(merged.edges[0].score).toBe(0.8);
  });

  it('duplicate edge handling: overlapping segment edges with same source/target keep higher score', () => {
    const plan = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const frames: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/f0.jpg' },
      { id: 1, timestamp: 1, extractPath: '/tmp/f1.jpg' },
    ];
    const edges0: ScoreEdge[] = [{ sourceId: 0, targetId: 1, score: 0.3 }];

    const plan1same = makeSegmentPlan({
      index: 0, // same segment index → globalIdMap collision
      extractStartTime: 10,
      effectiveFps: 1,
    });
    const frames1far: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/g0.jpg' }, // global t=10, far from t=0 → survives
      { id: 1, timestamp: 1, extractPath: '/tmp/g1.jpg' }, // global t=11, far from t=1 → survives
    ];
    const edges1far: ScoreEdge[] = [{ sourceId: 0, targetId: 1, score: 0.9 }];

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan, frames, edges0),
      makeSegmentResult(plan1same, frames1far, edges1far),
    ]);

    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0].score).toBe(0.9);
  });

  it('edge with unmapped node (filtered duplicate) is dropped', () => {
    // If a local frame was a duplicate and got deduped, its edge should be dropped
    const plan0 = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 2 });
    const plan1 = makeSegmentPlan({ index: 1, extractStartTime: 0.1, effectiveFps: 2 });

    // dupThreshold = 1/(2*2) = 0.25
    const frames0: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/s0f0.jpg' },
      { id: 1, timestamp: 1, extractPath: '/tmp/s0f1.jpg' },
    ];
    // frame0 of seg1 at global t=0.1 → dup of seg0 frame0
    // frame1 of seg1 at global t=2 → unique
    const frames1: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/s1f0.jpg' }, // global 0.1, dup
      { id: 1, timestamp: 2, extractPath: '/tmp/s1f1.jpg' }, // global 2.1, unique
    ];
    // Edge references local 0 (deduped) → should be dropped
    const edges1: ScoreEdge[] = [{ sourceId: 0, targetId: 1, score: 0.7 }];

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0, []),
      makeSegmentResult(plan1, frames1, edges1),
    ]);

    // local 0 of seg1 was deduped → no globalId → edge dropped
    const droppedEdge = merged.edges.find(
      (e) =>
        e.score === 0.7,
    );
    expect(droppedEdge).toBeUndefined();
  });

  it('animation remapping: startFrameId/endFrameId updated to global IDs', () => {
    const plan = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const frames = makeFrames(4, 0, 0);
    const animations: AnimationMetadata[] = [
      {
        type: 'scroll',
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        startFrameId: 1,
        endFrameId: 3,
        durationMs: 2000,
      },
    ];

    const merged = mergeSegmentFrames([makeSegmentResult(plan, frames, [], animations)]);

    expect(merged.animations).toHaveLength(1);
    // Local 1 → global 1, local 3 → global 3 (no dedup in single segment)
    expect(merged.animations[0].startFrameId).toBe(1);
    expect(merged.animations[0].endFrameId).toBe(3);
  });

  it('animation with unmapped frame (deduped) is dropped', () => {
    const plan0 = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const plan1 = makeSegmentPlan({ index: 1, extractStartTime: 0.1, effectiveFps: 1 });

    // dupThreshold = 0.5
    const frames0: FrameNode[] = [{ id: 0, timestamp: 0, extractPath: '/tmp/a.jpg' }];
    // seg1 frame at global 0.1 → dup
    const frames1: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/b.jpg' }, // global 0.1, dup
      { id: 1, timestamp: 5, extractPath: '/tmp/c.jpg' },
    ];
    // Animation references local 0 (deduped) → dropped
    const animations1: AnimationMetadata[] = [
      {
        type: 'fade',
        boundingBox: { x: 0, y: 0, width: 50, height: 50 },
        startFrameId: 0,
        endFrameId: 1,
        durationMs: 500,
      },
    ];

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0, [], []),
      makeSegmentResult(plan1, frames1, [], animations1),
    ]);

    // startFrameId=0 (local seg1) maps to no global id (deduped) → animation dropped
    expect(merged.animations).toHaveLength(0);
  });
});
