import type { BFMatcher, DMatchVectorVector } from '@techstark/opencv-js';

import { MATCH_DISTANCE_THRESHOLD } from '../constants/vision-tuning.js';

import type { Point2D } from '../clustering/dbscan.js';
import type { FrameFeatures } from './frame-features.js';

/** Initialized OpenCV runtime supplied by the analyzer. */
type CvLib = typeof import('@techstark/opencv-js');

/**
 * Match prev to next with Hamming k=2, crossCheck=false and strict ratio 0.25.
 * @param cvLib - Initialized OpenCV runtime.
 * @param prev - Previous frame's live features, owned by the caller.
 * @param next - Next frame's live features, owned by the caller.
 * @returns Unmatched next-frame coordinates without changing input ownership.
 * @throws Propagates matching errors after releasing temporary native handles.
 */
export function computeNewPoints(
  cvLib: CvLib,
  prev: FrameFeatures,
  next: FrameFeatures,
): Point2D[] {
  let matcher: BFMatcher | null = null;
  let matches: DMatchVectorVector | null = null;
  try {
    const matchedIndices = new Set<number>();
    if (prev.descriptors.rows > 0 && next.descriptors.rows > 0) {
      try {
        matcher = new cvLib.BFMatcher(cvLib.NORM_HAMMING, false);
        matches = new cvLib.DMatchVectorVector();
        matcher.knnMatch(prev.descriptors, next.descriptors, matches, 2);
        for (let i = 0; i < matches.size(); i++) {
          const pair = matches.get(i);
          try {
            if (pair.size() < 2) continue;
            const best = pair.get(0);
            const second = pair.get(1);
            if (best.distance < MATCH_DISTANCE_THRESHOLD * second.distance) {
              matchedIndices.add(best.trainIdx);
            }
          } finally {
            pair.delete();
          }
        }
      } finally {
        matcher?.delete();
      }
    }

    const points: Point2D[] = [];
    for (let i = 0; i < next.keypoints.size(); i++) {
      if (!matchedIndices.has(i)) {
        const { x, y } = next.keypoints.get(i).pt;
        points.push({ x, y });
      }
    }
    return points;
  } finally {
    matches?.delete();
  }
}
