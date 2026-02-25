import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import { execa } from 'execa';
import ffmpegPath from 'ffmpeg-static';

import {
  FRAME_FILENAME_PATTERN,
  SUPPORTED_GIF_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
} from '../constants.js';
import type { FrameNode, ProcessContext } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ensureDir, fileExists, isSupportedFile } from '../utils/paths.js';

/**
 * Extract frames from video/GIF using FFmpeg.
 * Always uses FPS-based extraction. For long videos, FPS is automatically
 * reduced to stay within maxFrames budget.
 */
export async function extractFrames(ctx: ProcessContext): Promise<FrameNode[]> {
  const framesDir = join(ctx.workspacePath, 'frames');
  const { inputPath, fps, maxFrames, scale } = ctx.options;

  if (!inputPath) {
    throw new Error('inputPath is required for frame extraction');
  }

  // Validate input file
  const exists = await fileExists(inputPath);
  if (!exists) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const allExtensions = [
    ...SUPPORTED_VIDEO_EXTENSIONS,
    ...SUPPORTED_GIF_EXTENSIONS,
  ];
  if (!isSupportedFile(inputPath, allExtensions)) {
    throw new Error(`Unsupported file format: ${inputPath}`);
  }

  logger.debug(`Extracting frames from: ${inputPath}`);
  await ensureDir(framesDir);

  // Calculate effective FPS: cap by maxFrames / duration
  let effectiveFps = fps;
  const duration = await getVideoDuration(inputPath).catch(() => 0);

  if (duration > 0) {
    const fpsCap = maxFrames / duration;
    effectiveFps = Math.min(fps, fpsCap);
    // Ensure at least 0.5fps (1 frame per 2 seconds)
    effectiveFps = Math.max(0.5, effectiveFps);
    logger.debug(
      `Duration: ${duration.toFixed(1)}s, FPS: ${fps} → effective: ${effectiveFps.toFixed(2)} (maxFrames: ${maxFrames})`,
    );
  }

  const frames = await extractByFps(inputPath, framesDir, effectiveFps, scale);

  ctx.emitProgress(100);
  logger.debug(`Extracted ${frames.length} frames`);
  return frames;
}

async function extractByFps(
  inputPath: string,
  outputDir: string,
  fps: number,
  scale: number,
): Promise<FrameNode[]> {
  const outputPattern = join(outputDir, FRAME_FILENAME_PATTERN);

  await execa(ffmpegPath!, [
    '-i',
    inputPath,
    '-vf',
    `fps=${fps},scale=-1:${scale}`,
    '-q:v',
    '2',
    outputPattern,
  ]);

  return buildFrameList(outputDir, inputPath);
}

async function getVideoDuration(inputPath: string): Promise<number> {
  const { stdout } = await execa(ffprobePath, [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    inputPath,
  ]);
  const metadata = JSON.parse(stdout);
  return parseFloat(metadata.format?.duration ?? '0');
}

async function buildFrameList(
  framesDir: string,
  inputPath: string,
): Promise<FrameNode[]> {
  const files = await readdir(framesDir);
  const jpgFiles = files.filter((f) => f.endsWith('.jpg')).sort();

  if (jpgFiles.length === 0) {
    return [];
  }

  // Try to get actual duration for timestamp estimation
  let duration = 0;
  try {
    duration = await getVideoDuration(inputPath);
  } catch {
    logger.debug(
      'Could not determine video duration; using frame index for timestamps',
    );
  }

  return jpgFiles.map((file, index) => ({
    id: index,
    timestamp:
      duration > 0 && jpgFiles.length > 1
        ? (duration * index) / (jpgFiles.length - 1)
        : index,
    extractPath: join(framesDir, file),
  }));
}
