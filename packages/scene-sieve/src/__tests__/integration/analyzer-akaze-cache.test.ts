import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { analyzeFrames, preprocessFrame } from '../../core/analyzer.js';
import type { ProcessContext } from '../../types/index.js';
import { createCheckerboardPixels } from '../helpers/checkerboard-pixels.js';

vi.mock('sharp', async (importOriginal) => {
  const original = await importOriginal<{ default: typeof sharp }>();
  return { ...original, default: vi.fn(original.default) };
});

/** Vitest hooks own the temporary frame fixtures and their cleanup. */
let ctx: ProcessContext;
/** CJS shares the analyzer runtime without Vite transforming the WASM module. */
const cv = createRequire(import.meta.url)(
  '@techstark/opencv-js',
) as typeof import('@techstark/opencv-js');

beforeAll(async () => {
  const testDir = await mkdtemp(join(tmpdir(), 'scene-sieve-akaze-cache-'));
  ctx = {
    options: {
      mode: 'file',
      count: 6,
      threshold: 0.5,
      pruneMode: 'threshold-with-cap',
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
    frames: [],
    graph: [],
    status: 'ANALYZING',
    emitProgress: () => {},
  };
  for (let index = 0; index < 25; index++) {
    const pixels =
      index < 23
        ? createCheckerboardPixels(index)
        : Buffer.alloc(320 * 240, (index - 23) * 255);
    const extractPath = join(testDir, `frame-${index}.jpg`);
    await sharp(pixels, { raw: { width: 320, height: 240, channels: 1 } })
      .jpeg()
      .toFile(extractPath);
    ctx.frames.push({ id: index, timestamp: index / 5, extractPath });
  }
  await analyzeFrames({ ...ctx, frames: ctx.frames.slice(23) });
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (ctx) await rm(ctx.workspacePath, { recursive: true, force: true });
});

describe('analyzer AKAZE frame cache', () => {
  it('detects exactly once per frame across two batch boundaries', async () => {
    const detect = vi.spyOn(cv.AKAZE.prototype, 'detectAndCompute');
    const result = await analyzeFrames({
      ...ctx,
      frames: ctx.frames.slice(0, 23),
    });
    expect(result.edges).toHaveLength(22);
    expect(detect).toHaveBeenCalledTimes(23);
  });

  it('preprocesses exactly once per frame across two batch boundaries', async () => {
    vi.mocked(sharp).mockClear();
    await analyzeFrames({ ...ctx, frames: ctx.frames.slice(0, 23) });
    expect(sharp).toHaveBeenCalledTimes(23);
  });

  it('produces identical keypoints and descriptors with reused and separate detectors', async () => {
    const { computeFrameFeatures } =
      await import('../../core/frame-features.js');
    const frame = await preprocessFrame(ctx.frames[0].extractPath, 320);
    const first = new cv.AKAZE();
    const second = new cv.AKAZE();
    const features: ReturnType<typeof computeFrameFeatures>[] = [];
    try {
      features.push(computeFrameFeatures(cv, first, frame));
      features.push(computeFrameFeatures(cv, first, frame));
      features.push(computeFrameFeatures(cv, second, frame));
      const snapshots = features.map((feature) => ({
        points: Array.from({ length: feature.keypoints.size() }, (_, i) => {
          const { x, y } = feature.keypoints.get(i).pt;
          return { x, y };
        }),
        bytes: Array.from(feature.descriptors.data),
      }));
      expect(snapshots[0].points.length).toBeGreaterThan(0);
      expect(snapshots[0].bytes.length).toBeGreaterThan(0);
      expect(snapshots[1]).toEqual(snapshots[0]);
      expect(snapshots[2]).toEqual(snapshots[0]);
      for (const feature of features) {
        expect(feature.descriptors.rows).toBe(feature.keypoints.size());
        expect([feature.width, feature.height]).toEqual([320, 240]);
        feature.delete();
        expect(feature.descriptors.isDeleted()).toBe(true);
      }
    } finally {
      for (const feature of features) feature.delete();
      first.delete();
      second.delete();
    }
  });

  it('returns no new points for flat frames and runs the pixel fallback', async () => {
    const { computeFrameFeatures } =
      await import('../../core/frame-features.js');
    const { computeNewPoints } = await import('../../core/feature-diff.js');
    const detector = new cv.AKAZE();
    const features: ReturnType<typeof computeFrameFeatures>[] = [];
    try {
      for (const frame of ctx.frames.slice(23)) {
        features.push(
          computeFrameFeatures(
            cv,
            detector,
            await preprocessFrame(frame.extractPath, 320),
          ),
        );
      }
      expect(features.map((feature) => feature.descriptors.rows)).toEqual([
        0, 0,
      ]);
      const match = vi.spyOn(cv.BFMatcher.prototype, 'knnMatch');
      expect(computeNewPoints(cv, features[0], features[1])).toEqual([]);
      expect(match).not.toHaveBeenCalled();
      const contours = vi.spyOn(cv.MatVector.prototype, 'get');
      const result = await analyzeFrames({
        ...ctx,
        frames: ctx.frames.slice(23),
      });
      expect(contours.mock.calls.length).toBeGreaterThan(0);
      expect(result.edges[0].score).toBeGreaterThan(0);
    } finally {
      for (const feature of features) feature.delete();
      detector.delete();
    }
  });

  it.each(['progress', 'preprocessing'] as const)(
    'releases the boundary features and detector when %s interrupts batches',
    async (failure) => {
      const descriptors: InstanceType<typeof cv.Mat>[] = [];
      const detectors: Array<
        InstanceType<typeof cv.AKAZE> & {
          /** Inspect the real Embind ownership state after analysis stops. */
          isDeleted(): boolean;
        }
      > = [];
      const detect = cv.AKAZE.prototype.detectAndCompute;
      vi.spyOn(cv.AKAZE.prototype, 'detectAndCompute').mockImplementation(
        function (
          this: (typeof detectors)[number],
          image,
          mask,
          keypoints,
          descriptor,
        ) {
          if (!detectors.includes(this)) detectors.push(this);
          descriptors.push(descriptor);
          return detect.call(this, image, mask, keypoints, descriptor);
        },
      );
      const injected = new Error('injected progress failure');
      const frames = ctx.frames
        .slice(0, 23)
        .map((frame, index) =>
          failure === 'preprocessing' && index === 11
            ? { ...frame, extractPath: join(ctx.workspacePath, 'missing.jpg') }
            : frame,
        );
      try {
        const analysis = analyzeFrames({
          ...ctx,
          frames,
          emitProgress: () => {
            if (failure === 'progress') throw injected;
          },
        });
        await expect(analysis).rejects.toThrow(
          failure === 'progress' ? injected : /missing.jpg/,
        );
        expect(descriptors).toHaveLength(11);
        expect(detectors).toHaveLength(1);
        expect(descriptors.every((descriptor) => descriptor.isDeleted())).toBe(
          true,
        );
        expect(detectors.every((detector) => detector.isDeleted())).toBe(true);
      } finally {
        for (const handle of [...descriptors, ...detectors]) {
          if (!handle.isDeleted()) handle.delete();
        }
      }
    },
  );
});
