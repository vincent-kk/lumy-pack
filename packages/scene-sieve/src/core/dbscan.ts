import type { BoundingBox, DBSCANResult } from '../types/index.js';
import { DBSCAN_ALPHA, DBSCAN_MIN_PTS } from '../constants.js';

export interface Point2D {
  x: number;
  y: number;
}

const UNVISITED = -2;
const NOISE = -1;

/**
 * DBSCAN clustering with resolution-independent eps.
 * eps = alpha * sqrt(width^2 + height^2)
 */
export function dbscan(
  points: Point2D[],
  imageWidth: number,
  imageHeight: number,
  alpha?: number,
  minPts?: number,
): DBSCANResult {
  if (points.length === 0) {
    return { labels: [], boundingBoxes: [] };
  }

  const eps = (alpha ?? DBSCAN_ALPHA) * Math.sqrt(imageWidth ** 2 + imageHeight ** 2);
  const epsSquared = eps * eps;
  const minPoints = minPts ?? DBSCAN_MIN_PTS;

  const labels = new Array<number>(points.length).fill(UNVISITED);
  let clusterId = 0;

  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== UNVISITED) continue;

    const neighbors = findNeighbors(points, i, epsSquared);

    if (neighbors.length < minPoints) {
      labels[i] = NOISE;
      continue;
    }

    // Start a new cluster
    labels[i] = clusterId;
    const seeds = [...neighbors];
    const seedSet = new Set(seeds);

    for (let si = 0; si < seeds.length; si++) {
      const q = seeds[si];

      if (labels[q] === NOISE) {
        labels[q] = clusterId;
      }

      if (labels[q] !== UNVISITED) continue;

      labels[q] = clusterId;

      const qNeighbors = findNeighbors(points, q, epsSquared);
      if (qNeighbors.length >= minPoints) {
        for (const n of qNeighbors) {
          if (!seedSet.has(n)) {
            seedSet.add(n);
            seeds.push(n);
          }
        }
      }
    }

    clusterId++;
  }

  // Compute bounding boxes for each cluster
  const boundingBoxes: BoundingBox[] = [];

  for (let c = 0; c < clusterId; c++) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      if (labels[i] !== c) continue;
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    boundingBoxes.push({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  }

  return { labels, boundingBoxes };
}

function findNeighbors(points: Point2D[], idx: number, epsSquared: number): number[] {
  const p = points[idx];
  const neighbors: number[] = [];

  for (let i = 0; i < points.length; i++) {
    if (i === idx) continue;
    const q = points[i];
    const distSq = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (distSq <= epsSquared) {
      neighbors.push(i);
    }
  }

  return neighbors;
}
