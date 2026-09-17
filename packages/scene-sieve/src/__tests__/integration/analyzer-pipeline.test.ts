import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ANIMATION_FRAME_THRESHOLD,
  DEFAULT_FPS,
  DEFAULT_MAX_FRAMES,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
  IOU_THRESHOLD,
} from '../../constants/pipeline-defaults.js';
import { analyzeFrames, IoUTracker } from '../../core/analyzer/analyzer.js';
import type { FrameNode, ProcessContext } from '../../types/index.js';

// Integration test: uses real sharp + OpenCV WASM
// Timeout set high due to WASM initialization
const TIMEOUT = 60_000;

let testDir: string;
let frameNodes: FrameNode[];

beforeAll(async () => {
  testDir = join(tmpdir(), `scene-sieve-integration-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });

  // Generate 5 distinct colored rectangles as grayscale PNG test images
  const colors: Array<{ r: number; g: number; b: number }> = [
    { r: 255, g: 0, b: 0 }, // red
    { r: 0, g: 255, b: 0 }, // green
    { r: 0, g: 0, b: 255 }, // blue
    { r: 255, g: 255, b: 0 }, // yellow
    { r: 128, g: 0, b: 128 }, // purple
  ];

  frameNodes = [];
  for (let i = 0; i < colors.length; i++) {
    const { r, g, b } = colors[i];
    const filePath = join(testDir, `frame_${String(i).padStart(6, '0')}.jpg`);

    // Create a solid-color 320x240 image
    await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r, g, b },
      },
    })
      .jpeg()
      .toFile(filePath);

    frameNodes.push({ id: i, timestamp: i, extractPath: filePath });
  }
}, TIMEOUT);

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

afterEach(() => vi.restoreAllMocks());

describe('analyzeFrames integration', () => {
  it(
    'returns ScoreEdge[] with correct sourceId/targetId pairs',
    async () => {
      const ctx: ProcessContext = {
        options: {
          mode: 'file',
          count: 5,
          threshold: 0.5,
          pruneMode: 'threshold-with-cap',
          sheet: null,
          includeEdges: false,
          outputPath: testDir,
          fps: DEFAULT_FPS,
          maxFrames: DEFAULT_MAX_FRAMES,
          scale: DEFAULT_SCALE,
          quality: DEFAULT_QUALITY,
          iouThreshold: IOU_THRESHOLD,
          animationThreshold: ANIMATION_FRAME_THRESHOLD,
          debug: false,
          maxSegmentDuration: 300,
          concurrency: 2,
        },
        workspacePath: testDir,
        frames: frameNodes,
        graph: [],
        status: 'ANALYZING',
        emitProgress: () => {},
      };

      const tracker = vi.spyOn(IoUTracker.prototype, 'update');
      const { edges, animations, analysisResolution } = await analyzeFrames(ctx);

      // Should produce N-1 edges for N frames
      expect(edges).toHaveLength(frameNodes.length - 1);
      expect(Array.isArray(animations)).toBe(true);

      for (let i = 0; i < edges.length; i++) {
        expect(edges[i].sourceId).toBe(i);
        expect(edges[i].targetId).toBe(i + 1);
        const change = edges[i].change;
        expect(change).toBeDefined();
        const clusters = tracker.mock.calls[i][0];
        const animated: Set<number> = tracker.mock.results[i].value;
        expect(change!.regions).toEqual(clusters.filter((_, index) => !animated.has(index)));
        expect(change!.animatedRegions).toEqual(clusters.filter((_, index) => animated.has(index)));
        expect(change!.regions.length + change!.animatedRegions.length).toBe(clusters.length);
        for (const box of [...change!.regions, ...change!.animatedRegions]) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(analysisResolution.width);
          expect(box.y + box.height).toBeLessThanOrEqual(analysisResolution.height);
        }
      }
    },
    TIMEOUT,
  );

  it(
    'score >= 0 for all edges',
    async () => {
      const ctx: ProcessContext = {
        options: {
          mode: 'file',
          count: 5,
          threshold: 0.5,
          pruneMode: 'threshold-with-cap',
          sheet: null,
          includeEdges: false,
          outputPath: testDir,
          fps: 5,
          maxFrames: 300,
          scale: 320,
          quality: 80,
          iouThreshold: 0.9,
          animationThreshold: 5,
          debug: false,
          maxSegmentDuration: 300,
          concurrency: 2,
        },
        workspacePath: testDir,
        frames: frameNodes,
        graph: [],
        status: 'ANALYZING',
        emitProgress: () => {},
      };

      const { edges } = await analyzeFrames(ctx);

      for (const edge of edges) {
        expect(edge.score).toBeGreaterThanOrEqual(0);
      }
    },
    TIMEOUT,
  );
});
