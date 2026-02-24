import { createRequire } from 'node:module';

import sharp from 'sharp';

import {
  ANIMATION_FRAME_THRESHOLD,
  DECAY_LAMBDA,
  IOU_THRESHOLD,
  MATCH_DISTANCE_THRESHOLD,
  OPENCV_BATCH_SIZE,
} from '../constants.js';
import type {
  BoundingBox,
  FrameNode,
  ProcessContext,
  ScoreEdge,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

import { dbscan } from './dbscan.js';
import type { Point2D } from './dbscan.js';

// ── OpenCV WASM Initialization (lazy) ──

type CvLib = typeof import('@techstark/opencv-js');

const OPENCV_INIT_TIMEOUT_MS = 30_000;

// createRequire를 사용하여 Node CJS 로더로 직접 로드.
// dynamic import()는 Vite 변환 파이프라인을 거치는데,
// opencv-js(10MB+ Emscripten 모듈)를 변환하다 hang이 발생한다.
const require = createRequire(import.meta.url);

let cvReady: Promise<CvLib> | null = null;

async function ensureOpenCV(): Promise<CvLib> {
  if (!cvReady) {
    cvReady = (async () => {
      const cvObj = require('@techstark/opencv-js') as CvLib;

      // @techstark/opencv-js Module에는 .then() 메서드가 있어 thenable로 인식됨.
      // Promise.resolve()나 resolve()에 전달하면 Promise 스펙이 .then()을 반복 호출하여
      // 무한 루프가 발생하므로 제거한다.
      delete (cvObj as Record<string, unknown>).then;

      if (cvObj.Mat) return cvObj;

      return new Promise<CvLib>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('OpenCV WASM initialization timed out after 30s'));
        }, OPENCV_INIT_TIMEOUT_MS);

        cvObj.onRuntimeInitialized = () => {
          clearTimeout(timeout);
          resolve(cvObj);
        };
      });
    })();
  }
  return cvReady;
}

// ── Sharp Preprocessing ──

export async function preprocessFrame(
  framePath: string,
  scale: number,
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp(framePath)
    .resize({ width: scale, withoutEnlargement: true })
    .grayscale()
    .blur(1.0)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data.buffer),
    width: info.width,
    height: info.height,
  };
}

// ── IoU Utilities ──

export function computeIoU(a: BoundingBox, b: BoundingBox): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.width, b.x + b.width);
  const iy2 = Math.min(a.y + a.height, b.y + b.height);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;

  if (intersection === 0) return 0;

  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  const union = aArea + bArea - intersection;

  return union === 0 ? 0 : intersection / union;
}

// ── Spatio-temporal IoU Tracking ──

interface TrackedRegion {
  box: BoundingBox;
  consecutiveCount: number;
  lastSeen: number;
  weight: number;
}

export class IoUTracker {
  private regions: TrackedRegion[] = [];

  update(boxes: BoundingBox[], pairIndex: number): Set<number> {
    const animationIndices = new Set<number>();
    const matched = new Set<number>();

    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      let bestIoU = 0;
      let bestRegionIdx = -1;

      for (let ri = 0; ri < this.regions.length; ri++) {
        if (matched.has(ri)) continue;
        const iou = computeIoU(box, this.regions[ri].box);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestRegionIdx = ri;
        }
      }

