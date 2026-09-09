import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveOptions } from '../../core/input-resolver.js';
import {
  cleanupWorkspace,
  createWorkspace,
  finalizeOutput,
  readFramesAsBuffers,
  writeInputBuffer,
  writeInputFrames,
} from '../../core/workspace.js';
import type { ProcessContext } from '../../types/index.js';
import { fileExists } from '../../utils/paths.js';

/** Create a tiny valid JPEG buffer for testing */
async function createTestJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

const testWorkspaces: string[] = [];

async function makeTempWorkspace(): Promise<string> {
  const p = join(tmpdir(), `scene-sieve-test-${randomUUID()}`);
  await mkdir(p, { recursive: true });
  testWorkspaces.push(p);
  return p;
}

afterEach(async () => {
  for (const ws of testWorkspaces.splice(0)) {
    await rm(ws, { recursive: true, force: true });
  }
});

describe('createWorkspace', () => {
  it('creates frames/ and output/ subdirectories', async () => {
    const sessionId = randomUUID();
    const workspacePath = await createWorkspace(sessionId);
    testWorkspaces.push(workspacePath);

    expect(await fileExists(join(workspacePath, 'frames'))).toBe(true);
    expect(await fileExists(join(workspacePath, 'output'))).toBe(true);
  });
});

