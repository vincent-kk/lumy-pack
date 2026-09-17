import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveInput } from '../../core/input-resolver/input-resolver.js';
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
