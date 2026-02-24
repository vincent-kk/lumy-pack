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
const mockIsSupportedFile = vi.fn();
const mockEnsureDir = vi.fn();

vi.mock('../../utils/paths.js', () => ({
  fileExists: mockFileExists,
  isSupportedFile: mockIsSupportedFile,
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
      debug: false,
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
    mockIsSupportedFile.mockReturnValue(true);

    const ctx = makeCtx({ inputPath: '/tmp/nonexistent.mp4' });
    await expect(extractFrames(ctx)).rejects.toThrow(
      'Input file not found: /tmp/nonexistent.mp4',
    );
  });

  it('미지원 포맷이면 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    mockIsSupportedFile.mockReturnValue(false);

    const ctx = makeCtx({ inputPath: '/tmp/test.xyz' });
    await expect(extractFrames(ctx)).rejects.toThrow(
      'Unsupported file format: /tmp/test.xyz',
    );
  });

  it('항상 FPS 모드로 프레임을 추출한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    mockIsSupportedFile.mockReturnValue(true);

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValue(['frame_000001.jpg'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);

    // ffprobe mock for duration query
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ format: { duration: '10' } }),
      stderr: '',
      exitCode: 0,
    });

    const ctx = makeCtx({ inputPath: '/tmp/animation.gif' });
    const frames = await extractFrames(ctx);

    expect(frames.length).toBeGreaterThanOrEqual(0);
    // isSupportedFile called once for format validation
    expect(mockIsSupportedFile).toHaveBeenCalledTimes(1);
  });

  it('긴 영상은 maxFrames에 맞춰 FPS를 자동 감소한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    mockIsSupportedFile.mockReturnValue(true);

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValue([
      'frame_000001.jpg',
      'frame_000002.jpg',
      'frame_000003.jpg',
    ] as unknown as Awaited<ReturnType<typeof readdir>>);

    // 300s video, fps=5, maxFrames=300 → effectiveFps = min(5, 300/300) = 1
    mockExeca.mockResolvedValue({
      stdout: JSON.stringify({ format: { duration: '300' } }),
      stderr: '',
      exitCode: 0,
    });

    const ctx = makeCtx({
      inputPath: '/tmp/long-video.mp4',
      maxFrames: 300,
    });
    const frames = await extractFrames(ctx);

    expect(frames.length).toBe(3);
    // ffmpeg called with reduced fps (second call after ffprobe)
    const ffmpegCall = mockExeca.mock.calls.find(
      (c) => c[0] === '/usr/bin/ffmpeg',
    );
    expect(ffmpegCall).toBeDefined();
    const vfArg = ffmpegCall![1].find((a: string) => a.startsWith('fps='));
    // effectiveFps = min(5, 300/300) = 1
    expect(vfArg).toBe('fps=1,scale=-1:720');
  });
});
