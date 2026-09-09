import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { extractScenes } from '../../index.js';
import { fileExists } from '../../core/utils/filesystem/paths.js';

const execAsync = promisify(exec);

const TIMEOUT = 120_000;

let testDir: string;
let testVideoPath: string;

async function hasFfmpeg(): Promise<boolean> {
  try {
    // Use bundled ffmpeg-static
    const { default: ffmpegStatic } = await import('ffmpeg-static');
    return Boolean(ffmpegStatic);
  } catch {
    return false;
  }
}

/** Generate a testsrc video at the requested path and duration in seconds. */
async function createTestVideo(
  outputPath: string,
  duration = 2,
  size = '320x240',
): Promise<void> {
  const { default: ffmpegStatic } = await import('ffmpeg-static');
  if (!ffmpegStatic) throw new Error('ffmpeg-static not available');

  await execAsync(
    `"${ffmpegStatic}" -y -f lavfi -i "testsrc=size=${size}:rate=5" -t ${duration} "${outputPath}"`,
  );
}

beforeAll(async () => {
  testDir = join(tmpdir(), `scene-sieve-e2e-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });
  testVideoPath = join(testDir, 'test_input.mp4');

  const ffmpegAvailable = await hasFfmpeg();
  if (!ffmpegAvailable) {
    console.warn('ffmpeg-static not available, skipping E2E video generation');
    return;
  }

  await createTestVideo(testVideoPath);
}, TIMEOUT);

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('extractScenes E2E pipeline', () => {
  it.each([300, 1])(
    'records portrait JPEG dimensions with segment duration %s',
    async (maxSegmentDuration) => {
      const inputPath = join(testDir, `portrait-${maxSegmentDuration}.mp4`);
      const outputPath = join(testDir, `portrait-${maxSegmentDuration}-output`);
      await createTestVideo(inputPath, 2, '240x320');
      const result = await extractScenes({
        mode: 'file',
        inputPath,
        outputPath,
        scale: 320,
        fps: 5,
        maxFrames: 4,
        maxSegmentDuration,
      });
      const metadata = JSON.parse(
        await readFile(join(outputPath, '.metadata.json'), 'utf8'),
      );
      const actual = await sharp(
        result.outputFiles.find((path) => path.endsWith('.jpg'))!,
      ).metadata();
      expect(metadata.video).toEqual({
        originalDurationMs: 2000,
        fps: 2,
        resolution: { width: actual.width, height: actual.height },
      });
      expect(result.video).toEqual(metadata.video);
      expect(actual.width).toBe(240);
      expect(actual.height).toBe(320);
    },
    TIMEOUT,
  );

  it.each([0, 1])(
    'creates metadata for %i frames without throwing',
    async (count) => {
      const image = await sharp({
        create: { width: 101, height: 67, channels: 3, background: 'white' },
      })
        .jpeg()
        .toBuffer();
      const result = await extractScenes({
        mode: 'frames',
        inputFrames: Array.from({ length: count }, () => image),
      });
      expect(result.success).toBe(true);
      expect(result.outputBuffers).toHaveLength(count);
      expect(result.video).toEqual({
        originalDurationMs: 0,
        fps: 1,
        resolution: count
          ? { width: 101, height: 67 }
          : { width: 0, height: 0 },
      });
      expect(result.animations).toEqual([]);
    },
  );

  it.each([2, 7])(
    'strictly caps a ten-second video at %i candidates',
    async (maxFrames) => {
      const inputPath = join(testDir, `budget-${maxFrames}.mp4`);
      const outputPath = join(testDir, `budget-${maxFrames}-output`);
      await createTestVideo(inputPath, 10);
      const result = await extractScenes({
        mode: 'file',
        inputPath,
        outputPath,
        maxFrames,
        count: maxFrames,
        threshold: 0.001,
        fps: 5,
        scale: 320,
      });
      expect(result.originalFramesCount).toBe(maxFrames);
      const metadata = JSON.parse(
        await readFile(join(outputPath, '.metadata.json'), 'utf8'),
      );
      expect(
        Math.abs(
          metadata.frames[metadata.frames.length - 1].timestampMs / 1000 -
            (10 * (maxFrames - 1)) / maxFrames,
        ),
      ).toBeLessThan(0.05);
    },
    TIMEOUT,
  );

  it(
    'processes a test video and returns scene files',
    async () => {
      const videoExists = await fileExists(testVideoPath);
      if (!videoExists) {
        console.warn('Test video not found, skipping E2E test');
        return;
      }

      const outputPath = join(testDir, 'e2e_output');
      const result = await extractScenes({
        mode: 'file',
        inputPath: testVideoPath,
        outputPath,
        count: 3,
        fps: 5,
        scale: 320,
      });

      expect(result.success).toBe(true);
      expect(result.originalFramesCount).toBeGreaterThan(0);
      expect(result.prunedFramesCount).toBeGreaterThan(0);
      expect(result.prunedFramesCount).toBeLessThanOrEqual(3);
      expect(result.outputFiles.length).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);

      // Verify output files exist
      for (const filePath of result.outputFiles) {
        expect(await fileExists(filePath)).toBe(true);
      }
    },
    TIMEOUT,
  );

  it(
    'buffer mode returns outputBuffers instead of outputFiles',
    async () => {
      const videoExists = await fileExists(testVideoPath);
      if (!videoExists) {
        console.warn('Test video not found, skipping buffer mode E2E test');
        return;
      }

      const { readFile } = await import('node:fs/promises');
      const videoBuffer = await readFile(testVideoPath);

      const result = await extractScenes({
        mode: 'buffer',
        inputBuffer: videoBuffer,
        count: 2,
        fps: 5,
        scale: 320,
      });

      expect(result.success).toBe(true);
      expect(result.outputBuffers).toBeDefined();
      expect(result.outputBuffers!.length).toBeGreaterThan(0);
      expect(result.outputFiles).toHaveLength(0);
    },
    TIMEOUT,
  );
});
