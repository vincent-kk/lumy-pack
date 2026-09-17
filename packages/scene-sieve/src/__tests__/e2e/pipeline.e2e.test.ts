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
import { PACKAGE_VERSION } from '../../constants/package-version.js';
import type { SieveMetadata } from '../../types/index.js';

const execAsync = promisify(exec);

const TIMEOUT = 120_000;

let testDir: string;
let testVideoPath: string;
let metadataVideoPath: string;

/** Shared four-second v2 fixture settings, with enough selections to sample a sheet. */
const metadataOptions = { fps: 5, maxFrames: 12, count: 6, threshold: 0.001, scale: 320 };

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
  metadataVideoPath = join(testDir, 'metadata_input.mp4');
  await createTestVideo(metadataVideoPath, 4);
}, TIMEOUT);

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('metadata v2 E2E', () => {
  it('writes identical v2 bytes on repeated runs and omits optional keys by default', async () => {
    const bytes: Buffer[] = [];
    for (const suffix of ['a', 'b']) {
      const outputPath = join(testDir, `v2-repeat-${suffix}`);
      await extractScenes({ mode: 'file', inputPath: metadataVideoPath, outputPath, ...metadataOptions });
      bytes.push(await readFile(join(outputPath, '.metadata.json')));
    }
    expect(bytes[0].equals(bytes[1])).toBe(true);
    const doc: SieveMetadata = JSON.parse(bytes[0].toString());
    expect(doc.metadataVersion).toBe(2);
    expect(doc.tool.params).toBeDefined();
    expect(doc.frames.length).toBeGreaterThanOrEqual(2);
    expect(doc.frames[1].change).not.toBeNull();
    expect('edges' in doc).toBe(false);
    expect('sheet' in doc).toBe(false);
  });

  it('writes identical v2 bytes with four segments at concurrency one and two', async () => {
    const bytes: Buffer[] = [];
    for (const concurrency of [1, 2]) {
      const outputPath = join(testDir, `v2-concurrency-${concurrency}`);
      await extractScenes({ mode: 'file', inputPath: metadataVideoPath, outputPath, ...metadataOptions, maxSegmentDuration: 1, concurrency });
      bytes.push(await readFile(join(outputPath, '.metadata.json')));
    }
    expect(bytes[0].equals(bytes[1])).toBe(true);
    for (const buffer of bytes) {
      const doc: SieveMetadata = JSON.parse(buffer.toString());
      expect(doc.metadataVersion).toBe(2);
      expect(doc.frames.length).toBeGreaterThanOrEqual(2);
      expect(doc.frames[1].change!.fromFrameId).toBe(doc.frames[0].frameId);
    }
  });

  it('preserves timing, change geometry, provenance and API frame equality', async () => {
    const outputPath = join(testDir, 'v2-invariants');
    const result = await extractScenes({ mode: 'file', inputPath: metadataVideoPath, outputPath, ...metadataOptions });
    const doc: SieveMetadata = JSON.parse(await readFile(join(outputPath, '.metadata.json'), 'utf8'));
    expect(doc.metadataVersion).toBe(2);
    expect(doc.tool.name).toBe('@lumy-pack/scene-sieve');
    expect(doc.tool.version).toBe(PACKAGE_VERSION);
    expect(Object.keys(doc.tool.params)).toEqual(['fps', 'count', 'threshold', 'scale', 'quality', 'maxFrames', 'iouThreshold', 'animationThreshold', 'maxSegmentDuration']);
    expect(doc.tool.params.fps).toBe(5);
    expect(doc.video.fps).toBe(3);
    expect(doc.video.candidatesCount).toBe(result.originalFramesCount);
    expect(doc.video.selectedCount).toBe(result.prunedFramesCount);
    expect(doc.video.source).toEqual({ fileName: 'metadata_input.mp4', mode: 'file' });
    expect(result.frames).toEqual(doc.frames);
    expect(doc.frames[0].change).toBeNull();
    for (let i = 1; i < doc.frames.length; i++) {
      const frame = doc.frames[i];
      const change = frame.change!;
      expect(change.fromFrameId).toBe(doc.frames[i - 1].frameId);
      expect(change.skippedCandidates).toBe(frame.frameId - change.fromFrameId - 1);
      expect(change.areaRatio).toBeGreaterThanOrEqual(0);
      expect(change.areaRatio).toBeLessThanOrEqual(1);
      for (const box of change.regions) {
        expect(Object.values(box).every(Number.isInteger)).toBe(true);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(doc.video.resolution.width);
        expect(box.y + box.height).toBeLessThanOrEqual(doc.video.resolution.height);
      }
    }
    expect(doc.frames.reduce((sum, frame) => sum + frame.holdsMs, 0))
      .toBe(doc.video.originalDurationMs - doc.frames[0].timestampMs);
    expect('sheet' in result).toBe(false);
    expect('sheetBuffer' in result).toBe(false);
  });

  it.each([true, { maxTiles: 2 }])('writes the requested contact sheet %j', async (sheet) => {
    const outputPath = join(testDir, typeof sheet === 'boolean' ? 'v2-sheet' : 'v2-sheet-sampled');
    const result = await extractScenes({ mode: 'file', inputPath: metadataVideoPath, outputPath, ...metadataOptions, sheet });
    const doc: SieveMetadata = JSON.parse(await readFile(join(outputPath, '.metadata.json'), 'utf8'));
    const maxTiles = typeof sheet === 'boolean' ? 40 : 2;
    expect(result.outputFiles.slice(-2)).toEqual([join(outputPath, 'sheet.jpg'), join(outputPath, '.metadata.json')]);
    expect(await sharp(join(outputPath, 'sheet.jpg')).metadata()).toMatchObject({ format: 'jpeg' });
    expect(result.sheet).toEqual(doc.sheet);
    expect(doc.sheet!.frameIds).toHaveLength(Math.min(result.prunedFramesCount, maxTiles));
    expect(doc.sheet!.frameIds[0]).toBe(doc.frames[0].frameId);
    expect(doc.sheet!.frameIds.at(-1)).toBe(doc.frames.at(-1)!.frameId);
    if (typeof sheet !== 'boolean') {
      expect(doc.frames.length).toBeGreaterThan(2);
      expect(doc.sheet!.frameIds).toEqual([doc.frames[0].frameId, doc.frames.at(-1)!.frameId]);
      expect(doc.sheet!.sampled).toBe(true);
    }
    expect('sheetBuffer' in result).toBe(false);
  });

  it('includes every candidate edge only when requested', async () => {
    const outputPath = join(testDir, 'v2-edges');
    await extractScenes({ mode: 'file', inputPath: metadataVideoPath, outputPath, ...metadataOptions, includeEdges: true });
    const doc: SieveMetadata = JSON.parse(await readFile(join(outputPath, '.metadata.json'), 'utf8'));
    expect(doc.edges).toHaveLength(doc.video.candidatesCount - 1);
    for (const edge of doc.edges!) {
      expect(Object.keys(edge)).toEqual(['sourceFrameId', 'targetFrameId', 'score', 'areaRatio', 'animatedAreaRatio']);
    }
  });

  it('pairs in-memory frame buffers and returns JPEG sheet bytes', async () => {
    const result = await extractScenes({ mode: 'buffer', inputBuffer: await readFile(metadataVideoPath), ...metadataOptions, sheet: true });
    expect(result.frames).toHaveLength(result.outputBuffers!.length);
    expect(result.video!.source).toEqual({ fileName: null, mode: 'buffer' });
    expect(Buffer.isBuffer(result.sheetBuffer)).toBe(true);
    expect(result.sheetBuffer!.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(result.outputFiles).toEqual([]);
  });

  it('builds changes and a sheet for three frames and omits sheets for empty input', async () => {
    const inputFrames = await Promise.all(['red', 'green', 'blue'].map((background) =>
      sharp({ create: { width: 80, height: 60, channels: 3, background } }).jpeg().toBuffer()));
    const result = await extractScenes({ mode: 'frames', inputFrames, sheet: true, threshold: 0.001 });
    expect(result.frames!.length).toBeGreaterThanOrEqual(2);
    expect(result.frames![1].change).not.toBeNull();
    expect(result.video!.source).toEqual({ fileName: null, mode: 'frames' });
    expect(result.frames).toHaveLength(result.outputBuffers!.length);
    expect(result.sheetBuffer!.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    const empty = await extractScenes({ mode: 'frames', inputFrames: [], sheet: true });
    expect(empty.frames).toEqual([]);
    expect('sheet' in empty).toBe(false);
    expect('sheetBuffer' in empty).toBe(false);
  });
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
        candidatesCount: result.originalFramesCount,
        selectedCount: result.prunedFramesCount,
        source: { fileName: `portrait-${maxSegmentDuration}.mp4`, mode: 'file' },
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
        candidatesCount: count,
        selectedCount: count,
        source: { fileName: null, mode: 'frames' },
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
