import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { analyzeFrames } from '../../core/analyzer.js';
import type { ProcessContext } from '../../types/index.js';
import { createCheckerboardPixels } from '../helpers/checkerboard-pixels.js';

/** Embind handles expose their ownership state independently of their container. */
interface NativeHandle {
  /** Whether delete has released this JavaScript handle. */
  isDeleted(): boolean;
  /** Release the handle when assertion cleanup finds it still alive. */
  delete(): void;
}

/** Vitest hooks initialize and clean up the shared real-WASM fixture. */
let ctx: ProcessContext;
/** CJS loading shares analyzer's OpenCV instance without Vite transforming WASM. */
const cv = createRequire(import.meta.url)(
  '@techstark/opencv-js',
) as typeof import('@techstark/opencv-js');

beforeAll(async () => {
  const testDir = await mkdtemp(join(tmpdir(), 'scene-sieve-native-lifetime-'));
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

  for (let index = 0; index < 6; index++) {
    const pixels =
      index < 4
        ? createCheckerboardPixels(index)
        : Buffer.alloc(320 * 240, (index - 4) * 255);
    const extractPath = join(testDir, `frame-${index}.jpg`);
    await sharp(pixels, { raw: { width: 320, height: 240, channels: 1 } })
      .jpeg()
      .toFile(extractPath);
    ctx.frames.push({ id: index, timestamp: index / 5, extractPath });
  }

  await analyzeFrames({ ...ctx, frames: ctx.frames.slice(4) });
}, 60_000);

afterAll(async () => {
  if (ctx) await rm(ctx.workspacePath, { recursive: true, force: true });
});

describe('analyzer native handle lifetime', () => {
  it('deletes matching and contour handles after each of two identical analyses', async () => {
    const pairs: NativeHandle[] = [];
    const contours: NativeHandle[] = [];
    const pairGet = cv.DMatchVectorVector.prototype.get;
    const contourGet = cv.MatVector.prototype.get;
    vi.spyOn(cv.DMatchVectorVector.prototype, 'get').mockImplementation(
      function (this: InstanceType<typeof cv.DMatchVectorVector>, index) {
        const pair = pairGet.call(this, index);
        pairs.push(pair as unknown as NativeHandle);
        return pair;
      },
    );
    vi.spyOn(cv.MatVector.prototype, 'get').mockImplementation(function (
      this: InstanceType<typeof cv.MatVector>,
      index,
    ) {
      const contour = contourGet.call(this, index);
      contours.push(contour as unknown as NativeHandle);
      return contour;
    });

    try {
      let previous: Awaited<ReturnType<typeof analyzeFrames>> | undefined;
      for (let run = 1; run <= 2; run++) {
        const pairStart = pairs.length;
        const contourStart = contours.length;
        const result = await analyzeFrames(ctx);
        expect(pairs.length - pairStart).toBeGreaterThan(0);
        expect(contours.length - contourStart).toBeGreaterThan(0);
        expect
          .soft(
            pairs.slice(pairStart).filter((handle) => !handle.isDeleted())
              .length,
            `run ${run}: live DMatchVector handles`,
          )
          .toBe(0);
        expect
          .soft(
            contours.slice(contourStart).filter((handle) => !handle.isDeleted())
              .length,
            `run ${run}: live contour Mat handles`,
          )
          .toBe(0);
        if (previous) expect(result).toEqual(previous);
        previous = result;
      }
    } finally {
      vi.restoreAllMocks();
      for (const handle of [...pairs, ...contours]) {
        if (!handle.isDeleted()) handle.delete();
      }
    }
  });

  it.each([1, 2, 3, 6, 7, 8, 12])(
    'releases allocations when Mat construction %i throws once',
    async (failAt) => {
      const handles: NativeHandle[] = [];
      const originals = {
        Mat: cv.Mat,
        KeyPointVector: cv.KeyPointVector,
        AKAZE: cv.AKAZE,
        MatVector: cv.MatVector,
      };
      const injected = new Error('injected Mat allocation failure');
      let matCalls = 0;
      let failures = 0;
      for (const name of Object.keys(originals) as Array<
        keyof typeof originals
      >) {
        Object.defineProperty(cv, name, {
          configurable: true,
          writable: true,
          value: new Proxy(originals[name], {
            construct(target, args) {
              if (name === 'Mat' && ++matCalls === failAt) {
                failures++;
                throw injected;
              }
              const handle = Reflect.construct(target, args) as NativeHandle;
              handles.push(handle);
              return handle;
            },
          }),
        });
      }

      try {
        try {
          const result = await analyzeFrames({
            ...ctx,
            frames: ctx.frames.slice(4),
          });
          expect(result.edges).toEqual([
            { sourceId: 4, targetId: 5, score: 0 },
          ]);
        } catch (error) {
          expect(error).toBe(injected);
        }
        expect(failures).toBe(1);
        if (failAt > 1) expect(handles.length).toBeGreaterThan(0);
        expect(
          handles.filter((handle) => !handle.isDeleted()).length,
          `Mat call ${failAt}: live allocated handles`,
        ).toBe(0);
      } finally {
        Object.assign(cv, originals);
        for (const handle of handles) {
          if (!handle.isDeleted()) handle.delete();
        }
      }
    },
  );
});
