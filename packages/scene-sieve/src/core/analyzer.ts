import type { FrameNode, ProcessContext, ScoreEdge } from '../types/index.js';
import { OPENCV_BATCH_SIZE } from '../constants.js';
import { logger } from '../utils/logger.js';

/**
 * Analyze adjacent frame pairs to compute similarity scores.
 * Processes frames in batches for memory efficiency.
 */
export async function analyzeFrames(
  ctx: ProcessContext,
): Promise<ScoreEdge[]> {
  const { frames } = ctx;
  if (frames.length < 2) return [];

  logger.debug(`Analyzing ${frames.length} frames in batches of ${OPENCV_BATCH_SIZE}`);

  const edges: ScoreEdge[] = [];

  for (let i = 0; i < frames.length - 1; i += OPENCV_BATCH_SIZE) {
    const batchEnd = Math.min(i + OPENCV_BATCH_SIZE + 1, frames.length);
    const batch = frames.slice(i, batchEnd);
    const batchEdges = await analyzeBatch(batch, i);
    edges.push(...batchEdges);

    const progress = Math.min(
      100,
      ((i + OPENCV_BATCH_SIZE) / (frames.length - 1)) * 100,
    );
    ctx.emitProgress(progress);
  }

  logger.debug(`Computed ${edges.length} score edges`);
  return edges;
}

async function analyzeBatch(
  frames: FrameNode[],
  _offset: number,
): Promise<ScoreEdge[]> {
  const edges: ScoreEdge[] = [];

  // TODO: Implement vision analysis pipeline:
  // 1. Load each frame with sharp, convert to grayscale, apply gaussian blur
  // 2. Pass preprocessed buffer to OpenCV WASM (cv.imread from buffer)
  // 3. Compute ORB/SIFT feature extraction and matching between adjacent pairs
  // 4. Calculate similarity score (S) based on feature match ratio + IoU
  // 5. cv.Mat.delete() after each frame to prevent WASM memory leaks

  for (let i = 0; i < frames.length - 1; i++) {
    edges.push({
      sourceId: frames[i].id,
      targetId: frames[i + 1].id,
      score: 0, // TODO: Replace with actual computed score
    });
  }

  return edges;
}
