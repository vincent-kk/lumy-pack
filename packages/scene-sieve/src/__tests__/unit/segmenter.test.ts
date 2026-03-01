import { describe, expect, it } from 'vitest';

import {
  computeSegmentPlan,
  mergeSegmentFrames,
  shouldSegment,
} from '../../core/segmenter.js';
import type {
  AnimationMetadata,
  FrameNode,
  ResolvedOptions,
  ScoreEdge,
  SegmentPlan,
  SegmentResult,
  SieveOptions,
} from '../../types/index.js';

// ── Helpers ──

function makeResolvedOptions(
  overrides: Partial<ResolvedOptions> = {},
): ResolvedOptions {
  return {
    mode: 'file',
    count: 20,
    threshold: 0.5,
    pruneMode: 'threshold-with-cap',
    outputPath: '/tmp/out',
    fps: 5,
    maxFrames: 300,
    scale: 720,
    quality: 80,
    iouThreshold: 0.9,
    animationThreshold: 5,
    debug: false,
    maxSegmentDuration: 300,
    concurrency: 2,
    ...overrides,
  };
}

function makeFileOptions(inputPath: string): SieveOptions {
  return { mode: 'file', inputPath };
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

function makeSegmentResult(
  plan: SegmentPlan,
  frames: FrameNode[],
  edges: ScoreEdge[] = [],
  animations: AnimationMetadata[] = [],
): SegmentResult {
  return { segment: plan, frames, edges, animations };
}

// ── computeSegmentPlan ──

describe('computeSegmentPlan', () => {
  it('short video (no segmentation): 60s, max 300s → 1 segment, no overlap', () => {
    const plans = computeSegmentPlan(60, 300, 300, 5);
    expect(plans).toHaveLength(1);
    expect(plans[0].index).toBe(0);
    expect(plans[0].startTime).toBe(0);
    expect(plans[0].endTime).toBe(60);
    expect(plans[0].overlapBefore).toBe(0);
    expect(plans[0].overlapAfter).toBe(0);
    expect(plans[0].extractStartTime).toBe(0);
    expect(plans[0].extractDuration).toBe(60);
  });

  it('exact boundary: 300s duration, 300s max → 1 segment', () => {
    const plans = computeSegmentPlan(300, 300, 300, 5);
    expect(plans).toHaveLength(1);
    expect(plans[0].startTime).toBe(0);
    expect(plans[0].endTime).toBe(300);
    expect(plans[0].overlapBefore).toBe(0);
    expect(plans[0].overlapAfter).toBe(0);
  });

  it('two segments: 600s, 300s max → 2 segments with correct overlap flags', () => {
    const plans = computeSegmentPlan(600, 300, 600, 5);
    expect(plans).toHaveLength(2);

    // First segment: overlapAfter=1, overlapBefore=0
    expect(plans[0].overlapBefore).toBe(0);
    expect(plans[0].overlapAfter).toBe(1);
    expect(plans[0].startTime).toBe(0);
    expect(plans[0].endTime).toBe(300);

    // Last segment: overlapBefore=1, overlapAfter=0
    expect(plans[1].overlapBefore).toBe(1);
    expect(plans[1].overlapAfter).toBe(0);
    expect(plans[1].startTime).toBe(300);
    expect(plans[1].endTime).toBe(600);
  });

  it('three segments: 900s, 300s max → 3 segments with correct overlap pattern', () => {
    const plans = computeSegmentPlan(900, 300, 900, 5);
    expect(plans).toHaveLength(3);

    // First: only overlap after
    expect(plans[0].overlapBefore).toBe(0);
    expect(plans[0].overlapAfter).toBe(1);

    // Middle: overlap both sides
    expect(plans[1].overlapBefore).toBe(1);
    expect(plans[1].overlapAfter).toBe(1);

    // Last: only overlap before
    expect(plans[2].overlapBefore).toBe(1);
    expect(plans[2].overlapAfter).toBe(0);
  });

  it('non-even split: 500s, 300s max → 2 segments (300s + 200s)', () => {
    const plans = computeSegmentPlan(500, 300, 500, 5);
    expect(plans).toHaveLength(2);
    expect(plans[0].duration).toBe(300);
    expect(plans[1].duration).toBe(200);
    expect(plans[1].endTime).toBe(500);
  });

  it('effectiveFps is uniform across all segments', () => {
    const plans = computeSegmentPlan(900, 300, 900, 5);
    const fpsList = plans.map((p) => p.effectiveFps);
    expect(fpsList.every((fps) => fps === fpsList[0])).toBe(true);
  });

  it('effectiveFps min clamped to 0.5 for very long video with low maxFrames', () => {
    // totalDuration=10000s, maxFrames=10, fps=5
    // unclamped = 10/10000 = 0.001 → clamped to 0.5
    const plans = computeSegmentPlan(10000, 300, 10, 5);
    expect(plans.every((p) => p.effectiveFps === 0.5)).toBe(true);
  });

  it('effectiveFps capped by fps parameter when fps < maxFrames/totalDuration', () => {
    // totalDuration=60s, maxFrames=600, fps=5
    // unclamped = min(5, 600/60=10) = 5 → fps wins
    const plans = computeSegmentPlan(60, 300, 600, 5);
    expect(plans[0].effectiveFps).toBe(5);
  });

  it('allocatedFrames sum <= maxFrames after post-validation', () => {
    // Use values that cause over-allocation before adjustment
    const plans = computeSegmentPlan(900, 300, 100, 5);
    const total = plans.reduce((sum, p) => sum + p.allocatedFrames, 0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it('extractStartTime accounts for overlapBefore (shifted back by 1/effectiveFps)', () => {
    const plans = computeSegmentPlan(600, 300, 600, 5);
    const effectiveFps = plans[0].effectiveFps;
    const overlapTime = 1 / effectiveFps;

    // First segment: no overlap before, extractStartTime = 0
    expect(plans[0].extractStartTime).toBe(0);

    // Second segment: overlapBefore=1, extractStartTime = startTime - overlapTime
    const expected = Math.max(0, plans[1].startTime - overlapTime);
    expect(plans[1].extractStartTime).toBeCloseTo(expected, 10);
  });

  it('extractDuration includes overlap extension on both sides', () => {
    const plans = computeSegmentPlan(600, 300, 600, 5);
    const effectiveFps = plans[0].effectiveFps;
    const overlapTime = 1 / effectiveFps;

    // First segment has overlapAfter=1 → extractDuration > duration
    expect(plans[0].extractDuration).toBeGreaterThan(plans[0].duration);
    expect(plans[0].extractDuration).toBeCloseTo(
      plans[0].duration + overlapTime,
      10,
    );

    // Last segment has overlapBefore=1 → extractDuration > duration
    expect(plans[1].extractDuration).toBeGreaterThan(plans[1].duration);
  });

  it('single-segment: allocatedFrames = ceil(effectiveFps * duration), capped by maxFrames', () => {
    const plans = computeSegmentPlan(60, 300, 300, 5);
    const expected = Math.min(
      Math.ceil(plans[0].effectiveFps * 60),
      300,
    );
    expect(plans[0].allocatedFrames).toBe(expected);
  });
});

// ── mergeSegmentFrames ──

describe('mergeSegmentFrames', () => {
  it('empty input → returns empty arrays', () => {
    const result = mergeSegmentFrames([]);
    expect(result.frames).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.animations).toEqual([]);
  });

  it('single segment: timestamps adjusted by extractStartTime', () => {
    const plan = makeSegmentPlan({ index: 0, extractStartTime: 10 });
    const frames = makeFrames(3, 0, 0); // timestamps: 0, 1, 2
    const result = makeSegmentResult(plan, frames);

    const merged = mergeSegmentFrames([result]);

    // Each frame.timestamp += extractStartTime (10)
    expect(merged.frames[0].timestamp).toBeCloseTo(10);
    expect(merged.frames[1].timestamp).toBeCloseTo(11);
    expect(merged.frames[2].timestamp).toBeCloseTo(12);
  });

  it('single segment: IDs are remapped to 0-based sequential', () => {
    const plan = makeSegmentPlan({ index: 0, extractStartTime: 0 });
    const frames = makeFrames(3, 0, 0);
    const result = makeSegmentResult(plan, frames);

    const merged = mergeSegmentFrames([result]);

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

  it('frames outside duplicate threshold are both kept', () => {
    // effectiveFps=1 → dupThreshold = 0.5
    // Two frames at t=0 and t=1.0 (exactly 1.0 apart → NOT a duplicate)
    const plan0 = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const plan1 = makeSegmentPlan({ index: 1, extractStartTime: 1.0, effectiveFps: 1 });

    const frames0: FrameNode[] = [{ id: 0, timestamp: 0, extractPath: '/tmp/s0.jpg' }];
    const frames1: FrameNode[] = [{ id: 0, timestamp: 0, extractPath: '/tmp/s1.jpg' }];

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0),
      makeSegmentResult(plan1, frames1),
    ]);

    expect(merged.frames).toHaveLength(2);
  });

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
    // To produce a duplicate edge:
    // - Both segments must map their local frame pair to the SAME global frame pair.
    // - This happens when segment overlap frames both survive dedup AND both segments
    //   have an edge between those two shared frames.
    //
    // Setup (effectiveFps=1, dupThreshold=0.5):
    //   seg0 (extractStartTime=0): frames at local t=0,1,2 → global t=0,1,2
    //   seg1 (extractStartTime=2): frames at local t=0,1,2 → global t=2,3,4
    //   seg0 frame2 (global t=2) and seg1 frame0 (global t=2) are the same → dup: seg1:0 dropped
    //
    // seg0 edge: local 1→2 (global 1→2), score=0.3
    // seg1 edge: local 0→1 (seg1:0→seg1:1). seg1:0 maps to global 2, seg1:1 maps to global 3.
    //   → global edge 2→3, score=0.7 (different pair, no conflict)
    //
    // For a true duplicate, we need TWO segments both producing edge for global 1→2.
    // seg0 produces global edge 1→2 (score=0.3).
    // Add a third segment (same segment index reuse doesn't work; use a direct approach):
    // Instead, put two overlapping segments where both see frames A and B.
    //
    // Cleaner approach: use extractStartTime so seg1 frames land at same global timestamps
    // as seg0, making them all dups except none survive from seg1 — no duplicate edge possible
    // through natural overlap.
    //
    // The REAL duplicate edge scenario: two segments both extract the same two frames
    // (both survive dedup) and both report an edge between them.
    // This requires: seg0:frameA → global G0, seg0:frameB → global G1
    //                seg1:frameX → global G0 (not dup — different time slot), seg1:frameY → global G1
    // That's impossible via timestamp dedup — same global slot means dup.
    //
    // The actual path to duplicate edges is: seg0 and seg1 share the SAME two frames
    // that both survive, AND both report an edge. This only happens if they both map
    // local IDs to the same global pair through globalIdMap.
    //
    // Simplest valid case: a segment result where two different local (segIdx,localId) pairs
    // map to the same globalId. Since globalIdMap key = "segmentIndex:localId", two
    // results with DIFFERENT segmentIndex can independently map to unique global slots,
    // then produce edges for the same global pair only if their frame timestamps collide
    // in a way that makes them map to the same global ID — which is exactly the dup case
    // where one gets dropped.
    //
    // Conclusion: duplicate edges from different segments cannot arise through the
    // timestamp-dedup mechanism. They CAN arise if the same SegmentResult appears twice
    // (same segment.index) OR if we manually construct globalIdMap entries that alias.
    // Test the actual dedup-score-merge path by using same segment twice:

    const plan = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const frames: FrameNode[] = [
      { id: 0, timestamp: 0, extractPath: '/tmp/f0.jpg' },
      { id: 1, timestamp: 1, extractPath: '/tmp/f1.jpg' },
    ];
    const edges0: ScoreEdge[] = [{ sourceId: 0, targetId: 1, score: 0.3 }];
    // Provide the same segment (index=0) twice with different edge scores.
    // Second result with same plan index=0, same frame ids → globalIdMap overwrites
    // (map key "0:0" and "0:1" get reassigned to new global ids 2,3 since frames
    //  at t=0.1,1.1 survive — they are NOT within 0.5 of t=0.0,1.0... wait:
    //  t=0 and t=0.1: diff=0.1 < 0.5 → dup. t=1 and t=1.1: diff=0.1 < 0.5 → dup.
    //  So seg1 frames all dropped, edges dropped. Still no duplicate edge.
    //
    // The only way to trigger duplicate edge merge: same segment result with a
    // slightly different timestamp that avoids dedup (>= dupThreshold apart),
    // but with globalIdMap colliding on "segIndex:localId". This requires reusing
    // a segment index with frames that survive. Use segment index=0 with frames
    // at t=10,11 (far from t=0,1 → both survive), and add edges for local 0→1.
    // Both "0:0"→globalA and "0:0"→globalC — second write wins in globalIdMap.
    // Edge from first result: source=globalA, target=globalB (from first map write).
    // Edge from second result: source=globalC, target=globalD (from second map write).
    // These are different global pairs → still no duplicate.
    //
    // ACTUAL conclusion: duplicate edges with same globalKey "src-tgt" can ONLY occur
    // if two separate segment results happen to produce edges whose remapped global IDs
    // coincide. Since globalIdMap uses "segmentIndex:localId" as key and the second
    // write (same segmentIndex, same localId) overwrites the first in the map iteration,
    // this IS possible when the same (segmentIndex, localId) maps to a new global slot
    // on the second pass — but the loop processes results sequentially, and uniqueFrames
    // assigns global IDs once. If two results share segmentIndex, the second result's
    // frames (if they survive) get a NEW global slot, but the globalIdMap for "idx:id"
    // gets OVERWRITTEN to point to the new slot. So edges from result1 reference the
    // new slot (correct), edges from result0 also reference whatever "0:0" resolves to
    // at lookup time — which is the LAST written value. This means result0's edges
    // would be remapped to result1's global slots — producing a duplicate edge!

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

    // After globalIdMap collision: "0:0" → global 2, "0:1" → global 3 (second write wins).
    // result0 edges lookup "0:0" → 2, "0:1" → 3 → edge 2→3, score=0.3
    // result1 edges lookup "0:0" → 2, "0:1" → 3 → edge 2→3, score=0.9 → DUPLICATE, keep 0.9
    // But result0's original edge 0→1 (global 0→1) is also present if first write was preserved.
    // Actually globalIdMap is built in the uniqueFrames.map() call which iterates uniqueFrames once.
    // uniqueFrames has 4 entries: (seg0:t=0→g0), (seg0:t=1→g1), (seg0idx1:t=10→g2), (seg0idx1:t=11→g3)
    // globalIdMap: "0:0"→0 then overwritten by "0:0"→2; "0:1"→1 then overwritten by "0:1"→3
    // result0 edges: lookup "0:0"→2, "0:1"→3 → edge 2→3, score=0.3
    // result1 edges: lookup "0:0"→2, "0:1"→3 → edge 2→3, score=0.9 → dup, keep 0.9
    // So only 1 edge exists for global pair 2→3 with score=0.9
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

  it('two-segment merge: frames from both segments present in sorted order', () => {
    const plan0 = makeSegmentPlan({ index: 0, extractStartTime: 0, effectiveFps: 1 });
    const plan1 = makeSegmentPlan({ index: 1, extractStartTime: 10, effectiveFps: 1 });

    const frames0 = makeFrames(3, 0, 0); // t=0,1,2
    const frames1 = makeFrames(3, 1, 0); // global t=10,11,12

    const merged = mergeSegmentFrames([
      makeSegmentResult(plan0, frames0),
      makeSegmentResult(plan1, frames1),
    ]);

    expect(merged.frames).toHaveLength(6);
    const timestamps = merged.frames.map((f) => f.timestamp);
    expect(timestamps[0]).toBe(0);
    expect(timestamps[3]).toBe(10);
    expect(timestamps[5]).toBe(12);
  });
});

// ── shouldSegment ──

describe('shouldSegment', () => {
  it('frames mode: always returns false', () => {
    const resolved = makeResolvedOptions({ mode: 'frames' });
    const options: SieveOptions = {
      mode: 'frames',
      inputFrames: [],
    };
    expect(shouldSegment(resolved, options)).toBe(false);
  });

  it('file mode + .gif input: returns false', () => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions('/path/to/animation.gif');
    expect(shouldSegment(resolved, options)).toBe(false);
  });

  it('file mode + .GIF input (uppercase): returns false (case insensitive)', () => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions('/path/to/animation.GIF');
    expect(shouldSegment(resolved, options)).toBe(false);
  });

  it('file mode + .mp4 input: returns true', () => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions('/path/to/video.mp4');
    expect(shouldSegment(resolved, options)).toBe(true);
  });

  it('file mode + .mov input: returns true', () => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions('/path/to/video.mov');
    expect(shouldSegment(resolved, options)).toBe(true);
  });

  it('buffer mode: returns true', () => {
    const resolved = makeResolvedOptions({ mode: 'buffer' });
    const options: SieveOptions = {
      mode: 'buffer',
      inputBuffer: Buffer.from(''),
    };
    expect(shouldSegment(resolved, options)).toBe(true);
  });

  it('file mode + mixed case extension (.Gif): returns false', () => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions('/path/to/animation.Gif');
    expect(shouldSegment(resolved, options)).toBe(false);
  });

  it('file mode + .gif in path directory (not extension): returns true', () => {
    const resolved = makeResolvedOptions({ mode: 'file' });
    const options = makeFileOptions('/path/gif.stuff/video.mp4');
    expect(shouldSegment(resolved, options)).toBe(true);
  });
});
