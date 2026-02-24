/**
 * Performance Benchmark for scene-sieve core algorithms.
 *
 * Measures:
 *  - DBSCAN clustering at various input sizes
 *  - IoU pair computation at various grid sizes
 *  - Information Gain scoring at various cluster counts
 *
 * Run:
 *   cd /Users/Vincent/Workspace/lumy-pack/packages/scene-sieve
 *   npx tsx src/__tests__/bench/algorithms.bench.ts
 */
import { computeInformationGain, computeIoU } from '../../core/analyzer.js';
import { dbscan } from '../../core/dbscan.js';
import type { Point2D } from '../../core/dbscan.js';
import { pruneTo } from '../../core/pruner.js';
import type { BoundingBox, FrameNode, ScoreEdge } from '../../types/index.js';

// ── Utilities ─────────────────────────────────────────────────────────────────

function randomPoints(n: number, width: number, height: number): Point2D[] {
  const pts: Point2D[] = new Array(n);
  for (let i = 0; i < n; i++) {
    pts[i] = { x: Math.random() * width, y: Math.random() * height };
  }
  return pts;
}

function randomBoxes(n: number, width: number, height: number): BoundingBox[] {
  const boxes: BoundingBox[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * (width * 0.8);
    const y = Math.random() * (height * 0.8);
    const w = 20 + Math.random() * (width * 0.2);
    const h = 20 + Math.random() * (height * 0.2);
    boxes[i] = { x, y, width: w, height: h };
  }
  return boxes;
}

interface BenchResult {
  algorithm: string;
  inputSize: number | string;
  runs: number;
  meanMs: number;
  stdDevMs: number;
  memDeltaKB: number;
}

function stats(timesNs: bigint[]): { meanMs: number; stdDevMs: number } {
  const ms = timesNs.map((t) => Number(t) / 1_000_000);
  const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
  const variance = ms.reduce((a, b) => a + (b - mean) ** 2, 0) / ms.length;
  return { meanMs: mean, stdDevMs: Math.sqrt(variance) };
}

function formatTable(results: BenchResult[]): void {
  const header = [
    'Algorithm'.padEnd(30),
    'Input Size'.padEnd(14),
    'Runs'.padEnd(6),
    'Mean (ms)'.padEnd(12),
    'Std Dev'.padEnd(12),
    'Mem Delta (KB)'.padEnd(16),
  ].join(' | ');

  const sep = '-'.repeat(header.length);

  console.log('\n' + sep);
  console.log(header);
  console.log(sep);

  for (const r of results) {
    const row = [
      r.algorithm.padEnd(30),
      String(r.inputSize).padEnd(14),
      String(r.runs).padEnd(6),
      r.meanMs.toFixed(3).padEnd(12),
      r.stdDevMs.toFixed(3).padEnd(12),
      r.memDeltaKB.toFixed(1).padEnd(16),
    ].join(' | ');
    console.log(row);
  }

  console.log(sep + '\n');
}

// ── Benchmark Runners ─────────────────────────────────────────────────────────

const RUNS = 5;
const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;

async function benchDBSCAN(): Promise<BenchResult[]> {
  const sizes = [100, 500, 1000, 3000, 5000];
  const results: BenchResult[] = [];

  console.log('Running DBSCAN benchmarks...');

  for (const n of sizes) {
    const times: bigint[] = [];
    let memDelta = 0;

    for (let r = 0; r < RUNS; r++) {
      const pts = randomPoints(n, IMAGE_WIDTH, IMAGE_HEIGHT);

      const memBefore = process.memoryUsage().heapUsed;
      const t0 = process.hrtime.bigint();
      dbscan(pts, IMAGE_WIDTH, IMAGE_HEIGHT);
      const t1 = process.hrtime.bigint();
      const memAfter = process.memoryUsage().heapUsed;

      times.push(t1 - t0);
      memDelta += (memAfter - memBefore) / 1024;
    }

    const { meanMs, stdDevMs } = stats(times);
    results.push({
      algorithm: 'DBSCAN',
      inputSize: n,
      runs: RUNS,
      meanMs,
      stdDevMs,
      memDeltaKB: memDelta / RUNS,
    });

    console.log(
      `  DBSCAN n=${n}: ${meanMs.toFixed(3)} ms (±${stdDevMs.toFixed(3)})`,
    );
  }

  return results;
}

