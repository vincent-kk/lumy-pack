import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveOptions, resolveInput } from '../../core/input-resolver.js';
import * as workspace from '../../core/workspace.js';

vi.mock('../../core/workspace.js', () => ({
  writeInputBuffer: vi.fn(),
  writeInputFrames: vi.fn(),
}));

vi.mock('../../utils/paths.js', () => ({
  deriveOutputPath: vi.fn().mockReturnValue('/output/scenes'),
}));

describe('resolveOptions', () => {
  it('file mode: 기본값 적용 (count=5, fps=5, scale=720, debug=false)', () => {
    const result = resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(result.count).toBe(5);
    expect(result.fps).toBe(5);
    expect(result.scale).toBe(720);
    expect(result.debug).toBe(false);
  });

  it('file mode: outputPath 미지정 시 deriveOutputPath 호출', async () => {
    const { deriveOutputPath } = await import('../../utils/paths.js');
    resolveOptions({ mode: 'file', inputPath: '/video.mp4' });
    expect(deriveOutputPath).toHaveBeenCalledWith('/video.mp4');
  });

  it('buffer mode: outputPath는 빈 문자열이 아님 (process.cwd() 기반 폴백)', () => {
    const result = resolveOptions({ mode: 'buffer', inputBuffer: Buffer.from('') });
    expect(result.outputPath).toBeTruthy();
    expect(typeof result.outputPath).toBe('string');
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

describe('resolveInput', () => {
  beforeEach(() => {
    vi.mocked(workspace.writeInputBuffer).mockResolvedValue('/tmp/mock-input.mp4');
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
    const { writeInputBuffer } = await import('../../core/workspace.js');
    const buf = Buffer.from('video-data');
    await resolveInput({ mode: 'buffer', inputBuffer: buf }, '/workspace');
    expect(writeInputBuffer).toHaveBeenCalledWith(buf, '/workspace');
  });

  it('frames mode: writeInputFrames 호출', async () => {
    const { writeInputFrames } = await import('../../core/workspace.js');
    const frames = [Buffer.from('frame1'), Buffer.from('frame2')];
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
      { mode: 'frames', inputFrames: [Buffer.from('f')] },
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
      { mode: 'frames', inputFrames: [Buffer.from('f')] },
      '/ws',
    );
    expect(result.resolvedInputPath).toBeUndefined();
  });
});
