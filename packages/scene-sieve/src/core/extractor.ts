import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';

import type { FrameNode, ProcessContext } from '../types/index.js';
import {
  MIN_IFRAME_COUNT,
  SUPPORTED_GIF_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
} from '../constants.js';
import { ensureDir, fileExists, isSupportedFile } from '../utils/paths.js';
import { logger } from '../utils/logger.js';

// Set bundled FFmpeg and ffprobe binary paths
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Extract frames from video/GIF using FFmpeg.
 * Attempts I-Frame extraction first; falls back to fixed FPS if insufficient.
 * GIF inputs always use FPS fallback.
 */
export async function extractFrames(
  ctx: ProcessContext,
): Promise<FrameNode[]> {
  const framesDir = join(ctx.workspacePath, 'frames');
  const { inputPath, fps, scale } = ctx.options;

  if (!inputPath) {
    throw new Error('inputPath is required for frame extraction');
  }

  // Validate input file
  const exists = await fileExists(inputPath);
  if (!exists) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const allExtensions = [...SUPPORTED_VIDEO_EXTENSIONS, ...SUPPORTED_GIF_EXTENSIONS];
  if (!isSupportedFile(inputPath, allExtensions)) {
    throw new Error(`Unsupported file format: ${inputPath}`);
  }

  logger.debug(`Extracting frames from: ${inputPath}`);
  await ensureDir(framesDir);

  // GIF always uses FPS fallback (no meaningful I-frames)
  const isGif = isSupportedFile(inputPath, SUPPORTED_GIF_EXTENSIONS);

  let frames: FrameNode[];

  if (isGif) {
    logger.debug('GIF detected — using FPS extraction');
    frames = await extractByFps(inputPath, framesDir, fps, scale);
  } else {
    frames = await extractIFrames(inputPath, framesDir, scale);

    if (frames.length < MIN_IFRAME_COUNT) {
      logger.debug(
        `Insufficient I-frames (${frames.length}), falling back to FPS mode`,
      );
      frames = await extractByFps(inputPath, framesDir, fps, scale);
    }
  }

  ctx.emitProgress(100);
  logger.debug(`Extracted ${frames.length} frames`);
  return frames;
}

async function extractIFrames(
  inputPath: string,
  outputDir: string,
  scale: number,
): Promise<FrameNode[]> {
  const outputPattern = join(outputDir, 'frame_%06d.jpg');

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf select='eq(pict_type,I)',scale=-1:${scale}`,
        '-vsync vfr',
        '-q:v 2',
      ])
      .output(outputPattern)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });

  return buildFrameList(outputDir, inputPath);
}

async function extractByFps(
  inputPath: string,
  outputDir: string,
  fps: number,
  scale: number,
): Promise<FrameNode[]> {
  const outputPattern = join(outputDir, 'frame_%06d.jpg');

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf fps=${fps},scale=-1:${scale}`,
        '-q:v 2',
      ])
      .output(outputPattern)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });

  return buildFrameList(outputDir, inputPath);
}

async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration ?? 0);
    });
  });
}

async function buildFrameList(framesDir: string, inputPath: string): Promise<FrameNode[]> {
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
    logger.debug('Could not determine video duration; using frame index for timestamps');
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
