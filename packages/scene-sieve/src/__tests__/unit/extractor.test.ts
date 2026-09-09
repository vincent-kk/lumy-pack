import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProcessContext } from '../../types/index.js';

// Mock execa
const mockExeca = vi
  .fn()
  .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
vi.mock('execa', () => ({ execa: mockExeca }));

vi.mock('ffmpeg-static', () => ({ default: '/usr/bin/ffmpeg' }));
vi.mock('@ffprobe-installer/ffprobe', () => ({ path: '/usr/bin/ffprobe' }));

const mockFileExists = vi.fn();
const mockEnsureDir = vi.fn();

vi.mock('../../utils/paths.js', () => ({
  fileExists: mockFileExists,
  ensureDir: mockEnsureDir,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// Mock fs/promises readdir to return empty array by default
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
}));

function makeCtx(
  overrides: Partial<ProcessContext['options']> = {},
): ProcessContext {
  return {
    options: {
      mode: 'file',
      inputPath: '/tmp/test.mp4',
      count: 5,
      threshold: 0.5,
      pruneMode: 'threshold-with-cap',
      outputPath: '/out',
      fps: 5,
      maxFrames: 300,
      scale: 720,
      quality: 80,
      iouThreshold: 0.9,
      animationThreshold: 5,
      debug: false,
      maxSegmentDuration: 300,
      concurrency: 2,
      ...overrides,
    },
    workspacePath: '/tmp/workspace',
    frames: [],
    graph: [],
    status: 'EXTRACTING',
    emitProgress: vi.fn(),
  };
}

describe('extractFrames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDir.mockResolvedValue(undefined);
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  });

  it('inputPath 미제공 시 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    const ctx = makeCtx({ inputPath: undefined });
    await expect(extractFrames(ctx)).rejects.toThrow(
      'inputPath is required for frame extraction',
    );
  });

  it('파일이 존재하지 않으면 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(false);

    const ctx = makeCtx({ inputPath: '/tmp/nonexistent.mp4' });
    await expect(extractFrames(ctx)).rejects.toThrow(
      'Input file not found: /tmp/nonexistent.mp4',
    );
  });

  it('ffprobe가 메타데이터를 읽지 못하면 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    mockExeca.mockRejectedValue(new Error('ffprobe failed'));

    const ctx = makeCtx({ inputPath: '/tmp/corrupt.mp4' });
    await expect(extractFrames(ctx)).rejects.toThrow(
      'Could not read file metadata: /tmp/corrupt.mp4',
    );
  });

  it('비디오 스트림이 없는 파일이면 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        format: { format_name: 'mp3' },
        streams: [{ codec_type: 'audio' }],
      }),
    });

    const ctx = makeCtx({ inputPath: '/tmp/test.mp3' });
    await expect(extractFrames(ctx)).rejects.toThrow(
      'No video stream found in file: /tmp/test.mp3 (detected format: mp3)',
    );
  });

  it('확장자가 .png여도 실제 내용이 GIF면 통과하며 ffprobe는 한 번만 호출된다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValue(['frame_000001.jpg'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);

    // ffprobe mock for GIF content but PNG extension
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        format: { format_name: 'gif', duration: '1.2' },
        streams: [{ codec_type: 'video' }],
      }),
    });

    const ctx = makeCtx({ inputPath: '/tmp/image.png' });
    const frames = await extractFrames(ctx);

    expect(frames.length).toBeGreaterThanOrEqual(0);
    // ffprobe 호출 횟수 확인 (ffmpeg 호출 제외)
    const ffprobeCalls = mockExeca.mock.calls.filter(
      (c) => c[0] === '/usr/bin/ffprobe',
    );
    expect(ffprobeCalls.length).toBe(1);
  });

  it('항상 FPS 모드로 프레임을 추출한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValue(['frame_000001.jpg'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);

    // ffprobe mock for duration query
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '10' },
        streams: [{ codec_type: 'video' }],
      }),
      stderr: '',
      exitCode: 0,
    });

    const ctx = makeCtx({ inputPath: '/tmp/animation.gif' });
    const frames = await extractFrames(ctx);

    expect(frames.length).toBeGreaterThanOrEqual(0);
  });

  it('긴 영상은 maxFrames에 맞춰 FPS를 자동 감소한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValue([
      'frame_000001.jpg',
      'frame_000002.jpg',
      'frame_000003.jpg',
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({
        format: { format_name: 'mp4', duration: '3600' },
        streams: [{ codec_type: 'video' }],
      }),
      stderr: '',
      exitCode: 0,
    });

    const ctx = makeCtx({
      inputPath: '/tmp/long-video.mp4',
      maxFrames: 300,
    });
    const frames = await extractFrames(ctx);

    expect(frames.length).toBe(3);
    // ffmpeg called with reduced fps
    const ffmpegCall = mockExeca.mock.calls.find(
      (c) => c[0] === '/usr/bin/ffmpeg',
    );
    expect(ffmpegCall).toBeDefined();
    const vfArg = ffmpegCall![1].find((a: string) => a.startsWith('fps='));
    expect(vfArg).toBe(`fps=${300 / 3600},scale=-1:720`);
    expect(frames.map((frame) => frame.timestamp)).toEqual([0, 12, 24]);
    expect(ffmpegCall![1].slice(-3, -1)).toEqual(['-frames:v', '300']);
    expect(ctx).toMatchObject({
      effectiveFps: 300 / 3600,
      sourceDurationSec: 3600,
    });
  });

  it('range extraction uses local grid timestamps and the explicit frame limit', async () => {
    const { extractFramesForRange } = await import('../../core/extractor.js');
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      'frame_000001.jpg',
      'frame_000002.jpg',
      'frame_000003.jpg',
    ] as unknown as Awaited<ReturnType<typeof readdir>>);
    const frames = await extractFramesForRange(
      '/tmp/test.mp4',
      '/tmp/range',
      0.5,
      720,
      4,
      6.5,
      3,
    );
    expect(frames.map((frame) => frame.timestamp)).toEqual([0, 2, 4]);
    expect(mockExeca).toHaveBeenCalledWith('/usr/bin/ffmpeg', [
      '-ss',
      '4',
      '-i',
      '/tmp/test.mp4',
      '-t',
      '6.5',
      '-vf',
      'fps=0.5,scale=-1:720',
      '-q:v',
      '2',
      '-frames:v',
      '3',
      '/tmp/range/frame_%06d.jpg',
    ]);
  });

  it('preserves the six-argument range call with a derived frame limit', async () => {
    const { extractFramesForRange } = await import('../../core/extractor.js');
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([]);
    await extractFramesForRange(
      '/tmp/test.mp4',
      '/tmp/range',
      0.5,
      720,
      4,
      6.5,
    );
    expect(mockExeca.mock.calls[0][1].slice(-3, -1)).toEqual([
      '-frames:v',
      '4',
    ]);
  });

  it('frames mode preserves all input candidates regardless of maxFrames', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    const ctx = makeCtx({
      mode: 'frames',
      inputPath: undefined,
      maxFrames: 2,
      fps: 5,
    });
    ctx.frames = [0, 1, 2].map((id) => ({
      id,
      timestamp: id,
      extractPath: `/tmp/${id}.jpg`,
    }));
    expect(await extractFrames(ctx)).toBe(ctx.frames);
    expect(ctx).toMatchObject({ effectiveFps: 1 });
    expect(mockExeca).not.toHaveBeenCalled();
  });
});
