/**
 * Algorithm Visualization Showcase Generator for scene-sieve
 *
 * Generates step-by-step visualization images of the 4-stage vision analysis pipeline:
 * AKAZE → DBSCAN → IoU Tracking → G(t) Scoring + Pruning
 *
 * Usage:
 *   npx tsx .samples/generate-showcase.ts                     # default samples
 *   npx tsx .samples/generate-showcase.ts path/to/video.mp4   # custom video(s)
 * Output: .samples/algorithm-showcase/
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

import {
  MATCH_DISTANCE_THRESHOLD,
  PIXELDIFF_BINARY_THRESHOLD,
  PIXELDIFF_CONTOUR_MIN_AREA,
  PIXELDIFF_GAUSSIAN_KERNEL,
  PIXELDIFF_SAMPLE_SPACING,
} from '../src/constants.js';
import {
  IoUTracker,
  computeInformationGain,
  computePixelDiff,
  preprocessFrame,
} from '../src/core/analyzer.js';
import { dbscan } from '../src/core/dbscan.js';
import type { Point2D } from '../src/core/dbscan.js';
import { pruneByThresholdWithCap } from '../src/core/pruner.js';
import type {
  BoundingBox,
  DBSCANResult,
  FrameNode,
  ScoreEdge,
} from '../src/types/index.js';
import { normalizeScores } from '../src/utils/math.js';

// ── Types ──

interface AKAZEVisResult {
  sNew: Point2D[];
  sLoss: Point2D[];
  kp1All: Point2D[];
  kp2All: Point2D[];
  matchedPairs: Array<{ pt1: Point2D; pt2: Point2D }>;
}

interface PixelDiffVisResult {
  points: Point2D[];
  absdiffData: Uint8Array;
  blurredData: Uint8Array;
  binaryData: Uint8Array;
  contourRects: Array<{ x: number; y: number; width: number; height: number }>;
  gridPoints: Point2D[];
  width: number;
  height: number;
}

interface PairAnalysis {
  sourceId: number;
  targetId: number;
  sourceFrame: FrameNode;
  targetFrame: FrameNode;
  akazeVis: AKAZEVisResult;
  dbscanResult: DBSCANResult;
  dbscanInput: Point2D[];
  usedPixelDiffFallback: boolean;
  score: number;
  clusters: BoundingBox[];
  clusterPointCounts: number[];
}

interface VideoShowcaseData {
  name: string;
  frames: FrameNode[];
  framesDir: string;
  pairs: PairAnalysis[];
  edges: ScoreEdge[];
  survivingIds: Set<number>;
}

// ── Constants ──

const ANALYSIS_SCALE = 1920;
const EXTRACT_FPS = 3;
const THUMB_W = 640;
const THUMB_H = 360;
const CHART_W = 1920;
const CHART_H = 800;
const THRESHOLD = 0.5;
const MAX_COUNT = 20;

const CLUSTER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
];

// ── OpenCV Initialization ──

type CvLib = typeof import('@techstark/opencv-js');

const require = createRequire(import.meta.url);
let cvReady: Promise<CvLib> | null = null;

async function ensureOpenCV(): Promise<CvLib> {
  if (!cvReady) {
    cvReady = (async () => {
      const cvObj = require('@techstark/opencv-js') as CvLib;
      delete (cvObj as Record<string, unknown>).then;
      if (cvObj.Mat) return cvObj;
      return new Promise<CvLib>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('OpenCV init timeout')),
          30_000,
        );
        cvObj.onRuntimeInitialized = () => {
          clearTimeout(timeout);
          resolve(cvObj);
        };
      });
    })();
  }
  return cvReady;
}

// ── Utility Functions ──

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function saveGrayPng(
  data: Uint8Array,
  width: number,
  height: number,
  outputPath: string,
): Promise<void> {
  await sharp(Buffer.from(data), { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
}

function jetColor(v: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 3)));
  const g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 2)));
  const b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 1)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function applyJetColormap(gray: Uint8Array): Uint8Array {
  const rgb = new Uint8Array(gray.length * 3);
  for (let i = 0; i < gray.length; i++) {
    const [r, g, b] = jetColor(gray[i]! / 255);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return rgb;
}

function scoreToColor(score: number, max = 1): string {
  const t = Math.min(1, score / max);
  if (t < 0.5) {
    const f = t * 2;
    const r = Math.round(78 + f * (240 - 78));
    const g = Math.round(205 - f * (205 - 147));
    const b = Math.round(196 - f * (196 - 43));
    return `rgb(${r},${g},${b})`;
  }
  const f = (t - 0.5) * 2;
  const r = Math.round(240 - f * (240 - 235));
  const g = Math.round(147 - f * (147 - 77));
  const b = Math.round(43 - f * 43);
  return `rgb(${r},${g},${b})`;
}

function circlesSvg(
  points: Point2D[],
  color: string,
  radius: number,
  w: number,
  h: number,
  opacity = 0.8,
): string {
  const circles = points
    .map(
      (p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius}" fill="none" stroke="${color}" stroke-width="2.5" opacity="${opacity}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${circles}</svg>`;
}

function rectsSvg(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
  colors: string[],
  labels: string[],
  w: number,
  h: number,
): string {
  const elems = rects
    .map((r, i) => {
      const c = colors[i % colors.length]!;
      return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="${c}" stroke-width="3"/>
<text x="${r.x + 2}" y="${r.y - 6}" fill="${c}" font-size="16" font-family="monospace">${labels[i] ?? ''}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${elems}</svg>`;
}

async function overlayOnFrame(
  framePath: string,
  svgOverlay: string,
  outputPath: string,
  scale: number,
): Promise<void> {
  await sharp(framePath)
    .resize({ width: scale, withoutEnlargement: true })
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toFile(outputPath);
}

async function createMontage(
  imagePaths: string[],
  cols: number,
  thumbW: number,
  thumbH: number,
  outputPath: string,
  labels?: string[],
): Promise<void> {
  if (imagePaths.length === 0) return;
  const rows = Math.ceil(imagePaths.length / cols);
  const totalW = cols * thumbW;
  const totalH = rows * thumbH;

  const composites: sharp.OverlayOptions[] = [];
  for (let idx = 0; idx < imagePaths.length; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    composites.push({
      input: await sharp(imagePaths[idx]!)
        .resize(thumbW, thumbH, { fit: 'inside', background: { r: 18, g: 18, b: 30 } })
        .png()
        .toBuffer(),
      left: col * thumbW,
      top: row * thumbH,
    });
  }

  if (labels && labels.length > 0) {
    const labelElems = labels
      .map((label, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = col * thumbW + 4;
        const y = row * thumbH + thumbH - 8;
        return `<rect x="${x - 2}" y="${y - 18}" width="${Math.min(label.length * 10 + 8, thumbW - 4)}" height="22" rx="2" fill="rgba(0,0,0,0.7)"/>
<text x="${x}" y="${y}" fill="#fff" font-size="16" font-family="monospace">${label}</text>`;
      })
      .join('');
    const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">${labelElems}</svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: 0, left: 0 });
  }

  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 3,
      background: { r: 18, g: 18, b: 30 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

function generateBarChartSVG(
  data: Array<{ label: string; value: number; color?: string }>,
  opts: {
    width: number;
    height: number;
    title?: string;
    thresholdLine?: number;
    thresholdLabel?: string;
    highlightIndices?: Set<number>;
  },
): string {
  const {
    width,
    height,
    title,
    thresholdLine,
    thresholdLabel,
    highlightIndices,
  } = opts;
  const m = { top: 40, right: 30, bottom: 50, left: 60 };
  const cW = width - m.left - m.right;
  const cH = height - m.top - m.bottom;
  const maxVal =
    Math.max(...data.map((d) => d.value), thresholdLine ?? 0) * 1.15 || 1;
  const barW = Math.max(2, cW / data.length - 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#1a1a2e"/>`;

  if (title) {
    svg += `<text x="${width / 2}" y="28" text-anchor="middle" fill="#e0e0e0" font-size="15" font-family="monospace">${title}</text>`;
  }

  // Y-axis grid lines
  for (let i = 0; i <= 4; i++) {
    const y = m.top + (cH * i) / 4;
    const val = (maxVal * (4 - i)) / 4;
    svg += `<line x1="${m.left}" y1="${y}" x2="${width - m.right}" y2="${y}" stroke="#333" stroke-width="0.5"/>`;
    svg += `<text x="${m.left - 8}" y="${y + 4}" text-anchor="end" fill="#888" font-size="9" font-family="monospace">${val.toFixed(3)}</text>`;
  }

  // Bars
  for (let i = 0; i < data.length; i++) {
    const x = m.left + i * (cW / data.length);
    const barH = (data[i]!.value / maxVal) * cH;
    const y = m.top + cH - barH;
    const color = data[i]!.color ?? scoreToColor(data[i]!.value, maxVal);
    const highlighted = highlightIndices?.has(i);
    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" opacity="${highlighted ? 1 : 0.7}"/>`;
    if (highlighted) {
      svg += `<rect x="${x - 1}" y="${y - 1}" width="${barW + 2}" height="${barH + 2}" fill="none" stroke="#fff" stroke-width="1.5"/>`;
    }
  }

  // Threshold line
  if (thresholdLine !== undefined) {
    const y = m.top + cH - (thresholdLine / maxVal) * cH;
    svg += `<line x1="${m.left}" y1="${y}" x2="${width - m.right}" y2="${y}" stroke="#ff6b6b" stroke-width="2" stroke-dasharray="6,3"/>`;
    svg += `<text x="${width - m.right + 4}" y="${y + 4}" fill="#ff6b6b" font-size="10" font-family="monospace">${thresholdLabel ?? `t=${thresholdLine}`}</text>`;
  }

  // X-axis labels (sparse)
  const step = Math.max(1, Math.floor(data.length / 15));
  for (let i = 0; i < data.length; i += step) {
    const x = m.left + i * (cW / data.length) + barW / 2;
    svg += `<text x="${x}" y="${m.top + cH + 18}" text-anchor="middle" fill="#888" font-size="8" font-family="monospace">${data[i]!.label}</text>`;
  }

  svg += '</svg>';
  return svg;
}

async function svgToPng(svgStr: string, outputPath: string): Promise<void> {
  await sharp(Buffer.from(svgStr)).png().toFile(outputPath);
}

// ── AKAZE Visualization (reimplemented with extended data) ──

async function computeAKAZEDiffVis(
  cvLib: CvLib,
  frame1: { data: Uint8Array; width: number; height: number },
  frame2: { data: Uint8Array; width: number; height: number },
): Promise<AKAZEVisResult> {
  const cv = cvLib as any;
  const mat1 = new cv.Mat(frame1.height, frame1.width, cv.CV_8UC1);
  mat1.data.set(frame1.data);
  const mat2 = new cv.Mat(frame2.height, frame2.width, cv.CV_8UC1);
  mat2.data.set(frame2.data);

  const kp1 = new cv.KeyPointVector();
  const kp2 = new cv.KeyPointVector();
  const desc1 = new cv.Mat();
  const desc2 = new cv.Mat();
  const mask1 = new cv.Mat();
  const mask2 = new cv.Mat();
  const akaze = new cv.AKAZE();
  let matches: any = null;

  try {
    akaze.detectAndCompute(mat1, mask1, kp1, desc1);
    akaze.detectAndCompute(mat2, mask2, kp2, desc2);

    const kp1All: Point2D[] = [];
    for (let i = 0; i < kp1.size(); i++) {
      const pt = kp1.get(i).pt;
      kp1All.push({ x: pt.x, y: pt.y });
    }
    const kp2All: Point2D[] = [];
    for (let i = 0; i < kp2.size(); i++) {
      const pt = kp2.get(i).pt;
      kp2All.push({ x: pt.x, y: pt.y });
    }

    const matchedKp1Indices = new Set<number>();
    const matchedKp2Indices = new Set<number>();
    const matchedPairs: Array<{ pt1: Point2D; pt2: Point2D }> = [];

    if (desc1.rows > 0 && desc2.rows > 0) {
      const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
      try {
        matches = new cv.DMatchVectorVector();
        matcher.knnMatch(desc1, desc2, matches, 2);
        for (let i = 0; i < matches.size(); i++) {
          const pair = matches.get(i);
          if (pair.size() < 2) continue;
          const m0 = pair.get(0);
          const m1 = pair.get(1);
          if (m0.distance < MATCH_DISTANCE_THRESHOLD * m1.distance) {
            matchedKp1Indices.add(m0.queryIdx);
            matchedKp2Indices.add(m0.trainIdx);
            matchedPairs.push({
              pt1: kp1All[m0.queryIdx]!,
              pt2: kp2All[m0.trainIdx]!,
            });
          }
        }
      } finally {
        matcher.delete();
      }
    }

    const sNew = kp2All.filter((_, i) => !matchedKp2Indices.has(i));
    const sLoss = kp1All.filter((_, i) => !matchedKp1Indices.has(i));

    return { sNew, sLoss, kp1All, kp2All, matchedPairs };
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

// ── Pixel-Diff Visualization (captures intermediates) ──

function computePixelDiffVis(
  cvLib: CvLib,
  frame1: { data: Uint8Array; width: number; height: number },
  frame2: { data: Uint8Array; width: number; height: number },
): PixelDiffVisResult {
  const cv = cvLib as any;
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
    const absdiffData = new Uint8Array(diff.data);

    const ksize = new cv.Size(
      PIXELDIFF_GAUSSIAN_KERNEL,
      PIXELDIFF_GAUSSIAN_KERNEL,
    );
    cv.GaussianBlur(diff, blurred, ksize, 0);
    const blurredData = new Uint8Array(blurred.data);

    cv.threshold(
      blurred,
      binary,
      PIXELDIFF_BINARY_THRESHOLD,
      255,
      cv.THRESH_BINARY,
    );
    const binaryData = new Uint8Array(binary.data);

    cv.findContours(
      binary,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );

    const contourRects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    const gridPoints: Point2D[] = [];
    const points: Point2D[] = [];

    for (let c = 0; c < contours.size(); c++) {
      const contour = contours.get(c);
      const rect = cv.boundingRect(contour);
      if (rect.width * rect.height < PIXELDIFF_CONTOUR_MIN_AREA) continue;
      contourRects.push(rect);
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
          gridPoints.push({ x, y });
        }
      }
    }

    return {
      points,
      absdiffData,
      blurredData,
      binaryData,
      contourRects,
      gridPoints,
      width: frame1.width,
      height: frame1.height,
    };
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

// ── Frame Extraction ──

async function extractFramesForShowcase(
  inputPath: string,
): Promise<{ frames: FrameNode[]; framesDir: string }> {
  const framesDir = join(tmpdir(), `scene-sieve-showcase-${randomUUID()}`);
  await ensureDir(framesDir);

  await execa(ffmpegPath!, [
    '-i',
    inputPath,
    '-vf',
    `fps=${EXTRACT_FPS},scale=${ANALYSIS_SCALE}:-1`,
    '-q:v',
    '2',
    '-start_number',
    '0',
    join(framesDir, 'frame_%04d.jpg'),
  ]);

  const files = (await readdir(framesDir))
    .filter((f) => f.endsWith('.jpg'))
    .sort();

  const frames: FrameNode[] = files.map((file, i) => ({
    id: i,
    timestamp: i / EXTRACT_FPS,
    extractPath: join(framesDir, file),
  }));

  return { frames, framesDir };
}

// ── Analysis Pipeline with Visualization Data ──

async function runAnalysisWithVis(
  cvLib: CvLib,
  frames: FrameNode[],
): Promise<{ pairs: PairAnalysis[]; edges: ScoreEdge[] }> {
  const pairs: PairAnalysis[] = [];
  const edges: ScoreEdge[] = [];
  const tracker = new IoUTracker();

  const preprocessed = await Promise.all(
    frames.map((f) => preprocessFrame(f.extractPath, ANALYSIS_SCALE)),
  );

  const imageWidth = preprocessed[0]?.width ?? ANALYSIS_SCALE;
  const imageHeight =
    preprocessed[0]?.height ?? Math.round((ANALYSIS_SCALE * 9) / 16);
  const imageArea = imageWidth * imageHeight;

  for (let i = 0; i < frames.length - 1; i++) {
    try {
      const akazeVis = await computeAKAZEDiffVis(
        cvLib,
        preprocessed[i]!,
        preprocessed[i + 1]!,
      );

      let dbscanInput = akazeVis.sNew;
      let dbscanResult = dbscan(dbscanInput, imageWidth, imageHeight);
      let usedPixelDiffFallback = false;

      if (dbscanResult.boundingBoxes.length === 0) {
        const pixelDiffPoints = computePixelDiff(
          cvLib,
          preprocessed[i]!,
          preprocessed[i + 1]!,
        );
        if (pixelDiffPoints.length > 0) {
          dbscanInput = pixelDiffPoints;
          dbscanResult = dbscan(
            pixelDiffPoints,
            imageWidth,
            imageHeight,
            undefined,
            2,
          );
          usedPixelDiffFallback = true;
        }
      }

      const clusters = dbscanResult.boundingBoxes;
      const clusterPointCounts = new Array<number>(clusters.length).fill(0);
      for (const label of dbscanResult.labels) {
        if (label >= 0) clusterPointCounts[label]!++;
      }

      const animationIndices = tracker.update(clusters, i);
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

      pairs.push({
        sourceId: frames[i]!.id,
        targetId: frames[i + 1]!.id,
        sourceFrame: frames[i]!,
        targetFrame: frames[i + 1]!,
        akazeVis,
        dbscanResult,
        dbscanInput,
        usedPixelDiffFallback,
        score,
        clusters,
        clusterPointCounts,
      });
    } catch {
      edges.push({
        sourceId: frames[i]!.id,
        targetId: frames[i + 1]!.id,
        score: 0,
      });
    }
  }

  return { pairs, edges };
}

// ── Representative Pair Selection ──

function selectRepresentativePairs(pairs: PairAnalysis[]): PairAnalysis[] {
  if (pairs.length === 0) return [];
  const sorted = [...pairs].sort((a, b) => b.score - a.score);
  const result: PairAnalysis[] = [];

  // High-change pair
  result.push(sorted[0]!);

  // Low-change pair (lowest score > 0)
  const low = [...sorted].reverse().find((p) => p.score > 0 && p !== sorted[0]);
  if (low) result.push(low);

  // Pixel-diff fallback pair (if any)
  const fallback = pairs.find(
    (p) => p.usedPixelDiffFallback && !result.includes(p),
  );
  if (fallback) {
    result.push(fallback);
  } else {
    // Medium-change pair
    const mid = sorted[Math.floor(sorted.length / 2)];
    if (mid && !result.includes(mid)) result.push(mid);
  }

  return result;
}

// ── Stage 0: Frame Extraction & Strip ──

async function generateStage0(
  frames: FrameNode[],
  outputDir: string,
): Promise<void> {
  const stageDir = join(outputDir, '00-extraction');
  await ensureDir(stageDir);

  const labels = frames.map((f) => `#${f.id} ${f.timestamp.toFixed(1)}s`);

  const cols = Math.min(frames.length, 3);
  await createMontage(
    frames.map((f) => f.extractPath),
    cols,
    THUMB_W,
    THUMB_H,
    join(stageDir, 'frame-strip.png'),
    labels,
  );

  console.log(`  Stage 0: ${frames.length} frames → frame-strip.png`);
}

// ── Stage 1: AKAZE Feature Detection ──

async function generateStage1(
  repPairs: PairAnalysis[],
  outputDir: string,
  scale: number,
): Promise<void> {
  const stageDir = join(outputDir, '01-akaze');
  await ensureDir(stageDir);

  for (const pair of repPairs) {
    const prefix = `pair-${pair.sourceId}-${pair.targetId}`;
    const { akazeVis, sourceFrame, targetFrame } = pair;
    const frameBuf1 = await sharp(sourceFrame.extractPath)
      .resize({ width: scale, withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(frameBuf1).metadata();
    const w = meta.width!;
    const h = meta.height!;

    // Keypoints frame1
    const kpSvg1 = circlesSvg(akazeVis.kp1All, '#00FF00', 5, w, h, 0.6);
    await overlayOnFrame(
      sourceFrame.extractPath,
      kpSvg1,
      join(stageDir, `${prefix}_keypoints-frame1.png`),
      scale,
    );

    // Keypoints frame2
    const kpSvg2 = circlesSvg(akazeVis.kp2All, '#00FF00', 5, w, h, 0.6);
    await overlayOnFrame(
      targetFrame.extractPath,
      kpSvg2,
      join(stageDir, `${prefix}_keypoints-frame2.png`),
      scale,
    );

    // Matched: side-by-side with lines (each frame 960px → total 1920px)
    const matchW = Math.round(scale / 2);
    const matchBuf1 = await sharp(sourceFrame.extractPath)
      .resize({ width: matchW, withoutEnlargement: true })
      .png()
      .toBuffer();
    const matchBuf2 = await sharp(targetFrame.extractPath)
      .resize({ width: matchW, withoutEnlargement: true })
      .png()
      .toBuffer();
    const matchMeta = await sharp(matchBuf1).metadata();
    const matchH = matchMeta.height!;
    const scaleRatio = matchW / w;
    const maxLines = 80;
    const mp = akazeVis.matchedPairs;
    const sampledPairs =
      mp.length > maxLines
        ? mp.filter((_, i) => i % Math.ceil(mp.length / maxLines) === 0)
        : mp;
    const lines = sampledPairs
      .map(
        ({ pt1, pt2 }) =>
          `<line x1="${(pt1.x * scaleRatio).toFixed(1)}" y1="${(pt1.y * scaleRatio).toFixed(1)}" x2="${(pt2.x * scaleRatio + matchW).toFixed(1)}" y2="${(pt2.y * scaleRatio).toFixed(1)}" stroke="rgba(0,255,0,0.35)" stroke-width="1.5"/>`,
      )
      .join('');
    const matchSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${matchW * 2}" height="${matchH}">${lines}</svg>`;
    await sharp({
      create: {
        width: matchW * 2,
        height: matchH,
        channels: 3,
        background: { r: 18, g: 18, b: 30 },
      },
    })
      .composite([
        { input: matchBuf1, left: 0, top: 0 },
        { input: matchBuf2, left: matchW, top: 0 },
        { input: Buffer.from(matchSvg), left: 0, top: 0 },
      ])
      .png()
      .toFile(join(stageDir, `${prefix}_matched.png`));

    // sNew on frame2
    const sNewSvg = circlesSvg(akazeVis.sNew, '#FF4444', 7, w, h);
    await overlayOnFrame(
      targetFrame.extractPath,
      sNewSvg,
      join(stageDir, `${prefix}_sNew.png`),
      scale,
    );

    // sLoss on frame1
    const sLossSvg = circlesSvg(akazeVis.sLoss, '#4488FF', 7, w, h);
    await overlayOnFrame(
      sourceFrame.extractPath,
      sLossSvg,
      join(stageDir, `${prefix}_sLoss.png`),
      scale,
    );

    console.log(
      `  Stage 1: ${prefix} — kp1=${akazeVis.kp1All.length} kp2=${akazeVis.kp2All.length} matched=${akazeVis.matchedPairs.length} sNew=${akazeVis.sNew.length} sLoss=${akazeVis.sLoss.length}`,
    );
  }
}

// ── Stage 1b: Pixel-Diff Fallback ──

async function generateStage1b(
  cvLib: CvLib,
  repPairs: PairAnalysis[],
  frames: FrameNode[],
  outputDir: string,
  scale: number,
): Promise<void> {
  const stageDir = join(outputDir, '02-pixel-diff');
  await ensureDir(stageDir);

  const preprocessed = new Map<
    number,
    { data: Uint8Array; width: number; height: number }
  >();

  for (const pair of repPairs) {
    const prefix = `pair-${pair.sourceId}-${pair.targetId}`;

    // Preprocess both frames if not cached
    for (const fId of [pair.sourceId, pair.targetId]) {
      if (!preprocessed.has(fId)) {
        const f = frames.find((fr) => fr.id === fId)!;
        preprocessed.set(fId, await preprocessFrame(f.extractPath, scale));
      }
    }

    const f1 = preprocessed.get(pair.sourceId)!;
    const f2 = preprocessed.get(pair.targetId)!;
    const vis = computePixelDiffVis(cvLib, f1, f2);
    const { width: w, height: h } = vis;

    // absdiff
    await saveGrayPng(
      vis.absdiffData,
      w,
      h,
      join(stageDir, `${prefix}_absdiff.png`),
    );

    // heatmap
    const heatmapRgb = applyJetColormap(vis.absdiffData);
    await sharp(Buffer.from(heatmapRgb), {
      raw: { width: w, height: h, channels: 3 },
    })
      .png()
      .toFile(join(stageDir, `${prefix}_heatmap.png`));

    // blurred
    await saveGrayPng(
      vis.blurredData,
      w,
      h,
      join(stageDir, `${prefix}_blurred.png`),
    );

    // binary
    await saveGrayPng(
      vis.binaryData,
      w,
      h,
      join(stageDir, `${prefix}_binary.png`),
    );

    // contours on color frame
    const contourColors = vis.contourRects.map(
      (_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length]!,
    );
    const contourLabels = vis.contourRects.map(
      (r, i) => `R${i} ${r.width}x${r.height}`,
    );
    const contourSvg = rectsSvg(
      vis.contourRects,
      contourColors,
      contourLabels,
      w,
      h,
    );
    await overlayOnFrame(
      pair.targetFrame.extractPath,
      contourSvg,
      join(stageDir, `${prefix}_contours.png`),
      scale,
    );

    // grid points
    const gridSvg = circlesSvg(vis.gridPoints, '#FFEAA7', 4, w, h, 0.7);
    await overlayOnFrame(
      pair.targetFrame.extractPath,
      gridSvg,
      join(stageDir, `${prefix}_grid-points.png`),
      scale,
    );

    console.log(
      `  Stage 1b: ${prefix} — contours=${vis.contourRects.length} gridPts=${vis.gridPoints.length}`,
    );
  }
}

// ── Stage 2: DBSCAN Clustering ──

async function generateStage2(
  repPairs: PairAnalysis[],
  outputDir: string,
  scale: number,
): Promise<void> {
  const stageDir = join(outputDir, '03-dbscan');
  await ensureDir(stageDir);

  for (const pair of repPairs) {
    const prefix = `pair-${pair.sourceId}-${pair.targetId}`;
    const frameBuf = await sharp(pair.targetFrame.extractPath)
      .resize({ width: scale, withoutEnlargement: true })
      .png()
      .toBuffer();
    const meta = await sharp(frameBuf).metadata();
    const w = meta.width!;
    const h = meta.height!;

    // Raw points
    const rawSvg = circlesSvg(pair.dbscanInput, '#FF4444', 5, w, h);
    await overlayOnFrame(
      pair.targetFrame.extractPath,
      rawSvg,
      join(stageDir, `${prefix}_raw-points.png`),
      scale,
    );

    // Clustered points (colored by cluster)
    const { labels } = pair.dbscanResult;
    const clusterCircles = pair.dbscanInput
      .map((pt, idx) => {
        const label = labels[idx]!;
        const color =
          label < 0
            ? '#888888'
            : CLUSTER_COLORS[label % CLUSTER_COLORS.length]!;
        return `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="5" fill="${color}" opacity="0.8"/>`;
      })
      .join('');
    const clusterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${clusterCircles}</svg>`;
    await overlayOnFrame(
      pair.targetFrame.extractPath,
      clusterSvg,
      join(stageDir, `${prefix}_clusters.png`),
      scale,
    );

    // Bounding boxes with labels
    const bboxColors = pair.clusters.map(
      (_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length]!,
    );
    const bboxLabels = pair.clusters.map(
      (_, i) => `C${i} (${pair.clusterPointCounts[i]} pts)`,
    );
    const bboxSvg = rectsSvg(pair.clusters, bboxColors, bboxLabels, w, h);
    await overlayOnFrame(
      pair.targetFrame.extractPath,
      bboxSvg,
      join(stageDir, `${prefix}_bboxes.png`),
      scale,
    );

    console.log(
      `  Stage 2: ${prefix} — clusters=${pair.clusters.length} noise=${labels.filter((l) => l < 0).length}`,
    );
  }
}

// ── Stage 3: G(t) Scoring ──

async function generateStage3(
  edges: ScoreEdge[],
  frames: FrameNode[],
  survivingIds: Set<number>,
  outputDir: string,
): Promise<void> {
  const stageDir = join(outputDir, '04-scoring');
  await ensureDir(stageDir);

  // Score bar chart
  const chartData = edges.map((e) => ({
    label: `${e.sourceId}-${e.targetId}`,
    value: e.score,
  }));
  const chartSvg = generateBarChartSVG(chartData, {
    width: CHART_W,
    height: CHART_H,
    title: 'G(t) Information Gain Scores (Raw)',
    highlightIndices: new Set(
      edges
        .map((e, i) => (survivingIds.has(e.targetId) ? i : -1))
        .filter((i) => i >= 0),
    ),
  });
  await svgToPng(chartSvg, join(stageDir, 'score-chart.png'));

  // Score strip: thumbnails with score badges
  const cols = Math.min(frames.length, 3);
  const scoreLabels = frames.map((f, i) => {
    if (i === 0) return `#${f.id} (first)`;
    const edge = edges[i - 1];
    return edge ? `#${f.id} G=${edge.score.toFixed(4)}` : `#${f.id}`;
  });
  await createMontage(
    frames.map((f) => f.extractPath),
    cols,
    THUMB_W,
    THUMB_H,
    join(stageDir, 'score-strip.png'),
    scoreLabels,
  );

  console.log(
    `  Stage 3: score-chart.png + score-strip.png (${edges.length} edges)`,
  );
}

// ── Stage 4: Pruning Results ──

async function generateStage4(
  edges: ScoreEdge[],
  frames: FrameNode[],
  survivingIds: Set<number>,
  outputDir: string,
): Promise<void> {
  const stageDir = join(outputDir, '05-pruning');
  await ensureDir(stageDir);

  // Normalized score chart
  const normalized = normalizeScores(edges);
  const normData = edges.map((e, i) => ({
    label: `${e.sourceId}-${e.targetId}`,
    value: normalized[i]!,
    color: survivingIds.has(e.targetId) ? '#4ECDC4' : '#555',
  }));
  const normSvg = generateBarChartSVG(normData, {
    width: CHART_W,
    height: CHART_H,
    title: 'Normalized Scores (Logistic-Z + CDF Hybrid)',
    thresholdLine: THRESHOLD,
    thresholdLabel: `threshold=${THRESHOLD}`,
    highlightIndices: new Set(
      edges
        .map((e, i) => (survivingIds.has(e.targetId) ? i : -1))
        .filter((i) => i >= 0),
    ),
  });
  await svgToPng(normSvg, join(stageDir, 'normalized-chart.png'));

  // Survivors strip: color for survivors, dimmed for removed
  const cols = Math.min(frames.length, 3);
  const composites: sharp.OverlayOptions[] = [];
  const tw = THUMB_W;
  const th = THUMB_H;
  const rows = Math.ceil(frames.length / cols);
  const totalW = cols * tw;
  const totalH = rows * th;

  for (let idx = 0; idx < frames.length; idx++) {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const isSurvivor = survivingIds.has(frames[idx]!.id);

    let thumb = sharp(frames[idx]!.extractPath).resize(tw, th, {
      fit: 'inside',
      background: { r: 18, g: 18, b: 30 },
    });
    if (!isSurvivor) {
      thumb = thumb.grayscale().modulate({ brightness: 0.5 });
    }
    composites.push({
      input: await thumb.png().toBuffer(),
      left: col * tw,
      top: row * th,
    });
  }

  // Border overlays
  const borderElems = frames
    .map((f, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = col * tw;
      const y = row * th;
      const isSurvivor = survivingIds.has(f.id);
      const color = isSurvivor ? '#4ECDC4' : '#555';
      const label = `#${f.id}`;
      return `<rect x="${x + 1}" y="${y + 1}" width="${tw - 2}" height="${th - 2}" fill="none" stroke="${color}" stroke-width="${isSurvivor ? 4 : 1}"/>
<text x="${x + 4}" y="${y + 20}" fill="${color}" font-size="16" font-family="monospace">${label}</text>`;
    })
    .join('');
  const borderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">${borderElems}</svg>`;
  composites.push({ input: Buffer.from(borderSvg), left: 0, top: 0 });

  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 3,
      background: { r: 18, g: 18, b: 30 },
    },
  })
    .composite(composites)
    .png()
    .toFile(join(stageDir, 'survivors-strip.png'));

  // Final selection: only survivors
  const survivorFrames = frames.filter((f) => survivingIds.has(f.id));
  const finalCols = Math.min(survivorFrames.length, 3);
  const finalLabels = survivorFrames.map(
    (f) => `#${f.id} ${f.timestamp.toFixed(1)}s`,
  );
  await createMontage(
    survivorFrames.map((f) => f.extractPath),
    finalCols,
    THUMB_W,
    THUMB_H,
    join(stageDir, 'final-selection.png'),
    finalLabels,
  );

  console.log(
    `  Stage 4: ${survivorFrames.length}/${frames.length} frames survived`,
  );
}

// ── HTML Gallery Generator ──

async function generateHtmlGallery(
  outputBase: string,
  videos: VideoShowcaseData[],
): Promise<void> {
  const stages = [
    {
      dir: '00-extraction',
      name: 'Frame Extraction',
      desc: `FFmpeg로 프레임 추출 (fps=${EXTRACT_FPS}, scale=${ANALYSIS_SCALE})`,
    },
    {
      dir: '01-akaze',
      name: 'AKAZE Features',
      desc: 'AKAZE 특징점 검출 + BFMatcher 매칭 → sNew/sLoss 집합',
    },
    {
      dir: '02-pixel-diff',
      name: 'Pixel-Diff Fallback',
      desc: 'absdiff → Gaussian → threshold → contour → grid sampling',
    },
    {
      dir: '03-dbscan',
      name: 'DBSCAN Clustering',
      desc: '공간 클러스터링 (eps = α·√(W²+H²)), 바운딩 박스 추출',
    },
    {
      dir: '04-scoring',
      name: 'G(t) Scoring',
      desc: 'Information Gain = Σ(areaRatio × featureDensity × animDecay)',
    },
    {
      dir: '05-pruning',
      name: 'Pruning',
      desc: 'Logistic-Z + CDF 정규화 → threshold + NMS → 최종 선택',
    },
  ];

  // Collect all images per video per stage
  const videoStageImages: Array<{
    videoName: string;
    stages: Array<{ stage: (typeof stages)[0]; images: string[] }>;
  }> = [];

  for (const video of videos) {
    const videoStages: Array<{
      stage: (typeof stages)[0];
      images: string[];
    }> = [];
    for (const stage of stages) {
      const stageDir = join(outputBase, video.name, stage.dir);
      let images: string[] = [];
      try {
        images = (await readdir(stageDir))
          .filter((f) => f.endsWith('.png'))
          .sort();
      } catch (error) {
        console.error(`Error reading stage directory ${stageDir}:`, error);
      }
      videoStages.push({ stage, images });
    }
    videoStageImages.push({ videoName: video.name, stages: videoStages });
  }

  const captions: Record<string, string> = {
    'frame-strip': '전체 프레임 추출 결과 (번호 + 타임스탬프)',
    'keypoints-frame1': 'Frame 1: AKAZE 키포인트 (초록 — 모든 검출 특징점)',
    'keypoints-frame2': 'Frame 2: AKAZE 키포인트 (초록 — 모든 검출 특징점)',
    matched: '매칭된 키포인트 쌍 (Lowe ratio test, threshold=0.25)',
    sNew: 'sNew — Frame 2에서 새로 등장한 특징점 (빨강, 매칭 안됨)',
    sLoss: 'sLoss — Frame 1에서 소실된 특징점 (파랑, 매칭 안됨)',
    absdiff: 'cv.absdiff() — 프레임 간 절대 차이 (그레이스케일)',
    heatmap: 'JET Colormap — 변화 강도 히트맵 (파랑→빨강)',
    blurred: 'GaussianBlur(3×3) — JPEG 노이즈 제거',
    binary: `threshold(${PIXELDIFF_BINARY_THRESHOLD}) — 이진화 마스크`,
    contours: 'findContours — 변화 영역 바운딩 박스',
    'grid-points': `그리드 샘플링 (spacing=${PIXELDIFF_SAMPLE_SPACING}px) → Point2D[]`,
    'raw-points': 'DBSCAN 입력: sNew 또는 pixel-diff 포인트 (빨간 점)',
    clusters: 'DBSCAN 클러스터링 결과 (색상 = 클러스터, 회색 = noise)',
    bboxes: '클러스터 바운딩 박스 (ID + 포인트 수)',
    'score-chart': 'G(t) 점수 바 차트 (하이라이트 = 생존 프레임)',
    'score-strip': '프레임 썸네일 + G(t) 점수 라벨',
    'normalized-chart':
      '정규화 점수 (Logistic-Z + CDF 혼합) + threshold 기준선',
    'survivors-strip': '생존 프레임 (컬러+초록 테두리) vs 제거 프레임 (회색)',
    'final-selection': '최종 선택 프레임',
  };

  function getCaption(filename: string): string {
    for (const [key, caption] of Object.entries(captions)) {
      if (filename.includes(key)) return caption;
    }
    return filename.replace('.png', '');
  }

  const sidebarItems = videoStageImages
    .map(
      (v) => `
    <div class="video-group">
      <div class="video-title">${v.videoName}</div>
      ${v.stages.map((s) => `<a class="stage-link" href="#${v.videoName}-${s.stage.dir}" title="${s.stage.desc}">${s.stage.name}</a>`).join('')}
    </div>`,
    )
    .join('');

  const mainContent = videoStageImages
    .map((v) =>
      v.stages
        .map(
          (s) => `
    <section id="${v.videoName}-${s.stage.dir}">
      <h2>${v.videoName} / ${s.stage.name}</h2>
      <p class="stage-desc">${s.stage.desc}</p>
      <div class="image-grid">
        ${s.images
          .map(
            (img) => `<div class="image-card">
          <img src="${v.videoName}/${s.stage.dir}/${img}" alt="${img}" loading="lazy" onclick="openModal(this)"/>
          <div class="caption">${getCaption(img)}</div>
        </div>`,
          )
          .join('')}
      </div>
    </section>`,
        )
        .join(''),
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>scene-sieve Algorithm Showcase</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'SF Mono','Fira Code',monospace;background:#0d1117;color:#c9d1d9;display:flex;min-height:100vh}
.sidebar{width:220px;background:#161b22;border-right:1px solid #30363d;padding:16px;position:fixed;top:0;left:0;bottom:0;overflow-y:auto}
.sidebar h1{font-size:14px;color:#58a6ff;margin-bottom:16px;letter-spacing:0.5px}
.video-group{margin-bottom:16px}
.video-title{font-size:12px;color:#8b949e;text-transform:uppercase;margin-bottom:6px;padding:4px 0;border-bottom:1px solid #21262d}
.stage-link{display:block;padding:5px 8px;color:#c9d1d9;text-decoration:none;font-size:12px;border-radius:4px;margin-bottom:2px;transition:background 0.15s}
.stage-link:hover{background:#21262d;color:#58a6ff}
main{margin-left:220px;padding:24px 32px;flex:1;max-width:1920px}
section{margin-bottom:48px}
h2{font-size:18px;color:#f0f6fc;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #21262d}
.stage-desc{font-size:12px;color:#8b949e;margin-bottom:16px}
.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(640px,1fr));gap:16px}
.image-card{background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden;transition:border-color 0.2s}
.image-card:hover{border-color:#58a6ff}
.image-card img{width:100%;display:block;cursor:pointer}
.caption{padding:8px 12px;font-size:13px;color:#8b949e;line-height:1.4}
.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:100;justify-content:center;align-items:center;cursor:pointer}
.modal-overlay.active{display:flex}
.modal-overlay img{max-width:95vw;max-height:95vh;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5)}
</style>
</head>
<body>
<nav class="sidebar">
  <h1>scene-sieve<br/>Algorithm Showcase</h1>
  ${sidebarItems}
</nav>
<main>
  <h1 style="font-size:24px;margin-bottom:8px;color:#f0f6fc">Algorithm Visualization</h1>
  <p style="font-size:13px;color:#8b949e;margin-bottom:32px">AKAZE → DBSCAN → IoU Tracking → G(t) Scoring → Pruning</p>
  ${mainContent}
</main>
<div class="modal-overlay" id="modal" onclick="closeModal()">
  <img id="modal-img" src="" alt=""/>
</div>
<script>
function openModal(el){const m=document.getElementById('modal');document.getElementById('modal-img').src=el.src;m.classList.add('active')}
function closeModal(){document.getElementById('modal').classList.remove('active')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
</script>
</body>
</html>`;

  await writeFile(join(outputBase, 'index.html'), html);
  console.log('  HTML gallery: index.html');
}

// ── Main ──

async function main() {
  const SAMPLES_DIR = dirname(fileURLToPath(import.meta.url));
  const OUTPUT_BASE = join(SAMPLES_DIR, 'algorithm-showcase');

  const args = process.argv.slice(2);
  const inputs =
    args.length > 0
      ? args.map((p) => {
          const absPath = isAbsolute(p) ? p : join(process.cwd(), p);
          return { name: basename(absPath, extname(absPath)), path: absPath };
        })
      : [
          { name: 'screenRecord1', path: join(SAMPLES_DIR, 'screenRecord1.mov') },
          { name: 'screenRecord2', path: join(SAMPLES_DIR, 'screenRecord2.gif') },
        ];

  console.log('=== scene-sieve Algorithm Showcase Generator ===\n');
  console.log('Initializing OpenCV WASM...');
  const cv = await ensureOpenCV();
  console.log('OpenCV ready.\n');

  const allVideoData: VideoShowcaseData[] = [];

  for (const input of inputs) {
    if (!existsSync(input.path)) {
      console.warn(`Skipping ${input.name}: file not found at ${input.path}`);
      continue;
    }

    console.log(`\n▶ Processing ${input.name}...`);
    const videoDir = join(OUTPUT_BASE, input.name);
    await ensureDir(videoDir);

    // Step 1: Extract frames
    console.log('  Extracting frames...');
    const { frames, framesDir } = await extractFramesForShowcase(input.path);
    console.log(`  Extracted ${frames.length} frames to ${framesDir}`);

    // Step 2: Run analysis
    console.log('  Running analysis pipeline...');
    const { pairs, edges } = await runAnalysisWithVis(cv, frames);
    console.log(`  Analyzed ${edges.length} edges`);

    // Step 3: Prune
    const survivingIds = pruneByThresholdWithCap(
      edges,
      frames,
      THRESHOLD,
      MAX_COUNT,
    );
    console.log(
      `  Pruning: ${survivingIds.size}/${frames.length} frames survived`,
    );

    // Step 4: Select representative pairs
    const repPairs = selectRepresentativePairs(pairs);
    console.log(
      `  Representative pairs: ${repPairs.map((p) => `${p.sourceId}-${p.targetId}`).join(', ')}`,
    );

    // Step 5: Generate stages
    await generateStage0(frames, videoDir);
    await generateStage1(repPairs, videoDir, ANALYSIS_SCALE);
    await generateStage1b(cv, repPairs, frames, videoDir, ANALYSIS_SCALE);
    await generateStage2(repPairs, videoDir, ANALYSIS_SCALE);
    await generateStage3(edges, frames, survivingIds, videoDir);
    await generateStage4(edges, frames, survivingIds, videoDir);

    allVideoData.push({
      name: input.name,
      frames,
      framesDir,
      pairs,
      edges,
      survivingIds,
    });
  }

  // Step 6: HTML gallery
  console.log('\nGenerating HTML gallery...');
  await generateHtmlGallery(OUTPUT_BASE, allVideoData);

  console.log('\n=== Showcase generation complete! ===');
  console.log(`Output: ${OUTPUT_BASE}/`);
  console.log(`Open: ${OUTPUT_BASE}/index.html`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