      if (bestIoU > IOU_THRESHOLD && bestRegionIdx !== -1) {
        const region = this.regions[bestRegionIdx];
        const gap = pairIndex - region.lastSeen;
        region.box = box;
        region.consecutiveCount++;
        region.lastSeen = pairIndex;
        region.weight *= Math.pow(DECAY_LAMBDA, gap);
        matched.add(bestRegionIdx);

        if (region.consecutiveCount >= ANIMATION_FRAME_THRESHOLD) {
          animationIndices.add(bi);
        }
      } else {
        this.regions.push({
          box,
          consecutiveCount: 1,
          lastSeen: pairIndex,
          weight: 1.0,
        });
      }
    }

    for (let ri = 0; ri < this.regions.length; ri++) {
      if (!matched.has(ri)) {
        const gap = pairIndex - this.regions[ri].lastSeen;
        this.regions[ri].weight *= Math.pow(DECAY_LAMBDA, gap);
      }
    }

    this.regions = this.regions.filter((r) => r.weight > 0.01);

    return animationIndices;
  }

  getAnimationWeight(boxIndex: number, boxes: BoundingBox[]): number {
    if (boxIndex >= boxes.length) return 0;
    const box = boxes[boxIndex];
    let maxWeight = 0;
    for (const region of this.regions) {
      if (region.consecutiveCount >= ANIMATION_FRAME_THRESHOLD) {
        const iou = computeIoU(box, region.box);
        if (iou > IOU_THRESHOLD) {
          maxWeight = Math.max(maxWeight, region.weight);
        }
      }
    }
    return maxWeight;
  }
}

// ── Stage 1: AKAZE Feature Set Difference ──

export interface AKAZEResult {
  sNew: Point2D[];
  sLoss: Point2D[];
}

async function computeAKAZEDiff(
  cvLib: CvLib,
  frame1: { data: Uint8Array; width: number; height: number },
  frame2: { data: Uint8Array; width: number; height: number },
): Promise<AKAZEResult> {
  const mat1 = cvLib.matFromImageData({
    data: frame1.data,
    width: frame1.width,
    height: frame1.height,
  });
  const mat2 = cvLib.matFromImageData({
    data: frame2.data,
    width: frame2.width,
    height: frame2.height,
  });

  const kp1 = new cvLib.KeyPointVector();
  const kp2 = new cvLib.KeyPointVector();
  const desc1 = new cvLib.Mat();
  const desc2 = new cvLib.Mat();
  const mask1 = new cvLib.Mat();
  const mask2 = new cvLib.Mat();
  const akaze = new cvLib.AKAZE();
  let matches: InstanceType<typeof cvLib.DMatchVectorVector> | null = null;

  try {
    akaze.detectAndCompute(mat1, mask1, kp1, desc1);
    akaze.detectAndCompute(mat2, mask2, kp2, desc2);

    const matchedKp1Indices = new Set<number>();
    const matchedKp2Indices = new Set<number>();

    if (desc1.rows > 0 && desc2.rows > 0) {
      const matcher = new cvLib.BFMatcher(cvLib.NORM_HAMMING, false);
      try {
        matches = new cvLib.DMatchVectorVector();
        matcher.knnMatch(desc1, desc2, matches, 2);

        for (let i = 0; i < matches.size(); i++) {
          const pair = matches.get(i);
          if (pair.size() < 2) continue;
          const m0 = pair.get(0);
          const m1 = pair.get(1);
          if (m0.distance < MATCH_DISTANCE_THRESHOLD * m1.distance) {
            matchedKp1Indices.add(m0.queryIdx);
            matchedKp2Indices.add(m0.trainIdx);
          }
        }
      } finally {
        matcher.delete();
      }
    }

    const sNew: Point2D[] = [];
    for (let i = 0; i < kp2.size(); i++) {
      if (!matchedKp2Indices.has(i)) {
        const pt = kp2.get(i).pt;
        sNew.push({ x: pt.x, y: pt.y });
      }
    }

    const sLoss: Point2D[] = [];
    for (let i = 0; i < kp1.size(); i++) {
      if (!matchedKp1Indices.has(i)) {
        const pt = kp1.get(i).pt;
        sLoss.push({ x: pt.x, y: pt.y });
      }
    }

    return { sNew, sLoss };
  } finally {
    mat1.delete();
    mat2.delete();
    kp1.delete();
    kp2.delete();
    desc1.delete();
    desc2.delete();
    mask1.delete();
    mask2.delete();
    akaze.delete();
    if (matches) matches.delete();
  }
}

// ── Stage 4: G(t) Information Gain Scoring ──

