import { join } from 'node:path';

import type { FrameNode, SieveOptions, ResolvedOptions } from '../types/index.js';
import { DEFAULT_COUNT, DEFAULT_FPS, DEFAULT_SCALE } from '../constants.js';
import { deriveOutputPath } from '../utils/paths.js';
import { writeInputBuffer, writeInputFrames } from './workspace.js';

export function resolveOptions(options: SieveOptions): ResolvedOptions {
  const mode = options.mode;
  const inputPath = mode === 'file' ? options.inputPath : undefined;
  const outputPath =
    options.outputPath ??
    (inputPath
      ? deriveOutputPath(inputPath)
      : join(process.cwd(), 'scene-sieve-output'));

  const threshold = options.threshold;
  if (threshold !== undefined && (threshold <= 0 || threshold > 1)) {
    throw new Error(
      `threshold must be in range (0, 1], received: ${threshold}`,
    );
  }

  const hasThreshold = threshold !== undefined;
  const hasExplicitCount = options.count !== undefined;

  const pruneMode: ResolvedOptions['pruneMode'] =
    hasThreshold && hasExplicitCount
      ? 'threshold-with-cap'
      : hasThreshold
        ? 'threshold'
        : 'count';

  return {
    mode,
    inputPath,
    count: options.count ?? DEFAULT_COUNT,
    threshold,
    pruneMode,
    outputPath,
    fps: options.fps ?? DEFAULT_FPS,
    scale: options.scale ?? DEFAULT_SCALE,
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
    return { frames: [], resolvedInputPath: options.inputPath };
  }

  if (options.mode === 'buffer') {
    const resolvedInputPath = await writeInputBuffer(options.inputBuffer, workspacePath);
    return { frames: [], resolvedInputPath };
  }

  if (options.mode === 'frames') {
    const frames = await writeInputFrames(options.inputFrames, workspacePath);
    return { frames };
  }

  throw new Error(`Unsupported input mode: ${(options as SieveOptions).mode}`);
}
