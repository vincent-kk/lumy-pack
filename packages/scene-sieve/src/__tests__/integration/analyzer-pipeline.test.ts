import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { analyzeFrames } from '../../core/analyzer.js';
import type { ProcessContext, FrameNode } from '../../types/index.js';

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
    { r: 255, g: 0, b: 0 },   // red
    { r: 0, g: 255, b: 0 },   // green
    { r: 0, g: 0, b: 255 },   // blue
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
          outputPath: testDir,
          fps: 5,
          scale: 320,
          quality: 80,
          debug: false,
        },
        workspacePath: testDir,
        frames: frameNodes,
        graph: [],
        status: 'ANALYZING',
        emitProgress: () => {},
      };

      const edges = await analyzeFrames(ctx);

      // Should produce N-1 edges for N frames
      expect(edges).toHaveLength(frameNodes.length - 1);

      for (let i = 0; i < edges.length; i++) {
        expect(edges[i].sourceId).toBe(i);
        expect(edges[i].targetId).toBe(i + 1);
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
          outputPath: testDir,
          fps: 5,
          scale: 320,
          quality: 80,
          debug: false,
        },
        workspacePath: testDir,
        frames: frameNodes,
        graph: [],
        status: 'ANALYZING',
        emitProgress: () => {},
      };

      const edges = await analyzeFrames(ctx);

      for (const edge of edges) {
        expect(edge.score).toBeGreaterThanOrEqual(0);
      }
    },
    TIMEOUT,
  );
});
