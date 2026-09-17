import { basename } from 'node:path';

import sharp from 'sharp';

import type {
  AnimationMetadata,
  FrameNode,
  ProcessContext,
  VideoMetadata,
} from '../../../types/index.js';

import { scaleBoundingBox } from './scale-bounding-box.js';

/**
 * Read output dimensions and build consistent video and animation metadata.
 * JPEG finalization does not resize, so the source dimensions match the output.
 * @param ctx Pipeline state with source duration, effective FPS and analysis-space animations.
 * @param selected Selected frames in output order; the first candidate is the fallback.
 * @param analysisResolution Analysis dimensions; absent or zero dimensions imply no scaling.
 * @returns Video metadata and new output-space animations, retaining zero-based frame IDs.
 * @throws If sharp cannot read the selected or fallback image. Empty input performs no image I/O.
 */
export async function buildVideoMetadata(
  ctx: ProcessContext,
  selected: FrameNode[],
  analysisResolution: ProcessContext['analysisResolution'],
): Promise<{ video: VideoMetadata; animations: AnimationMetadata[] }> {
  const firstFrame = selected[0] ?? ctx.frames[0];
  const dimensions = firstFrame
    ? await sharp(firstFrame.extractPath).metadata()
    : undefined;
  const width = dimensions?.width ?? 0;
  const height = dimensions?.height ?? 0;
  const sx = analysisResolution?.width ? width / analysisResolution.width : 1;
  const sy = analysisResolution?.height
    ? height / analysisResolution.height
    : 1;
  const lastTimestamp = ctx.frames[ctx.frames.length - 1]?.timestamp ?? 0;
  const duration =
    ctx.options.mode === 'frames'
      ? lastTimestamp
      : (ctx.sourceDurationSec ?? lastTimestamp);

  return {
    video: {
      originalDurationMs: Math.round(duration * 1000),
      fps:
        ctx.options.mode === 'frames'
          ? 1
          : (ctx.effectiveFps ?? ctx.options.fps),
      resolution: { width, height },
      candidatesCount: ctx.frames.length,
      selectedCount: selected.length,
      source: {
        fileName: ctx.options.mode === 'file' && ctx.options.inputPath
          ? basename(ctx.options.inputPath) : null,
        mode: ctx.options.mode,
      },
    },
    animations: (ctx.animations ?? []).map((animation) => ({
      ...animation,
      boundingBox: scaleBoundingBox(animation.boundingBox, sx, sy, width, height),
    })),
  };
}