describe('finalizeOutput', () => {
  it.each([true, false])(
    'uses actual dimensions and axis-specific clamped boxes (selected=%s)',
    async (hasSelection) => {
      const ws = await createWorkspace(randomUUID());
      testWorkspaces.push(ws);
      const outputPath = join(ws, 'final');
      const image = await sharp({
        create: { width: 101, height: 67, channels: 3, background: 'white' },
      })
        .jpeg()
        .toBuffer();
      const frames = await writeInputFrames(
        hasSelection ? [await createTestJpeg(), image] : [image],
        ws,
      );
      const animations = [
        {
          type: 'loading_spinner',
          startFrameId: 0,
          endFrameId: 1,
          durationMs: 1234.5,
          boundingBox: { x: 5, y: 20, width: 7, height: 9 },
        },
        {
          type: 'loading_spinner',
          startFrameId: 1,
          endFrameId: 2,
          durationMs: 2000,
          boundingBox: { x: -2, y: -3, width: 80, height: 90 },
        },
        {
          type: 'loading_spinner',
          startFrameId: 2,
          endFrameId: 3,
          durationMs: 2000,
          boundingBox: { x: 45, y: 30, width: 20, height: 20 },
        },
        {
          type: 'loading_spinner',
          startFrameId: 3,
          endFrameId: 4,
          durationMs: 2000,
          boundingBox: { x: 60, y: 40, width: 5, height: 5 },
        },
      ];
      const ctx: ProcessContext = {
        options: resolveOptions({
          mode: 'file',
          inputPath: '/input.gif',
          outputPath,
        }),
        effectiveFps: 0.2,
        sourceDurationSec: 14.7,
        analysisResolution: { width: 50, height: 33 },
        workspacePath: ws,
        frames,
        graph: [],
        animations,
        status: 'FINALIZING',
        emitProgress: () => {},
      };
      const originalAnimations = structuredClone(animations);
      await finalizeOutput(ctx, hasSelection ? frames.slice(1) : []);
      const metadata = JSON.parse(
        await readFile(join(outputPath, '.metadata.json'), 'utf8'),
      );
      expect
        .soft(metadata.video)
        .toEqual({
          originalDurationMs: 14700,
          fps: 0.2,
          resolution: { width: 101, height: 67 },
        });
      expect
        .soft(
          metadata.animations.map(
            (animation: { boundingBox: unknown }) => animation.boundingBox,
          ),
        )
        .toEqual([
          { x: 10, y: 41, width: 14, height: 18 },
          { x: 0, y: 0, width: 101, height: 67 },
          { x: 91, y: 61, width: 10, height: 6 },
          { x: 101, y: 67, width: 0, height: 0 },
        ]);
      expect(metadata.animations[0]).toMatchObject({
        startFrameId: 1,
        endFrameId: 2,
        durationMs: 1235,
      });
      expect(ctx.animations).toEqual(originalAnimations);
      if (hasSelection) {
        const actual = await sharp(
          join(outputPath, 'frame_0002.jpg'),
        ).metadata();
        expect(metadata.video.resolution).toEqual({
          width: actual.width,
          height: actual.height,
        });
      }
    },
  );

  it('copies frames to staging and renames to output path', async () => {
    const ws = await makeTempWorkspace();
    const framesDir = join(ws, 'frames');
    const outputDir = join(ws, 'output');
    await mkdir(framesDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    // Create a valid JPEG frame file
    const framePath = join(framesDir, 'frame_000001.jpg');
    await writeFile(framePath, await createTestJpeg());

    const outputPath = join(ws, 'final_output');
    const ctx: ProcessContext = {
      options: {
        mode: 'file',
        count: 5,
        threshold: 0.5,
        pruneMode: 'threshold-with-cap',
        outputPath,
        fps: 5,
        maxFrames: 300,
        scale: 720,
        quality: 80,
        iouThreshold: 0.9,
        animationThreshold: 5,
        debug: false,
        maxSegmentDuration: 300,
        concurrency: 2,
      },
      workspacePath: ws,
      frames: [],
      graph: [],
      status: 'FINALIZING',
      emitProgress: () => {},
    };

    const selectedFrames = [{ id: 0, timestamp: 0, extractPath: framePath }];
    const outputFiles = await finalizeOutput(ctx, selectedFrames);

    expect(outputFiles).toHaveLength(2); // 1 scene image + 1 .metadata.json
    expect(outputFiles[0]).toContain('frame_0001.jpg');
    expect(outputFiles[1]).toContain('.metadata.json');
    expect(await fileExists(outputFiles[0])).toBe(true);
    expect(await fileExists(outputFiles[1])).toBe(true);
  });

  it('uses larger padding when total frames exceed 9999', async () => {
    const ws = await makeTempWorkspace();
    const framesDir = join(ws, 'frames');
    const outputDir = join(ws, 'output');
    await mkdir(framesDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const framePath = join(framesDir, 'frame_000001.jpg');
    await writeFile(framePath, await createTestJpeg());

    const outputPath = join(ws, 'final_output_large');
    const ctx: ProcessContext = {
      options: {
        mode: 'file',
        count: 5,
        threshold: 0.5,
        pruneMode: 'threshold-with-cap',
        outputPath,
        fps: 5,
        maxFrames: 300,
        scale: 720,
        quality: 80,
        iouThreshold: 0.9,
        animationThreshold: 5,
        debug: false,
        maxSegmentDuration: 300,
        concurrency: 2,
      },
      workspacePath: ws,
      // Simulate 12,345 total frames
      frames: Array.from({ length: 12345 }, (_, i) => ({
        id: i,
        timestamp: i,
        extractPath: '',
      })),
      graph: [],
      status: 'FINALIZING',
      emitProgress: () => {},
    };

    const selectedFrames = [
      { id: 999, timestamp: 200, extractPath: framePath },
    ];
    const outputFiles = await finalizeOutput(ctx, selectedFrames);

    // Should use 5 digits because 12345 has 5 digits
    expect(outputFiles[0]).toContain('frame_01000.jpg');
  });
});

describe('cleanupWorkspace', () => {
  it('removes workspace directory', async () => {
    const ws = await makeTempWorkspace();
    expect(await fileExists(ws)).toBe(true);
    await cleanupWorkspace(ws);
    expect(await fileExists(ws)).toBe(false);
  });

  it('does not throw if workspacePath is empty string', async () => {
    await expect(cleanupWorkspace('')).resolves.not.toThrow();
  });

  it('does not throw if path does not exist', async () => {
    await expect(
      cleanupWorkspace('/tmp/nonexistent-path-xyz-123'),
    ).resolves.not.toThrow();
  });
});

describe('writeInputBuffer', () => {
  it('writes buffer to temp file and returns path', async () => {
    const ws = await makeTempWorkspace();
    const data = Buffer.from('fake-video-data');
    const resultPath = await writeInputBuffer(data, ws);

    expect(resultPath).toContain('input.mp4');
    expect(await fileExists(resultPath)).toBe(true);
  });
});

describe('writeInputFrames', () => {
  it('writes frame buffers as JPGs and returns FrameNode[]', async () => {
    const ws = await makeTempWorkspace();
    await mkdir(join(ws, 'frames'), { recursive: true });

    const frames = [
      Buffer.from('frame-0-data'),
      Buffer.from('frame-1-data'),
      Buffer.from('frame-2-data'),
    ];

    const frameNodes = await writeInputFrames(frames, ws);

    expect(frameNodes).toHaveLength(3);
    for (let i = 0; i < frameNodes.length; i++) {
      expect(frameNodes[i].id).toBe(i);
      expect(await fileExists(frameNodes[i].extractPath)).toBe(true);
    }
  });
});

describe('readFramesAsBuffers', () => {
  it('reads frame files as Buffers', async () => {
    const ws = await makeTempWorkspace();
    const framesDir = join(ws, 'frames');
    await mkdir(framesDir, { recursive: true });

    const jpegBuf = await createTestJpeg();
    const frameNodes = [];

    for (let i = 0; i < 2; i++) {
      const p = join(framesDir, `frame_${i}.jpg`);
      await writeFile(p, jpegBuf);
      frameNodes.push({ id: i, timestamp: i, extractPath: p });
    }

    const buffers = await readFramesAsBuffers(frameNodes, 80);
    expect(buffers).toHaveLength(2);
    for (const buf of buffers) {
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    }
  });
});
