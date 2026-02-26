import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import { execa } from 'execa';
import ffmpegPath from 'ffmpeg-static';

import { FRAME_FILENAME_PATTERN } from '../constants.js';
import type { FrameNode, ProcessContext } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ensureDir, fileExists } from '../utils/paths.js';

interface FFprobeMetadata {
  format?: {
    format_name?: string;
    duration?: string;
  };
  streams?: Array<{
    codec_type?: string;
  }>;
}

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

  // Use ffprobe to determine format and duration instead of extension check
  const metadata = await getVideoMetadata(inputPath).catch((err) => {
    logger.debug(`ffprobe failed: ${err.message}`);
    return null;
  });

  if (!metadata || !metadata.format) {
    throw new Error(`Could not read file metadata: ${inputPath}`);
  }

  const formatName = metadata.format.format_name ?? '';
  const duration = parseFloat(metadata.format.duration ?? '0');
  const hasVideoStream =
    metadata.streams?.some((s) => s.codec_type === 'video') ?? false;

  if (!hasVideoStream) {
    throw new Error(
      `No video stream found in file: ${inputPath} (detected format: ${formatName})`,
    );
  }

  logger.debug(
    `Detected format: ${formatName} (Duration: ${duration.toFixed(1)}s), path: ${inputPath}`,
  );
  await ensureDir(framesDir);

  // Calculate effective FPS: cap by maxFrames / duration
  let effectiveFps = fps;

  if (duration > 0) {
    const fpsCap = maxFrames / duration;
    effectiveFps = Math.min(fps, fpsCap);
    // Ensure at least 0.5fps (1 frame per 2 seconds)
    effectiveFps = Math.max(0.5, effectiveFps);
    logger.debug(
      `FPS: ${fps} → effective: ${effectiveFps.toFixed(2)} (maxFrames: ${maxFrames})`,
    );
  }

  const frames = await extractByFps(
    inputPath,
    framesDir,
    effectiveFps,
    scale,
    duration,
  );

  ctx.emitProgress(100);
  logger.debug(`Extracted ${frames.length} frames`);
  return frames;
}

async function extractByFps(
  inputPath: string,
  outputDir: string,
  fps: number,
  scale: number,
  duration: number,
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

  return buildFrameList(outputDir, duration);
}

async function getVideoMetadata(inputPath: string): Promise<FFprobeMetadata> {
  const { stdout } = await execa(ffprobePath, [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ]);
  return JSON.parse(stdout) as FFprobeMetadata;
}

async function buildFrameList(
  framesDir: string,
  duration: number,
): Promise<FrameNode[]> {
  const files = await readdir(framesDir);
  const jpgFiles = files.filter((f) => f.endsWith('.jpg')).sort();

  if (jpgFiles.length === 0) {
    return [];
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
