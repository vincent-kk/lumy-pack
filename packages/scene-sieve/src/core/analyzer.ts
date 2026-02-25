import { createRequire } from 'node:module';

import sharp from 'sharp';

import {
  ANIMATION_FRAME_THRESHOLD,
  DECAY_LAMBDA,
  DEFAULT_FPS,
  IOU_THRESHOLD,
  MATCH_DISTANCE_THRESHOLD,
  OPENCV_BATCH_SIZE,
  PIXELDIFF_BINARY_THRESHOLD,
  PIXELDIFF_CONTOUR_MIN_AREA,
  PIXELDIFF_GAUSSIAN_KERNEL,
  PIXELDIFF_SAMPLE_SPACING,
} from '../constants.js';
import type {
  AnalysisResult,
  AnimationMetadata,
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

/**
 * imgproc API subset used by computePixelDiff.
 *
 * @techstark/opencv-js declares these in individual .d.ts files
 * (core_array, imgproc_filter, imgproc_misc, imgproc_shape, _hacks),
 * but TypeScript's `typeof import(...)` fails to resolve them through
 * the deep barrel re-export chain. This interface provides explicit
 * type coverage so we avoid `as any`.
 */
interface CvImgProc {
  Mat: {
    new (): CvMat;
    new (rows: number, cols: number, type: number): CvMat;
  };
  MatVector: {
    new (): CvMatVector;
  };
  Size: {
    new (width: number, height: number): { width: number; height: number };
  };
  CV_8UC1: number;
  THRESH_BINARY: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  absdiff(src1: CvMat, src2: CvMat, dst: CvMat): void;
  GaussianBlur(
    src: CvMat,
    dst: CvMat,
    ksize: { width: number; height: number },
    sigmaX: number,
  ): void;
  threshold(
    src: CvMat,
    dst: CvMat,
    thresh: number,
    maxval: number,
    type: number,
  ): number;
  findContours(
    image: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number,
  ): void;
  boundingRect(array: CvMat): {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface CvMat {
  data: Uint8Array;
  rows: number;
  cols: number;
  delete(): void;
}

interface CvMatVector {
  size(): number;
  get(i: number): CvMat;
  delete(): void;
}

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
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
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
  firstSeen: number;
  lastSeen: number;
  weight: number;
}

export class IoUTracker {
  private regions: TrackedRegion[] = [];
  private extractedAnimations: AnimationMetadata[] = [];

  constructor(
    private fps: number = DEFAULT_FPS,
    private iouThreshold: number = IOU_THRESHOLD,
    private animationThreshold: number = ANIMATION_FRAME_THRESHOLD,
  ) {}

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

      if (bestIoU > this.iouThreshold && bestRegionIdx !== -1) {
        const region = this.regions[bestRegionIdx];
        const gap = pairIndex - region.lastSeen;
        region.box = box;
        region.consecutiveCount++;
        region.lastSeen = pairIndex;
        region.weight *= Math.pow(DECAY_LAMBDA, gap);
        matched.add(bestRegionIdx);

        if (region.consecutiveCount >= this.animationThreshold) {
          animationIndices.add(bi);
        }
      } else {
        this.regions.push({
          box,
          consecutiveCount: 1,
          firstSeen: pairIndex,
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

    // 애니메이션 데이터 수집 (소멸되는 영역 중 조건 만족하는 것)
    for (let i = 0; i < this.regions.length; i++) {
      const region = this.regions[i];
      if (region.weight <= 0.01 && !matched.has(i)) {
        this.collectAnimation(region);
      }
    }

    this.regions = this.regions.filter(
      (r, i) => r.weight > 0.01 || matched.has(i),
    );

    return animationIndices;
  }

  private collectAnimation(region: TrackedRegion): void {
    if (region.consecutiveCount >= this.animationThreshold) {
      const durationMs = (region.consecutiveCount / this.fps) * 1000;
      this.extractedAnimations.push({
        type: 'loading_spinner', // 기본값으로 loading_spinner 사용
        boundingBox: region.box,
        startFrameId: region.firstSeen,
        endFrameId: region.lastSeen,
        durationMs,
      });
    }
  }

  flushAndGetAnimations(): AnimationMetadata[] {
    // 큐에 남아있는 모든 영역에 대해 애니메이션 수집 시도
    for (const region of this.regions) {
      this.collectAnimation(region);
    }
    this.regions = [];
    return this.extractedAnimations;
  }

  getAnimationWeight(boxIndex: number, boxes: BoundingBox[]): number {
    if (boxIndex >= boxes.length) return 0;
    const box = boxes[boxIndex];
    let maxWeight = 0;
    for (const region of this.regions) {
      if (region.consecutiveCount >= this.animationThreshold) {
        const iou = computeIoU(box, region.box);
        if (iou > this.iouThreshold) {
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
  const cv = cvLib as unknown as CvImgProc;
  const mat1 = new cv.Mat(frame1.height, frame1.width, cv.CV_8UC1);
  mat1.data.set(frame1.data);
  const mat2 = new cv.Mat(frame2.height, frame2.width, cv.CV_8UC1);
  mat2.data.set(frame2.data);

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

// ── Stage 1b: Pixel-Diff Fallback ──

/**
 * Pixel-level difference fallback for AKAZE blind spots.
 *
 * When AKAZE produces sparse results (typical for UI screen recordings
 * where form fields, dropdowns, or overlays change), this function
 * detects changed regions via cv.absdiff and generates synthetic
 * Point2D[] that feed into the existing DBSCAN → IoU → G(t) pipeline.
 *
 * Algorithm:
 * 1. absdiff(frame1, frame2) → grayscale difference
 * 2. GaussianBlur → reduce JPEG compression noise
 * 3. threshold → binary mask of significant changes
 * 4. findContours → bounding rects of changed regions
 * 5. Grid sampling within each bounding rect → Point2D[]
 */
export function computePixelDiff(
  cvLib: CvLib,
  frame1: { data: Uint8Array; width: number; height: number },
  frame2: { data: Uint8Array; width: number; height: number },
): Point2D[] {
  const cv = cvLib as unknown as CvImgProc;

  const mat1 = new cv.Mat(frame1.height, frame1.width, cv.CV_8UC1);
  const mat2 = new cv.Mat(frame2.height, frame2.width, cv.CV_8UC1);
  const diff = new cv.Mat();
  const blurred = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    mat1.data.set(frame1.data);
    mat2.data.set(frame2.data);

    cv.absdiff(mat1, mat2, diff);

    const ksize = new cv.Size(
      PIXELDIFF_GAUSSIAN_KERNEL,
      PIXELDIFF_GAUSSIAN_KERNEL,
    );
    cv.GaussianBlur(diff, blurred, ksize, 0);

    cv.threshold(
      blurred,
      binary,
      PIXELDIFF_BINARY_THRESHOLD,
      255,
      cv.THRESH_BINARY,
    );

    cv.findContours(
      binary,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );

    const points: Point2D[] = [];
    for (let c = 0; c < contours.size(); c++) {
      const contour = contours.get(c);
      const rect = cv.boundingRect(contour);

      if (rect.width * rect.height < PIXELDIFF_CONTOUR_MIN_AREA) continue;

      for (
        let y = rect.y;
        y < rect.y + rect.height;
        y += PIXELDIFF_SAMPLE_SPACING
      ) {
        for (
          let x = rect.x;
          x < rect.x + rect.width;
          x += PIXELDIFF_SAMPLE_SPACING
        ) {
          points.push({ x, y });
        }
      }
    }

    return points;
  } finally {
    mat1.delete();
    mat2.delete();
    diff.delete();
    blurred.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
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

      let dbscanResult = dbscan(sNew, imageWidth, imageHeight);
      let clusters = dbscanResult.boundingBoxes;

      // Pixel-diff fallback: when AKAZE → DBSCAN produces no clusters,
      // try pixel-level difference to catch UI changes AKAZE misses
      // (dropdowns, form fields, overlays on low-texture backgrounds).
      if (clusters.length === 0) {
        const pixelDiffPoints = computePixelDiff(
          cvLib,
          preprocessed[i]!,
          preprocessed[i + 1]!,
        );

        if (pixelDiffPoints.length > 0) {
          logger.debug(
            `Edge ${frames[i]!.id}->${frames[i + 1]!.id}: pixel-diff fallback (${pixelDiffPoints.length} points)`,
          );
          // minPts=2 for grid-sampled points (default MIN_PTS=4 is too strict for sparse grids)
          dbscanResult = dbscan(
            pixelDiffPoints,
            imageWidth,
            imageHeight,
            undefined,
            2,
          );
          clusters = dbscanResult.boundingBoxes;
        }
      }

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

      logger.debug(
        `Edge ${frames[i]!.id}->${frames[i + 1]!.id} G(t)=${score.toFixed(6)}`,
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
export async function analyzeFrames(
  ctx: ProcessContext,
): Promise<AnalysisResult> {
  const { frames } = ctx;
  if (frames.length < 2) return { edges: [], animations: [] };

  logger.debug(
    `Analyzing ${frames.length} frames in batches of ${OPENCV_BATCH_SIZE}`,
  );

  const cvLib = await ensureOpenCV();
  const edges: ScoreEdge[] = [];
  const tracker = new IoUTracker(
    ctx.options.fps,
    ctx.options.iouThreshold,
    ctx.options.animationThreshold,
  );
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

  const animations = tracker.flushAndGetAnimations();
  logger.debug(
    `Computed ${edges.length} score edges and ${animations.length} animations`,
  );
  return { edges, animations };
}
