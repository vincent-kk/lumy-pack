import { describe, expect, it } from 'vitest';

import { computeSegmentPlan } from '../../core/segmenter/segmenter.js';

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

  it('effectiveFps has no lower bound for long videos', () => {
    const plans = computeSegmentPlan(10000, 300, 10, 5);
    expect(plans.every((p) => p.effectiveFps === 0.001)).toBe(true);
  });

  it('effectiveFps capped by fps parameter when fps < maxFrames/totalDuration', () => {
    // totalDuration=60s, maxFrames=600, fps=5
    // unclamped = min(5, 600/60=10) = 5 → fps wins
    const plans = computeSegmentPlan(60, 300, 600, 5);
    expect(plans[0].effectiveFps).toBe(5);
  });

  it('owned grid slots fit the budget and every allocation is positive', () => {
    const plans = computeSegmentPlan(900, 300, 100, 5);
    const total = plans.reduce(
      (sum, p) => sum + p.allocatedFrames - p.overlapBefore - p.overlapAfter,
      0,
    );
    expect(total).toBeLessThanOrEqual(100);
    expect(plans.every((p) => p.allocatedFrames >= 1)).toBe(true);
  });

  it('extractStartTime aligns to the global grid including the preceding overlap slot', () => {
    const plans = computeSegmentPlan(10, 4, 7, 5);
    const effectiveFps = plans[0].effectiveFps;
    const overlapTime = 1 / effectiveFps;

    expect(plans[0].extractStartTime).toBe(0);

    const expected = 2 * overlapTime;
    expect(plans[1].extractStartTime).toBeCloseTo(expected, 10);
    for (const plan of plans) {
      const slot = plan.extractStartTime * effectiveFps;
      expect(slot).toBeCloseTo(Math.round(slot), 10);
    }
  });

  it('extractDuration includes overlap extension on both sides', () => {
    const plans = computeSegmentPlan(10, 4, 7, 5);
    const effectiveFps = plans[0].effectiveFps;
    const overlapTime = 1 / effectiveFps;

    expect(plans[0].extractDuration).toBeGreaterThan(plans[0].duration);
    expect(plans[0].extractDuration).toBeCloseTo(4 * overlapTime, 10);

    const last = plans[plans.length - 1];
    expect(last.extractStartTime + last.extractDuration).toBeCloseTo(10, 10);
    expect(last.endTime).toBe(10);
  });

  it('single-segment: frame limit is the whole budget even when fps wins', () => {
    const plans = computeSegmentPlan(60, 300, 600, 5);
    expect(plans[0].allocatedFrames).toBe(600);
  });

  it('one hour with 300 frames never assigns a negative final budget', () => {
    const plans = computeSegmentPlan(3600, 300, 300, 5);
    expect(plans[plans.length - 1].allocatedFrames).toBeGreaterThan(0);
    expect(plans.map((p) => p.allocatedFrames)).toEqual([
      26, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 26,
    ]);
  });

  it('omits empty logical segments when the grid interval exceeds their length', () => {
    const plans = computeSegmentPlan(3600, 300, 10, 5);
    expect(plans).toHaveLength(10);
    expect(plans.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const plan of plans) {
      expect(
        plan.allocatedFrames - plan.overlapBefore - plan.overlapAfter,
      ).toBe(1);
      const firstOwned =
        plan.extractStartTime + plan.overlapBefore / plan.effectiveFps;
      expect(firstOwned).toBeGreaterThanOrEqual(plan.startTime);
      expect(firstOwned).toBeLessThan(plan.endTime);
    }
  });

  it('defends a budget below two before option validation', () => {
    const [plan] = computeSegmentPlan(10, 300, 1, 5);
    expect(plan.effectiveFps).toBe(0.2);
    expect(plan.allocatedFrames).toBe(2);
  });
});
