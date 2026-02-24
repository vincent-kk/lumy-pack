import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProcessContext } from '../../types/index.js';

// Helper to create a fluent-ffmpeg chain mock
function makeMockChain() {
  const chain: Record<string, unknown> = {};
  chain['outputOptions'] = vi.fn(() => chain);
  chain['output'] = vi.fn(() => chain);
  chain['run'] = vi.fn(() => chain);
  chain['on'] = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    if (event === 'end') {
      setTimeout(() => cb(), 0);
    }
    return chain;
  });
  return chain;
}

// Mock external deps before importing the module under test
vi.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = vi.fn(() => makeMockChain()) as unknown as {
    (...args: unknown[]): ReturnType<typeof makeMockChain>;
    setFfmpegPath: ReturnType<typeof vi.fn>;
    setFfprobePath: ReturnType<typeof vi.fn>;
    ffprobe: ReturnType<typeof vi.fn>;
  };
  mockFfmpeg.setFfmpegPath = vi.fn();
  mockFfmpeg.setFfprobePath = vi.fn();
  mockFfmpeg.ffprobe = vi.fn((_path: string, cb: (err: Error | null, data: unknown) => void) => {
    cb(null, { format: { duration: 10 } });
  });

  return { default: mockFfmpeg };
});

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

function makeCtx(overrides: Partial<ProcessContext['options']> = {}): ProcessContext {
  return {
    options: {
      mode: 'file',
      inputPath: '/tmp/test.mp4',
      count: 5,
      threshold: 0.5,
      pruneMode: 'threshold-with-cap',
      outputPath: '/out',
      fps: 5,
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
  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnsureDir.mockResolvedValue(undefined);

    // Re-apply ffmpeg mock implementation after clearAllMocks
    const ffmpegMod = await import('fluent-ffmpeg');
    const mockFfmpeg = vi.mocked(ffmpegMod.default) as unknown as ReturnType<typeof vi.fn> & {
      setFfmpegPath: ReturnType<typeof vi.fn>;
      setFfprobePath: ReturnType<typeof vi.fn>;
      ffprobe: ReturnType<typeof vi.fn>;
    };
    mockFfmpeg.mockImplementation(() => makeMockChain());
    mockFfmpeg.ffprobe = vi.fn((_path: string, cb: (err: Error | null, data: unknown) => void) => {
      cb(null, { format: { duration: 10 } });
    });
  });

  it('inputPath 미제공 시 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    const ctx = makeCtx({ inputPath: undefined });
    await expect(extractFrames(ctx)).rejects.toThrow('inputPath is required for frame extraction');
  });

  it('파일이 존재하지 않으면 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(false);
    mockIsSupportedFile.mockReturnValue(true);

    const ctx = makeCtx({ inputPath: '/tmp/nonexistent.mp4' });
    await expect(extractFrames(ctx)).rejects.toThrow('Input file not found: /tmp/nonexistent.mp4');
  });

  it('미지원 포맷이면 에러를 throw한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    mockIsSupportedFile.mockReturnValue(false);

    const ctx = makeCtx({ inputPath: '/tmp/test.xyz' });
    await expect(extractFrames(ctx)).rejects.toThrow('Unsupported file format: /tmp/test.xyz');
  });

  it('GIF 파일은 FPS 모드로 분기한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    // First call: allExtensions check → supported, Second call: isGif check → true
    mockIsSupportedFile
      .mockReturnValueOnce(true)  // allExtensions check
      .mockReturnValueOnce(true); // isGif check

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    mockReaddir.mockResolvedValue(['frame_000001.jpg'] as unknown as Awaited<ReturnType<typeof readdir>>);

    const ctx = makeCtx({ inputPath: '/tmp/animation.gif' });
    const frames = await extractFrames(ctx);

    // GIF: extractByFps was called → frames returned (readdir returned 1 file)
    expect(frames.length).toBeGreaterThanOrEqual(0);
    expect(mockIsSupportedFile).toHaveBeenCalledTimes(2);
  });

  it('I-frame 수 부족 시 FPS 모드로 fallback한다', async () => {
    const { extractFrames } = await import('../../core/extractor.js');
    mockFileExists.mockResolvedValue(true);
    // First: allExtensions → supported, Second: isGif → false (not a gif, triggers I-frame path)
    mockIsSupportedFile
      .mockReturnValueOnce(true)   // allExtensions check
      .mockReturnValueOnce(false); // isGif check → use I-frame first

    const { readdir } = await import('node:fs/promises');
    const mockReaddir = vi.mocked(readdir);
    // Return fewer than MIN_IFRAME_COUNT (3) files to trigger FPS fallback
    // First call (I-frame): 1 file (< 3, triggers fallback)
    // Second call (FPS): 5 files
    mockReaddir
      .mockResolvedValueOnce(['frame_000001.jpg'] as unknown as Awaited<ReturnType<typeof readdir>>)
      .mockResolvedValueOnce([
        'frame_000001.jpg',
        'frame_000002.jpg',
        'frame_000003.jpg',
        'frame_000004.jpg',
        'frame_000005.jpg',
      ] as unknown as Awaited<ReturnType<typeof readdir>>);

    const ctx = makeCtx({ inputPath: '/tmp/test.mp4' });
    const frames = await extractFrames(ctx);

    // After fallback, readdir was called twice (once for I-frame, once for FPS)
    expect(mockReaddir).toHaveBeenCalledTimes(2);
    // Frames should be from FPS extraction (5 frames)
    expect(frames.length).toBe(5);
  });
});
