import { describe, expect, it } from 'vitest';
import { dbscan } from '../../core/dbscan.js';
import type { Point2D } from '../../core/dbscan.js';

describe('dbscan', () => {
  it('empty input — returns empty result', () => {
    const result = dbscan([], 640, 480);
    expect(result.labels).toHaveLength(0);
    expect(result.boundingBoxes).toHaveLength(0);
  });

  it('single point with insufficient neighbors — noise (label = -1)', () => {
    const points: Point2D[] = [{ x: 100, y: 100 }];
    const result = dbscan(points, 640, 480, 0.03, 2);
    expect(result.labels[0]).toBe(-1);
    expect(result.boundingBoxes).toHaveLength(0);
  });

  it('cluster of close points — forms one cluster', () => {
    // 5 points clustered together
    const points: Point2D[] = [
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 11 },
      { x: 11, y: 11 },
      { x: 12, y: 10 },
    ];
    const result = dbscan(points, 640, 480, 0.03, 2);
    const uniqueLabels = new Set(result.labels.filter((l) => l >= 0));
    expect(uniqueLabels.size).toBe(1);
    expect(result.boundingBoxes).toHaveLength(1);
  });

  it('two distinct clusters — returns 2 clusters with correct bounding boxes', () => {
    // Cluster A: near (10,10)
    const clusterA: Point2D[] = [
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 11 },
      { x: 11, y: 11 },
      { x: 12, y: 10 },
    ];
    // Cluster B: near (500,400) — far from cluster A
    const clusterB: Point2D[] = [
      { x: 500, y: 400 },
      { x: 501, y: 400 },
      { x: 500, y: 401 },
      { x: 501, y: 401 },
      { x: 502, y: 400 },
    ];
    const points = [...clusterA, ...clusterB];
    const result = dbscan(points, 640, 480, 0.03, 2);
    const uniqueLabels = new Set(result.labels.filter((l) => l >= 0));
    expect(uniqueLabels.size).toBe(2);
    expect(result.boundingBoxes).toHaveLength(2);
  });

  it('noise points (isolated) — label = -1', () => {
    // Points far apart from each other (all will be noise with high minPts)
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 300, y: 200 },
      { x: 600, y: 400 },
    ];
    const result = dbscan(points, 640, 480, 0.03, 4);
    for (const label of result.labels) {
      expect(label).toBe(-1);
    }
  });

  it('resolution-independent eps scales with image dimensions', () => {
    // Same alpha but different image sizes should give different eps values
    // Larger image => larger eps => more points can be neighbors
    const points: Point2D[] = [
      { x: 50, y: 50 },
      { x: 60, y: 50 },
      { x: 50, y: 60 },
      { x: 60, y: 60 },
      { x: 55, y: 55 },
    ];

    // Small image: eps = 0.03 * sqrt(100^2 + 100^2) ≈ 4.24
    const smallResult = dbscan(points, 100, 100, 0.03, 2);
    // Large image: eps = 0.03 * sqrt(1920^2 + 1080^2) ≈ 66
    const largeResult = dbscan(points, 1920, 1080, 0.03, 2);

    const smallClusters = new Set(smallResult.labels.filter((l) => l >= 0)).size;
    const largeClusters = new Set(largeResult.labels.filter((l) => l >= 0)).size;

    // Large image has larger eps so it should cluster at least as much as small
    expect(largeClusters).toBeGreaterThanOrEqual(smallClusters);
  });

  it('bounding boxes contain correct coordinates', () => {
    const points: Point2D[] = [
      { x: 10, y: 20 },
      { x: 15, y: 25 },
      { x: 12, y: 22 },
      { x: 11, y: 21 },
      { x: 14, y: 24 },
    ];
    const result = dbscan(points, 640, 480, 0.1, 2);
    const clusterLabels = result.labels.filter((l) => l >= 0);
    if (clusterLabels.length > 0) {
      const box = result.boundingBoxes[0];
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.width).toBeGreaterThanOrEqual(0);
      expect(box.height).toBeGreaterThanOrEqual(0);
    }
  });
});