async function benchIoU(): Promise<BenchResult[]> {
  const sizes = [10, 50, 100, 500];
  const results: BenchResult[] = [];

  console.log('Running IoU N×N benchmarks...');

  for (const n of sizes) {
    const times: bigint[] = [];
    let memDelta = 0;

    for (let r = 0; r < RUNS; r++) {
      const boxes = randomBoxes(n, IMAGE_WIDTH, IMAGE_HEIGHT);

      const memBefore = process.memoryUsage().heapUsed;
      const t0 = process.hrtime.bigint();

      // N×N all-pairs IoU
      let sink = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          sink += computeIoU(boxes[i]!, boxes[j]!);
        }
      }
      // prevent dead-code elimination
      if (sink < 0) console.log(sink);

      const t1 = process.hrtime.bigint();
      const memAfter = process.memoryUsage().heapUsed;

      times.push(t1 - t0);
      memDelta += (memAfter - memBefore) / 1024;
    }

    const { meanMs, stdDevMs } = stats(times);
    const pairs = (n * (n - 1)) / 2;
    results.push({
      algorithm: 'IoU (N×N pairs)',
      inputSize: `N=${n} (${pairs} pairs)`,
      runs: RUNS,
      meanMs,
      stdDevMs,
      memDeltaKB: memDelta / RUNS,
    });

    console.log(
      `  IoU N=${n} (${pairs} pairs): ${meanMs.toFixed(3)} ms (±${stdDevMs.toFixed(3)})`,
    );
  }

  return results;
}

async function benchInformationGain(): Promise<BenchResult[]> {
  const clusterCounts = [5, 20, 50, 100, 300];
  const results: BenchResult[] = [];
  const imageArea = IMAGE_WIDTH * IMAGE_HEIGHT;

  console.log('Running Information Gain benchmarks...');

  for (const n of clusterCounts) {
    const times: bigint[] = [];
    let memDelta = 0;

    for (let r = 0; r < RUNS; r++) {
      const clusters = randomBoxes(n, IMAGE_WIDTH, IMAGE_HEIGHT);
      const clusterPoints = clusters.map(
        () => Math.floor(Math.random() * 50) + 1,
      );
      const animationIndices = new Set<number>(
        Array.from({ length: Math.floor(n * 0.2) }, (_, i) => i * 5),
      );
      const animationWeights = clusters.map(() => Math.random() * 0.8);

      const memBefore = process.memoryUsage().heapUsed;
      const t0 = process.hrtime.bigint();

      // Run 1000 times per iteration to get measurable durations
      let sink = 0;
      for (let iter = 0; iter < 1000; iter++) {
        sink += computeInformationGain(
          clusters,
          clusterPoints,
          imageArea,
          animationIndices,
          animationWeights,
        );
      }
      if (sink < 0) console.log(sink);

      const t1 = process.hrtime.bigint();
      const memAfter = process.memoryUsage().heapUsed;

      // Divide by 1000 to get per-call time
      times.push((t1 - t0) / 1000n);
      memDelta += (memAfter - memBefore) / 1024;
    }

    const { meanMs, stdDevMs } = stats(times);
    results.push({
      algorithm: 'InformationGain',
      inputSize: `${n} clusters`,
      runs: RUNS,
      meanMs,
      stdDevMs,
      memDeltaKB: memDelta / RUNS,
    });

    console.log(
      `  InformationGain clusters=${n}: ${meanMs.toFixed(4)} ms (±${stdDevMs.toFixed(4)})`,
    );
  }

  return results;
}

// ── Pruner Benchmark ─────────────────────────────────────────────────────────

function makeBenchFrames(n: number): FrameNode[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    timestamp: i * 0.2,
    extractPath: `/tmp/frame_${i}.jpg`,
  }));
}

function makeBenchEdges(n: number): ScoreEdge[] {
  return Array.from({ length: n - 1 }, (_, i) => ({
    sourceId: i,
    targetId: i + 1,
    // Alternating pattern to stress re-linking
    score: i % 3 === 0 ? 0.8 : 0.1 + Math.random() * 0.2,
  }));
}

