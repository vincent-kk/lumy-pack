import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { FrameNode, ProcessContext } from '../types/index.js';
import { MIN_IFRAME_COUNT } from '../constants.js';
import { logger } from '../utils/logger.js';

/**
 * Extract frames from video/GIF using FFmpeg.
 * Attempts I-Frame extraction first; falls back to fixed FPS if insufficient.
 */
export async function extractFrames(
  ctx: ProcessContext,
): Promise<FrameNode[]> {
  const framesDir = join(ctx.workspacePath, 'frames');
  const { inputPath, fps, scale } = ctx.options;

  logger.debug(`Extracting frames from: ${inputPath}`);

  let frames = await extractIFrames(inputPath, framesDir, scale);

  if (frames.length < MIN_IFRAME_COUNT) {
    logger.debug(
      `Insufficient I-frames (${frames.length}), falling back to FPS mode`,
    );
    frames = await extractByFps(inputPath, framesDir, fps, scale);
  }

  ctx.emitProgress(100);
  logger.debug(`Extracted ${frames.length} frames`);
  return frames;
}

async function extractIFrames(
  _inputPath: string,
  outputDir: string,
  _scale: number,
): Promise<FrameNode[]> {
  // TODO: Implement fluent-ffmpeg I-Frame extraction
  // Use select='eq(pict_type,I)' filter with scale down to `_scale`px
  // Write frames as frame_%06d.jpg to outputDir
  return buildFrameList(outputDir);
}

async function extractByFps(
  _inputPath: string,
  outputDir: string,
  _fps: number,
  _scale: number,
): Promise<FrameNode[]> {
  // TODO: Implement fluent-ffmpeg FPS-based extraction
  // Use fps=`_fps` filter with scale down to `_scale`px
  // Write frames as frame_%06d.jpg to outputDir
  return buildFrameList(outputDir);
}

async function buildFrameList(framesDir: string): Promise<FrameNode[]> {
  const files = await readdir(framesDir);
  const jpgFiles = files.filter((f) => f.endsWith('.jpg')).sort();

  return jpgFiles.map((file, index) => ({
    id: index,
    timestamp: index, // TODO: Parse actual timestamp from FFmpeg output
    extractPath: join(framesDir, file),
  }));
}
