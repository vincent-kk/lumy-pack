import { join } from 'node:path';

import {
  DEFAULT_COUNT,
  DEFAULT_FPS,
  DEFAULT_MAX_FRAMES,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
  DEFAULT_THRESHOLD,
} from '../constants.js';
import type {
  FrameNode,
  ResolvedOptions,
  SieveOptions,
} from '../types/index.js';
import { deriveOutputPath, resolveAbsolute } from '../utils/paths.js';

import { writeInputBuffer, writeInputFrames } from './workspace.js';

export function resolveOptions(options: SieveOptions): ResolvedOptions {
  const mode = options.mode;
  // Normalize file path so output path and I/O do not depend on process.cwd()
  const inputPath =
    mode === 'file' ? resolveAbsolute(options.inputPath) : undefined;
  const outputPath =
    options.outputPath ??
    (inputPath
      ? deriveOutputPath(inputPath)
      : join(process.cwd(), 'scene-sieve-output'));

  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  if (threshold <= 0 || threshold > 1) {
    throw new Error(
      `threshold must be in range (0, 1], received: ${threshold}`,
    );
  }

  const pruneMode: ResolvedOptions['pruneMode'] = 'threshold-with-cap';

  return {
    mode,
    inputPath,
    count: options.count ?? DEFAULT_COUNT,
    threshold,
    pruneMode,
    outputPath,
    fps: options.fps ?? DEFAULT_FPS,
    maxFrames: options.maxFrames ?? DEFAULT_MAX_FRAMES,
    scale: options.scale ?? DEFAULT_SCALE,
    quality: options.quality ?? DEFAULT_QUALITY,
    debug: options.debug ?? false,
  };
}

/**
 * Resolve the input source to a list of FrameNode[].
 *
 * - 'file'   mode: validate file exists and delegate to extractor (caller's responsibility)
 * - 'buffer' mode: write buffer as temp video file, return path via FrameNode trick (empty list)
 * - 'frames' mode: write frame buffers as JPGs, return FrameNode[]
 */
export async function resolveInput(
  options: SieveOptions,
  workspacePath: string,
): Promise<{ frames: FrameNode[]; resolvedInputPath?: string }> {
  if (options.mode === 'file') {
    // Frame extraction is handled by orchestrator via extractFrames()
    // Use normalized path so extraction and analysis are cwd-independent
    return {
      frames: [],
      resolvedInputPath: resolveAbsolute(options.inputPath),
    };
  }

  if (options.mode === 'buffer') {
    const resolvedInputPath = await writeInputBuffer(
      options.inputBuffer,
      workspacePath,
    );
    return { frames: [], resolvedInputPath };
  }

  if (options.mode === 'frames') {
    const frames = await writeInputFrames(options.inputFrames, workspacePath);
    return { frames };
  }

  throw new Error(`Unsupported input mode: ${(options as SieveOptions).mode}`);
}
