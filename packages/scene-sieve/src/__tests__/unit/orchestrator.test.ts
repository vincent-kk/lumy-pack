import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SieveOptions } from '../../types/index.js';

const mockAnalyzeFrames = vi.fn();
const mockExtractFrames = vi.fn();
const mockResolveOptions = vi.fn();
const mockResolveInput = vi.fn();
const mockCreateWorkspace = vi.fn();
const mockCleanupWorkspace = vi.fn();
const mockFinalizeOutput = vi.fn();
const mockReadFramesAsBuffers = vi.fn();
const mockPruneByThresholdWithCap = vi.fn();
const mockSetDebugMode = vi.fn();

vi.mock('../../core/analyzer.js', () => ({
  analyzeFrames: mockAnalyzeFrames,
}));

vi.mock('../../core/extractor.js', () => ({
  extractFrames: mockExtractFrames,
}));

vi.mock('../../core/input-resolver.js', () => ({
  resolveOptions: mockResolveOptions,
  resolveInput: mockResolveInput,
}));

vi.mock('../../core/workspace.js', () => ({
  createWorkspace: mockCreateWorkspace,
  cleanupWorkspace: mockCleanupWorkspace,
  finalizeOutput: mockFinalizeOutput,
  readFramesAsBuffers: mockReadFramesAsBuffers,
}));

vi.mock('../../core/pruner.js', () => ({
  pruneByThresholdWithCap: mockPruneByThresholdWithCap,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() },
  setDebugMode: mockSetDebugMode,
}));

const defaultResolvedOptions = {
  mode: 'file' as const,
  inputPath: '/input.mp4',
  count: 20,
  threshold: 0.5,
  pruneMode: 'threshold-with-cap' as const,
  outputPath: '/out',
  fps: 5,
  maxFrames: 300,
  scale: 720,
  debug: false,
};

const mockFrames = [
  { id: 0, timestamp: 0, extractPath: '/tmp/ws/frames/frame_000001.jpg' },
  { id: 1, timestamp: 1, extractPath: '/tmp/ws/frames/frame_000002.jpg' },
  { id: 2, timestamp: 2, extractPath: '/tmp/ws/frames/frame_000003.jpg' },
];

const mockEdges = [
  { sourceId: 0, targetId: 1, score: 0.5 },
  { sourceId: 1, targetId: 2, score: 0.8 },
];

function setupDefaultMocks(modeOverride?: 'file' | 'buffer' | 'frames') {
  const mode = modeOverride ?? 'file';
  mockResolveOptions.mockReturnValue({ ...defaultResolvedOptions, mode });
  mockCreateWorkspace.mockResolvedValue('/tmp/ws');
  mockResolveInput.mockResolvedValue({
    frames: mode === 'frames' ? mockFrames : [],
    resolvedInputPath: '/input.mp4',
  });
  mockExtractFrames.mockResolvedValue(mockFrames);
  mockAnalyzeFrames.mockResolvedValue(mockEdges);
  mockPruneByThresholdWithCap.mockReturnValue(new Set([0, 1, 2]));
  mockFinalizeOutput.mockResolvedValue([
    '/out/scene_001.jpg',
    '/out/scene_002.jpg',
    '/out/scene_003.jpg',
  ]);
  mockReadFramesAsBuffers.mockResolvedValue([
    Buffer.from('frame1'),
    Buffer.from('frame2'),
    Buffer.from('frame3'),
  ]);
  mockCleanupWorkspace.mockResolvedValue(undefined);
}

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('file 모드: extractFrames가 호출된다', async () => {
    setupDefaultMocks('file');
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = { mode: 'file', inputPath: '/input.mp4' };
    await runPipeline(options);

    expect(mockExtractFrames).toHaveBeenCalledTimes(1);
  });

  it('buffer 모드: readFramesAsBuffers가 호출되고 outputBuffers를 반환한다', async () => {
    setupDefaultMocks('buffer');
    mockResolveOptions.mockReturnValue({
      ...defaultResolvedOptions,
      mode: 'buffer',
    });
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = {
      mode: 'buffer',
      inputBuffer: Buffer.from('video-data'),
    };
    const result = await runPipeline(options);

    expect(mockReadFramesAsBuffers).toHaveBeenCalledTimes(1);
    expect(result.outputBuffers).toBeDefined();
    expect(Array.isArray(result.outputBuffers)).toBe(true);
  });

  it('frames 모드: extractFrames가 호출되지 않는다', async () => {
    setupDefaultMocks('frames');
    mockResolveOptions.mockReturnValue({
      ...defaultResolvedOptions,
      mode: 'frames',
    });
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = {
      mode: 'frames',
      inputFrames: [Buffer.from('frame1'), Buffer.from('frame2')],
    };
    await runPipeline(options);

    expect(mockExtractFrames).not.toHaveBeenCalled();
  });

  it('에러 발생 시 cleanupWorkspace가 호출된다', async () => {
    setupDefaultMocks('file');
    mockExtractFrames.mockRejectedValue(new Error('FFmpeg 오류'));
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = { mode: 'file', inputPath: '/input.mp4' };
    await expect(runPipeline(options)).rejects.toThrow('FFmpeg 오류');

    expect(mockCleanupWorkspace).toHaveBeenCalledTimes(1);
  });

  it('debug=true 시 cleanupWorkspace가 호출되지 않는다', async () => {
    setupDefaultMocks('file');
    mockResolveOptions.mockReturnValue({
      ...defaultResolvedOptions,
      debug: true,
    });
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = {
      mode: 'file',
      inputPath: '/input.mp4',
      debug: true,
    };
    await runPipeline(options);

    expect(mockCleanupWorkspace).not.toHaveBeenCalled();
  });

  it('SieveResult 구조를 올바르게 반환한다', async () => {
    setupDefaultMocks('file');
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = { mode: 'file', inputPath: '/input.mp4' };
    const result = await runPipeline(options);

    expect(result).toMatchObject({
      success: true,
      outputFiles: expect.any(Array),
      executionTimeMs: expect.any(Number),
    });
    expect(typeof result.originalFramesCount).toBe('number');
    expect(typeof result.prunedFramesCount).toBe('number');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('기본 동작: pruneByThresholdWithCap이 호출된다', async () => {
    setupDefaultMocks('file');
    const { runPipeline } = await import('../../core/orchestrator.js');

    const options: SieveOptions = { mode: 'file', inputPath: '/input.mp4' };
    await runPipeline(options);

    expect(mockPruneByThresholdWithCap).toHaveBeenCalledTimes(1);
  });
});
