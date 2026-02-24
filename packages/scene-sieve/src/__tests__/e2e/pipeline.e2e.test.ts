import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { fileExists } from '../../utils/paths.js';
import { extractScenes } from '../../index.js';

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

async function createTestVideo(outputPath: string): Promise<void> {
  const { default: ffmpegStatic } = await import('ffmpeg-static');
  if (!ffmpegStatic) throw new Error('ffmpeg-static not available');

  // Generate a 2-second test video: 5 frames at 320x240 with color changes
  await execAsync(
    `"${ffmpegStatic}" -y -f lavfi -i "color=c=red:size=320x240:rate=5:duration=0.4,color=c=blue:size=320x240:rate=5:duration=0.4,color=c=green:size=320x240:rate=5:duration=0.4,color=c=yellow:size=320x240:rate=5:duration=0.4,color=c=purple:size=320x240:rate=5:duration=0.4" -vf "fps=5,scale=320:240" -t 2 "${outputPath}" 2>&1 || true`,
  );

  // Simpler approach: generate a 2-second solid color video
  await execAsync(
    `"${ffmpegStatic}" -y -f lavfi -i "testsrc=size=320x240:rate=5" -t 2 "${outputPath}"`,
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