export function computeInformationGain(
  clusters: BoundingBox[],
  clusterPoints: number[],
  imageArea: number,
  animationIndices: Set<number>,
  animationWeights: number[],
): number {
  if (clusters.length === 0) return 0;

  let gain = 0;

  for (let i = 0; i < clusters.length; i++) {
    const box = clusters[i];
    const clusterArea = box.width * box.height;
    if (clusterArea <= 0) continue;

    const normalizedArea = clusterArea / imageArea;
    const featureDensity = clusterPoints[i] / clusterArea;
    let contribution = normalizedArea * featureDensity;

    if (animationIndices.has(i)) {
      const animWeight = animationWeights[i] ?? 0;
      contribution *= 1 - animWeight;
    }

    gain += contribution;
  }

  return gain;
}

// ── Batch Analysis ──

async function analyzeBatch(
  cvLib: CvLib,
  frames: FrameNode[],
  scale: number,
  tracker: IoUTracker,
  pairOffset: number,
): Promise<ScoreEdge[]> {
  const edges: ScoreEdge[] = [];

  const preprocessed = await Promise.all(
    frames.map((f) => preprocessFrame(f.extractPath, scale)),
  );

  const imageWidth = preprocessed[0]?.width ?? scale;
  const imageHeight = preprocessed[0]?.height ?? Math.round((scale * 9) / 16);
  const imageArea = imageWidth * imageHeight;

  for (let i = 0; i < frames.length - 1; i++) {
    const pairIndex = pairOffset + i;

    try {
      const { sNew } = await computeAKAZEDiff(
        cvLib,
        preprocessed[i]!,
        preprocessed[i + 1]!,
      );

      const dbscanResult = dbscan(sNew, imageWidth, imageHeight);
      const clusters = dbscanResult.boundingBoxes;

      const clusterPointCounts = new Array<number>(clusters.length).fill(0);
      for (const label of dbscanResult.labels) {
        if (label >= 0) {
          clusterPointCounts[label]++;
        }
      }

      const animationIndices = tracker.update(clusters, pairIndex);
      const animationWeights = clusters.map((_, ci) =>
        animationIndices.has(ci) ? tracker.getAnimationWeight(ci, clusters) : 0,
      );

      const score = computeInformationGain(
        clusters,
        clusterPointCounts,
        imageArea,
        animationIndices,
        animationWeights,
      );

      edges.push({
        sourceId: frames[i]!.id,
        targetId: frames[i + 1]!.id,
        score,
      });
    } catch (err) {
      logger.debug(`Frame pair analysis failed: ${String(err)}`);
      edges.push({
        sourceId: frames[i]!.id,
        targetId: frames[i + 1]!.id,
        score: 0,
      });
    }
  }

  return edges;
}

// ── Public API ──

/**
 * Analyze adjacent frame pairs to compute information gain scores (G(t)).
 * Processes frames in batches for memory efficiency.
 *
 * Pipeline:
 * 1. AKAZE Feature Set Difference
 * 2. DBSCAN Spatial Clustering
 * 3. Spatio-temporal IoU Tracking
 * 4. G(t) Information Gain Scoring
 */
export async function analyzeFrames(ctx: ProcessContext): Promise<ScoreEdge[]> {
  const { frames } = ctx;
  if (frames.length < 2) return [];

  logger.debug(
    `Analyzing ${frames.length} frames in batches of ${OPENCV_BATCH_SIZE}`,
  );

  const cvLib = await ensureOpenCV();
  const edges: ScoreEdge[] = [];
  const tracker = new IoUTracker();
  const scale = ctx.options.scale;

  for (let i = 0; i < frames.length - 1; i += OPENCV_BATCH_SIZE) {
    const batchEnd = Math.min(i + OPENCV_BATCH_SIZE + 1, frames.length);
    const batch = frames.slice(i, batchEnd);
    const batchEdges = await analyzeBatch(cvLib, batch, scale, tracker, i);
    edges.push(...batchEdges);

    const progress = Math.min(
      100,
      ((i + OPENCV_BATCH_SIZE) / (frames.length - 1)) * 100,
    );
    ctx.emitProgress(progress);
  }

  logger.debug(`Computed ${edges.length} score edges`);
  return edges;
}