async function benchPruneTo(): Promise<BenchResult[]> {
  const sizes = [50, 100, 500, 1000, 3000];
  const results: BenchResult[] = [];

  console.log('Running pruneTo (min-heap) benchmarks...');

  for (const n of sizes) {
    const times: bigint[] = [];
    let memDelta = 0;
    const target = Math.max(5, Math.floor(n * 0.1));

    for (let r = 0; r < RUNS; r++) {
      const frames = makeBenchFrames(n);
      const edges = makeBenchEdges(n);

      const memBefore = process.memoryUsage().heapUsed;
      const t0 = process.hrtime.bigint();
      pruneTo(edges, frames, target);
      const t1 = process.hrtime.bigint();
      const memAfter = process.memoryUsage().heapUsed;

      times.push(t1 - t0);
      memDelta += (memAfter - memBefore) / 1024;
    }

    const { meanMs, stdDevMs } = stats(times);
    results.push({
      algorithm: 'pruneTo (min-heap)',
      inputSize: `N=${n} → ${target}`,
      runs: RUNS,
      meanMs,
      stdDevMs,
      memDeltaKB: memDelta / RUNS,
    });

    console.log(
      `  pruneTo N=${n} → ${target}: ${meanMs.toFixed(3)} ms (±${stdDevMs.toFixed(3)})`,
    );
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('  scene-sieve Algorithm Performance Benchmark');
  console.log(`  Node.js ${process.version} | Platform: ${process.platform}`);
  console.log('='.repeat(80));
  console.log();

  const allResults: BenchResult[] = [];

  const dbscanResults = await benchDBSCAN();
  allResults.push(...dbscanResults);

  console.log();

  const iouResults = await benchIoU();
  allResults.push(...iouResults);

  console.log();

  const igResults = await benchInformationGain();
  allResults.push(...igResults);

  console.log();

  const prunerResults = await benchPruneTo();
  allResults.push(...prunerResults);

  console.log('\n\n=== RESULTS TABLE ===');
  formatTable(allResults);

  // Summary of DBSCAN complexity
  console.log('=== DBSCAN Complexity Analysis ===');
  const dbscanRows = allResults.filter((r) => r.algorithm === 'DBSCAN');
  if (dbscanRows.length >= 2) {
    for (let i = 1; i < dbscanRows.length; i++) {
      const prev = dbscanRows[i - 1]!;
      const curr = dbscanRows[i]!;
      const sizeRatio = Number(curr.inputSize) / Number(prev.inputSize);
      const timeRatio = curr.meanMs / prev.meanMs;
      const empiricalExponent = Math.log(timeRatio) / Math.log(sizeRatio);
      console.log(
        `  n: ${prev.inputSize} -> ${curr.inputSize}  ` +
          `(${sizeRatio.toFixed(1)}x size, ${timeRatio.toFixed(2)}x time, ` +
          `empirical O(n^${empiricalExponent.toFixed(2)}))`,
      );
    }
  }
  console.log();

  // Summary of Pruner complexity
  console.log('=== Pruner Complexity Analysis ===');
  const prunerRows = allResults.filter(
    (r) => r.algorithm === 'pruneTo (min-heap)',
  );
  if (prunerRows.length >= 2) {
    for (let i = 1; i < prunerRows.length; i++) {
      const prev = prunerRows[i - 1]!;
      const curr = prunerRows[i]!;
      const prevN = Number(String(prev.inputSize).match(/N=(\d+)/)?.[1] ?? 0);
      const currN = Number(String(curr.inputSize).match(/N=(\d+)/)?.[1] ?? 0);
      if (prevN === 0 || currN === 0) continue;
      const sizeRatio = currN / prevN;
      const timeRatio = curr.meanMs / prev.meanMs;
      const empiricalExponent = Math.log(timeRatio) / Math.log(sizeRatio);
      console.log(
        `  n: ${prevN} -> ${currN}  ` +
          `(${sizeRatio.toFixed(1)}x size, ${timeRatio.toFixed(2)}x time, ` +
          `empirical O(n^${empiricalExponent.toFixed(2)}))`,
      );
    }
  }
  console.log();
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
