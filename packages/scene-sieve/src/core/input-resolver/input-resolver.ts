import { join } from 'node:path';

import sharp from 'sharp';

import {
  ANIMATION_FRAME_THRESHOLD,
  DEFAULT_COUNT,
  DEFAULT_FPS,
  DEFAULT_MAX_FRAMES,
  DEFAULT_MAX_SEGMENT_DURATION,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
  DEFAULT_SEGMENT_CONCURRENCY,
  DEFAULT_THRESHOLD,
  IOU_THRESHOLD,
} from '../../constants/pipeline-defaults.js';
import type {
  FrameNode,
  ResolvedOptions,
  SieveOptions,
} from '../../types/index.js';
import { deriveOutputPath, resolveAbsolute } from '../utils/filesystem/paths.js';

import { validateOptions } from './validation/validate-options.js';
import { writeInputBuffer, writeInputFrames } from '../workspace/index.js';

/**
 * Validate supplied options and resolve defaults and paths for the pipeline.
 * @param options - Mode-specific input and optional numeric settings.
 * @returns Complete pipeline settings with absolute file input paths.
 * @throws An input error if a supplied numeric setting is invalid.
 */
export function resolveOptions(options: SieveOptions): ResolvedOptions {
  validateOptions(options);
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
    iouThreshold: options.iouThreshold ?? IOU_THRESHOLD,
    animationThreshold: options.animationThreshold ?? ANIMATION_FRAME_THRESHOLD,
    debug: options.debug ?? false,
    maxSegmentDuration:
      options.maxSegmentDuration ?? DEFAULT_MAX_SEGMENT_DURATION,
    concurrency: options.concurrency ?? DEFAULT_SEGMENT_CONCURRENCY,
  };
}

/**
 * Resolve the input source to a list of FrameNode[].
 *
 * - 'file'   mode: validate file exists and delegate to extractor (caller's responsibility)
 * - 'buffer' mode: write buffer as temp video file, return path via FrameNode trick (empty list)
 * - 'frames' mode: write frame buffers as JPGs, return FrameNode[]
 * @param options - Input source; encoded frames must have matching dimensions.
 * @param workspacePath - Workspace receiving temporary input files.
 * @returns Frame nodes or a resolved video path for extraction.
 * @throws Propagates metadata or write errors and rejects mismatched frame sizes.
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
    let dimensions: { width?: number; height?: number } | undefined;
    for (const buffer of options.inputFrames) {
      const { width, height } = await sharp(buffer).metadata();
      if (
        dimensions &&
        (width !== dimensions.width || height !== dimensions.height)
      ) {
        throw new Error(
          `inputFrames must be the same size (${dimensions.width}x${dimensions.height}), received: ${width}x${height}`,
        );
      }
      dimensions = { width, height };
    }
    const frames = await writeInputFrames(options.inputFrames, workspacePath);
    return { frames };
  }

  throw new Error(`Unsupported input mode: ${(options as SieveOptions).mode}`);
}
