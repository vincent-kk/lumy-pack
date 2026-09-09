import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveInput, resolveOptions } from '../../core/input-resolver/input-resolver.js';
import * as workspace from '../../core/workspace/workspace.js';
import { classifyError } from '../../cli/errors/classify-error.js';

/** Create an encoded frame with the requested width for input validation. */
async function image(width = 32): Promise<Buffer> {
  return sharp({
    create: { width, height: 32, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
}

vi.mock('../../core/workspace/workspace.js', () => ({
  writeInputBuffer: vi.fn(),
  writeInputFrames: vi.fn(),
}));

vi.mock('../../core/utils/filesystem/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/utils/filesystem/paths.js')>();
  return {
    ...actual,
    deriveOutputPath: vi.fn().mockReturnValue('/output/scenes'),
  };
});

describe('resolveOptions', () => {
  it.each([
    ['threshold', NaN],
    ['maxFrames', 1],
    ['maxSegmentDuration', 0],
    ['concurrency', 0],
    ['fps', Infinity],
    ['count', 1.5],
    ['scale', 15],
    ['quality', 101],
    ['iouThreshold', -0.1],
    ['animationThreshold', 0],
  ])('rejects %s=%s as INVALID_INPUT', (name, value) => {
    const resolve = () =>
      resolveOptions({ mode: 'frames', inputFrames: [], [name]: value });
    expect(resolve).toThrow(`${name} must be`);
    try {
      resolve();
    } catch (error) {
      expect((error as Error).message).toContain(`received: ${value}`);
      expect(classifyError(error as Error)).toBe('INVALID_INPUT');
    }
  });

  it('accepts inclusive limits and positive fractional rates', () => {
    expect(() =>
      resolveOptions({
        mode: 'frames',
        inputFrames: [],
        count: 1,
        threshold: 1,
        fps: 0.5,
        maxFrames: 2,
        scale: 16,
        quality: 1,
        iouThreshold: 0,
        animationThreshold: 1,
        maxSegmentDuration: 0.5,
        concurrency: 1,
      }),
    ).not.toThrow();
  });
  it('file mode: 기본값 적용 (count=20, threshold=0.5, fps=5, scale=720, debug=false)', () => {
    const result = resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(result.count).toBe(20);
    expect(result.threshold).toBe(0.5);
    expect(result.fps).toBe(5);
    expect(result.scale).toBe(720);
    expect(result.debug).toBe(false);
    expect(result.pruneMode).toBe('threshold-with-cap');
  });

  it('file mode: outputPath 미지정 시 deriveOutputPath 호출', async () => {
    const { deriveOutputPath } = await import('../../core/utils/filesystem/paths.js');
    resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(deriveOutputPath).toHaveBeenCalledWith('/video.mp4');
  });

  it('buffer mode: outputPath는 빈 문자열이 아님 (process.cwd() 기반 폴백)', () => {
    const result = resolveOptions({
      mode: 'buffer',
      inputBuffer: Buffer.from(''),
    });
    expect(result.outputPath).toBeTruthy();
    expect(typeof result.outputPath).toBe('string');
  });

  it('threshold가 올바르게 전달됨', () => {
    const result = resolveOptions({
      mode: 'file',
      inputPath: '/video.mp4',
      threshold: 0.5,
    });
    expect(result.threshold).toBe(0.5);
  });

  it('threshold 범위 밖이면 에러 (0 이하 또는 1 초과)', () => {
    expect(() =>
      resolveOptions({ mode: 'file', inputPath: '/video.mp4', threshold: 0 }),
    ).toThrow('threshold must be in range (0, 1]');

    expect(() =>
      resolveOptions({
        mode: 'file',
        inputPath: '/video.mp4',
        threshold: -0.1,
      }),
    ).toThrow('threshold must be in range (0, 1]');

    expect(() =>
      resolveOptions({ mode: 'file', inputPath: '/video.mp4', threshold: 1.5 }),
    ).toThrow('threshold must be in range (0, 1]');
  });

  it('threshold=1.0은 유효 (최대 변화만 추출)', () => {
    const result = resolveOptions({
      mode: 'file',
      inputPath: '/video.mp4',
      threshold: 1.0,
    });
    expect(result.threshold).toBe(1.0);
  });

  it('threshold 미지정 시 기본값 0.5 적용', () => {
    const result = resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(result.threshold).toBe(0.5);
    expect(result.count).toBe(20);
  });

  it('커스텀 값이 올바르게 반영됨', () => {
    const result = resolveOptions({
      mode: 'file',
      inputPath: '/video.mp4',
      count: 10,
      fps: 2,
      scale: 480,
      debug: true,
      outputPath: '/custom/output',
    });
    expect(result.count).toBe(10);
    expect(result.fps).toBe(2);
    expect(result.scale).toBe(480);
    expect(result.debug).toBe(true);
    expect(result.outputPath).toBe('/custom/output');
  });
});

describe('resolveOptions - pruneMode', () => {
  it('항상 threshold-with-cap 모드로 동작한다', () => {
    const result = resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(result.pruneMode).toBe('threshold-with-cap');
  });

  it('count 지정 시에도 threshold-with-cap 모드', () => {
    const result = resolveOptions({
      mode: 'file',
      inputPath: '/video.mp4',
      count: 10,
    });
    expect(result.pruneMode).toBe('threshold-with-cap');
    expect(result.count).toBe(10);
  });

  it('threshold 지정 시에도 threshold-with-cap 모드', () => {
    const result = resolveOptions({
      mode: 'file',
      inputPath: '/video.mp4',
      threshold: 0.7,
    });
    expect(result.pruneMode).toBe('threshold-with-cap');
    expect(result.threshold).toBe(0.7);
  });

  it('아무것도 지정하지 않으면: 기본값 threshold=0.5, count=20', () => {
    const result = resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(result.pruneMode).toBe('threshold-with-cap');
    expect(result.threshold).toBe(0.5);
    expect(result.count).toBe(20);
  });
});

describe('resolveInput', () => {
  beforeEach(() => {
    vi.mocked(workspace.writeInputBuffer).mockResolvedValue(
      '/tmp/mock-input.mp4',
    );
    vi.mocked(workspace.writeInputFrames).mockResolvedValue([
      { id: 0, timestamp: 0, extractPath: '/tmp/frame_000000.jpg' },
    ]);
  });

  it('file mode: frames=[], resolvedInputPath=inputPath 반환', async () => {
    const result = await resolveInput(
      { mode: 'file', inputPath: '/video.mp4' },
      '/workspace',
    );
    expect(result.frames).toEqual([]);
    expect(result.resolvedInputPath).toBe('/video.mp4');
  });

  it('buffer mode: writeInputBuffer 호출', async () => {
    const { writeInputBuffer } = await import('../../core/workspace/workspace.js');
    const buf = Buffer.from('video-data');
    await resolveInput({ mode: 'buffer', inputBuffer: buf }, '/workspace');
    expect(writeInputBuffer).toHaveBeenCalledWith(buf, '/workspace');
  });

  it('frames mode: writeInputFrames 호출', async () => {
    const { writeInputFrames } = await import('../../core/workspace/workspace.js');
    const frames = [await image(), await image()];
    await resolveInput({ mode: 'frames', inputFrames: frames }, '/workspace');
    expect(writeInputFrames).toHaveBeenCalledWith(frames, '/workspace');
  });

  it('file mode 반환 구조: frames 배열, resolvedInputPath 문자열', async () => {
    const result = await resolveInput(
      { mode: 'file', inputPath: '/input.mp4' },
      '/ws',
    );
    expect(Array.isArray(result.frames)).toBe(true);
    expect(typeof result.resolvedInputPath).toBe('string');
  });

  it('buffer mode 반환 구조: resolvedInputPath가 writeInputBuffer 반환값', async () => {
    const result = await resolveInput(
      { mode: 'buffer', inputBuffer: Buffer.from('') },
      '/ws',
    );
    expect(result.resolvedInputPath).toBe('/tmp/mock-input.mp4');
    expect(result.frames).toEqual([]);
  });

  it('frames mode 반환 구조: frames 배열에 FrameNode 포함', async () => {
    const result = await resolveInput(
      { mode: 'frames', inputFrames: [await image()] },
      '/ws',
    );
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]).toMatchObject({
      id: 0,
      timestamp: 0,
      extractPath: '/tmp/frame_000000.jpg',
    });
  });

  it('frames mode: resolvedInputPath 없음 (undefined)', async () => {
    const result = await resolveInput(
      { mode: 'frames', inputFrames: [await image()] },
      '/ws',
    );
    expect(result.resolvedInputPath).toBeUndefined();
  });

  it('rejects mismatched frame dimensions as INVALID_INPUT before writing', async () => {
    vi.mocked(workspace.writeInputFrames).mockClear();
    const result = resolveInput(
      { mode: 'frames', inputFrames: [await image(), await image(33)] },
      '/ws',
    );
    await expect(result).rejects.toThrow('inputFrames must be');
    await result.catch((error: Error) => {
      expect(error.message).toContain('received:');
      expect(classifyError(error)).toBe('INVALID_INPUT');
    });
    expect(workspace.writeInputFrames).not.toHaveBeenCalled();
  });
});
