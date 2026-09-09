import sharp from 'sharp';

import type {
  AnimationMetadata,
  FrameNode,
  ProcessContext,
  VideoMetadata,
} from '../../../types/index.js';

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
    },
    animations: (ctx.animations ?? []).map((animation) => {
      const box = animation.boundingBox;
      const x = Math.max(0, Math.min(width, Math.round(box.x * sx)));
      const y = Math.max(0, Math.min(height, Math.round(box.y * sy)));
      return {
        ...animation,
        boundingBox: {
          x,
          y,
          width: Math.max(0, Math.min(width - x, Math.round(box.width * sx))),
          height: Math.max(
            0,
            Math.min(height - y, Math.round(box.height * sy)),
          ),
        },
      };
    }),
  };
}
