import { describe, expect, it } from 'vitest';

import { computeSegmentPlan } from '../../core/segmenter.js';
import type { SegmentPlan } from '../../types/index.js';

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
