import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import { filter, map } from '@winglet/common-utils';
import { execa } from 'execa';
import ffmpegPath from 'ffmpeg-static';

import { FRAME_FILENAME_PATTERN } from '../constants.js';
import type { FrameNode, ProcessContext } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ensureDir, fileExists } from '../utils/paths.js';

export interface FFprobeMetadata {
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
 * @param ctx Pipeline context; records effectiveFps and sourceDurationSec for video input.
 * @returns Extracted candidates, or the unchanged input array in frames mode.
 * @throws When the input is missing, metadata has no video stream, or FFmpeg fails.
 */
export async function extractFrames(ctx: ProcessContext): Promise<FrameNode[]> {
  if (ctx.options.mode === 'frames') {
    ctx.effectiveFps = 1;
    return ctx.frames;
  }

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

  const frameLimit = Math.max(2, maxFrames);
  let effectiveFps = fps;

  if (duration > 0) {
    const fpsCap = frameLimit / duration;
    effectiveFps = Math.min(fps, fpsCap);
    logger.debug(
      `FPS: ${fps} → effective: ${effectiveFps.toFixed(2)} (maxFrames: ${maxFrames})`,
    );
  }

  ctx.effectiveFps = effectiveFps;
  ctx.sourceDurationSec = duration;

  const frames = await extractByFps(
    inputPath,
    framesDir,
    effectiveFps,
    scale,
    frameLimit,
  );

  ctx.emitProgress(100);
  logger.debug(`Extracted ${frames.length} frames`);
  return frames;
}

/**
 * Write scaled JPEG candidates through the bundled FFmpeg runtime.
 * @param inputPath Readable video input.
 * @param outputDir Existing frame directory.
 * @param fps Positive effective sampling frequency.
 * @param scale Output image height.
 * @param frameLimit Maximum number of output frames.
 * @returns Candidates with local output-grid timestamps; rejects on extraction failure.
 */
async function extractByFps(
  inputPath: string,
  outputDir: string,
  fps: number,
  scale: number,
  frameLimit: number,
): Promise<FrameNode[]> {
  const outputPattern = join(outputDir, FRAME_FILENAME_PATTERN);

  await execa(ffmpegPath!, [
    '-i',
    inputPath,
    '-vf',
    `fps=${fps},scale=-1:${scale}`,
    '-q:v',
    '2',
    '-frames:v',
    String(frameLimit),
    outputPattern,
  ]);

  return buildFrameList(outputDir, fps);
}

export async function getVideoMetadata(
  inputPath: string,
): Promise<FFprobeMetadata> {
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

/**
 * Read sorted JPEG paths and attach local output-grid times.
 * @param framesDir Extracted frame directory; filesystem errors propagate.
 * @param effectiveFps Positive frequency used by the fps filter.
 * @returns Zero-based candidates without a segment seek offset.
 */
async function buildFrameList(
  framesDir: string,
  effectiveFps: number,
): Promise<FrameNode[]> {
  const files = await readdir(framesDir);
  const jpgFiles = filter(files, (f) => f.endsWith('.jpg')).sort();

  if (jpgFiles.length === 0) {
    return [];
  }

  return map(jpgFiles, (file, index) => ({
    id: index,
    timestamp: index / effectiveFps,
    extractPath: join(framesDir, file),
  }));
}

/**
 * Extract frames from a specific time range of a video using FFmpeg.
 * Uses input seeking (-ss before -i) for fast seek + -t for duration.
 *
 * @param inputPath - Path to the video file
 * @param outputDir - Directory to write extracted frames
 * @param fps - Frames per second for extraction
 * @param scale - Height scale for vision analysis
 * @param startTime - Start time in seconds
 * @param duration - Duration in seconds to extract
 * @param frameLimit - Positive output limit; defaults to the range's grid capacity
 * @returns Array of FrameNode with segment-local timestamps (starting from 0)
 */
export async function extractFramesForRange(
  inputPath: string,
  outputDir: string,
  fps: number,
  scale: number,
  startTime: number,
  duration: number,
  frameLimit: number = Math.ceil(duration * fps),
): Promise<FrameNode[]> {
  const outputPattern = join(outputDir, FRAME_FILENAME_PATTERN);

  await execa(ffmpegPath!, [
    '-ss',
    String(startTime),
    '-i',
    inputPath,
    '-t',
    String(duration),
    '-vf',
    `fps=${fps},scale=-1:${scale}`,
    '-q:v',
    '2',
    '-frames:v',
    String(frameLimit),
    outputPattern,
  ]);

  return buildFrameList(outputDir, fps);
}
