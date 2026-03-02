import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import type {
  AnimationMetadata,
  FrameNode,
  ProcessContext,
  ResolvedOptions,
  ScoreEdge,
  SegmentPlan,
  SegmentResult,
  SieveOptions,
  SieveResult,
} from '../types/index.js';
import { concurrencyLimit } from '../utils/concurrency.js';
import { logger } from '../utils/logger.js';

import { analyzeFrames } from './analyzer.js';
import { extractFramesForRange, getVideoMetadata } from './extractor.js';
import { resolveInput } from './input-resolver.js';
import { pruneByThresholdWithCap } from './pruner.js';
import {
  cleanupWorkspace,
  createSegmentWorkspace,
  createWorkspace,
  finalizeOutput,
  readFramesAsBuffers,
} from './workspace.js';

// ── Pure Functions ──

/**
 * Determine whether segmentation should be used.
 * Returns false for frames mode and GIF files.
 * Actual duration check happens inside runSegmentedPipeline after metadata fetch.
 */
export function shouldSegment(
  resolvedOptions: ResolvedOptions,
  originalOptions: SieveOptions,
): boolean {
  if (resolvedOptions.mode === 'frames') return false;

  if (originalOptions.mode === 'file') {
    if (originalOptions.inputPath.toLowerCase().endsWith('.gif')) return false;
  }

  return true;
}

/**
 * Compute segment boundaries with overlap, frame allocation, and effectiveFps.
 * Pure function — no I/O.
 *
 * - effectiveFps is uniform across all segments
 * - Overlap: 1 frame at each internal boundary
 * - allocatedFrames total <= maxFrames (last segment adjusted if needed)
 */
export function computeSegmentPlan(
  totalDuration: number,
  maxSegmentDuration: number,
  maxFrames: number,
  fps: number,
): SegmentPlan[] {
  const effectiveFps = Math.max(0.5, Math.min(fps, maxFrames / totalDuration));

  // Single segment for short videos
  if (totalDuration <= maxSegmentDuration) {
    return [
      {
        index: 0,
        startTime: 0,
        endTime: totalDuration,
        duration: totalDuration,
        allocatedFrames: Math.min(
          Math.ceil(effectiveFps * totalDuration),
          maxFrames,
        ),
        effectiveFps,
        overlapBefore: 0,
        overlapAfter: 0,
        extractStartTime: 0,
        extractDuration: totalDuration,
      },
    ];
  }

  const segmentCount = Math.ceil(totalDuration / maxSegmentDuration);
  const overlapTime = 1 / effectiveFps;
  const segments: SegmentPlan[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const startTime = i * maxSegmentDuration;
    const endTime = Math.min((i + 1) * maxSegmentDuration, totalDuration);
    const duration = endTime - startTime;

    const overlapBefore = i > 0 ? 1 : 0;
    const overlapAfter = i < segmentCount - 1 ? 1 : 0;

    const extractStartTime = Math.max(
      0,
      startTime - overlapBefore * overlapTime,
    );
    const extractEndTime = Math.min(
      totalDuration,
      endTime + overlapAfter * overlapTime,
    );
    const extractDuration = extractEndTime - extractStartTime;

    segments.push({
      index: i,
      startTime,
      endTime,
      duration,
      allocatedFrames: Math.ceil(effectiveFps * duration),
      effectiveFps,
      overlapBefore,
      overlapAfter,
      extractStartTime,
      extractDuration,
    });
  }

  // Post-validation: ensure total allocatedFrames <= maxFrames
  const totalAllocated = segments.reduce(
    (sum, s) => sum + s.allocatedFrames,
    0,
  );
  if (totalAllocated > maxFrames) {
    segments[segments.length - 1].allocatedFrames -=
      totalAllocated - maxFrames;
  }

  return segments;
}

// ── mergeSegmentFrames private helpers ──

type FrameEntry = {
  frame: FrameNode;
  segmentIndex: number;
  localId: number;
};

/**
 * Collect all frames from every segment, adjusting timestamps by extractStartTime.
 */
function collectAllFrames(segmentResults: SegmentResult[]): FrameEntry[] {
  const allFrames: FrameEntry[] = [];
  for (const result of segmentResults) {
    for (const frame of result.frames) {
      allFrames.push({
        frame: {
          ...frame,
          // Use extractStartTime for timestamp correction (Section 18 note 1)
          timestamp: frame.timestamp + result.segment.extractStartTime,
        },
        segmentIndex: result.segment.index,
        localId: frame.id,
      });
    }
  }
  return allFrames;
}

/**
 * Sort frames by timestamp then remove overlap duplicates.
 * Threshold: 1/(effectiveFps * 2) — adaptive to fps (Section 18 note 5).
 * Keeps the first occurrence (earlier segment).
 */
function deduplicateFrames(
  frames: FrameEntry[],
  effectiveFps: number,
): FrameEntry[] {
  frames.sort((a, b) => a.frame.timestamp - b.frame.timestamp);

  const dupThreshold = 1 / (effectiveFps * 2);
  const unique: FrameEntry[] = [];

  for (const entry of frames) {
    if (unique.length > 0) {
      const last = unique[unique.length - 1];
      if (Math.abs(entry.frame.timestamp - last.frame.timestamp) < dupThreshold) {
        continue; // Skip duplicate — keep first (earlier segment)
      }
    }
    unique.push(entry);
  }

  return unique;
}

/**
 * Assign sequential global IDs to deduplicated frames and build a lookup map.
 * Returns the remapped FrameNode array and the "segmentIndex:localId" -> globalId map.
 */
function remapFrameIds(
  uniqueFrames: FrameEntry[],
): { frames: FrameNode[]; globalIdMap: Map<string, number> } {
  const globalIdMap = new Map<string, number>(); // "segmentIndex:localId" -> globalId
  const frames: FrameNode[] = uniqueFrames.map((entry, globalId) => {
    globalIdMap.set(`${entry.segmentIndex}:${entry.localId}`, globalId);
    return {
      id: globalId,
      timestamp: entry.frame.timestamp,
      extractPath: entry.frame.extractPath,
    };
  });
  return { frames, globalIdMap };
}

/**
 * Remap edge source/target IDs using the global ID map.
 * Duplicate edges (same source-target pair) retain the higher score.
 */
function remapEdges(
  segmentResults: SegmentResult[],
  globalIdMap: Map<string, number>,
): ScoreEdge[] {
  const edges: ScoreEdge[] = [];
  const edgeMap = new Map<string, number>(); // "sourceId-targetId" -> index

  for (const result of segmentResults) {
    for (const edge of result.edges) {
      const newSourceId = globalIdMap.get(`${result.segment.index}:${edge.sourceId}`);
      const newTargetId = globalIdMap.get(`${result.segment.index}:${edge.targetId}`);

      if (newSourceId === undefined || newTargetId === undefined) continue;

      const edgeKey = `${newSourceId}-${newTargetId}`;
      const existingIdx = edgeMap.get(edgeKey);

      if (existingIdx !== undefined) {
        if (edges[existingIdx].score < edge.score) {
          edges[existingIdx] = { sourceId: newSourceId, targetId: newTargetId, score: edge.score };
        }
      } else {
        edgeMap.set(edgeKey, edges.length);
        edges.push({ sourceId: newSourceId, targetId: newTargetId, score: edge.score });
      }
    }
  }

  return edges;
}

/**
 * Remap animation startFrameId/endFrameId using the global ID map.
 * Animations whose frame IDs were deduplicated (not in map) are dropped.
 */
function remapAnimations(
  segmentResults: SegmentResult[],
  globalIdMap: Map<string, number>,
): AnimationMetadata[] {
  const animations: AnimationMetadata[] = [];

  for (const result of segmentResults) {
    for (const anim of result.animations) {
      const newStartId = globalIdMap.get(`${result.segment.index}:${anim.startFrameId}`);
      const newEndId = globalIdMap.get(`${result.segment.index}:${anim.endFrameId}`);

      if (newStartId === undefined || newEndId === undefined) continue;

      animations.push({ ...anim, startFrameId: newStartId, endFrameId: newEndId });
    }
  }

  return animations;
}

/**
 * Merge multiple segment results into a single unified frame/edge/animation set.
 * - Timestamps adjusted using extractStartTime (Section 18 note 1)
 * - Overlap frames deduplicated by threshold 1/(effectiveFps*2) (Section 18 note 5)
 * - Global IDs reassigned after dedup
 * - Duplicate edges keep higher score
 */
export function mergeSegmentFrames(segmentResults: SegmentResult[]): {
  frames: FrameNode[];
  edges: ScoreEdge[];
  animations: AnimationMetadata[];
} {
  if (segmentResults.length === 0) {
    return { frames: [], edges: [], animations: [] };
  }

  const effectiveFps = segmentResults[0].segment.effectiveFps;

  const allFrames = collectAllFrames(segmentResults);
  const uniqueFrames = deduplicateFrames(allFrames, effectiveFps);
  const { frames, globalIdMap } = remapFrameIds(uniqueFrames);
  const edges = remapEdges(segmentResults, globalIdMap);
  const animations = remapAnimations(segmentResults, globalIdMap);

  return { frames, edges, animations };
}

// ── Segment Processing ──

function buildSegmentContext(
  segment: SegmentPlan,
  frames: FrameNode[],
  segmentWorkspacePath: string,
  resolvedOptions: ResolvedOptions,
  onProgress: (percent: number) => void,
): ProcessContext {
  return {
    options: {
      ...resolvedOptions,
      fps: segment.effectiveFps,
      maxFrames: segment.allocatedFrames,
    },
    workspacePath: segmentWorkspacePath,
    frames,
    graph: [],
    status: 'ANALYZING',
    emitProgress: onProgress,
  };
}

/**
 * Extract frames for a single segment and analyze them.
 * Each segment uses an isolated workspace directory.
 */
export async function processSegment(
  inputPath: string,
  segment: SegmentPlan,
  workspacePath: string,
  resolvedOptions: ResolvedOptions,
  onProgress: (percent: number) => void,
): Promise<SegmentResult> {
  const framesDir = join(workspacePath, 'frames');

  const frames = await extractFramesForRange(
    inputPath,
    framesDir,
    segment.effectiveFps,
    resolvedOptions.scale,
    segment.extractStartTime,
    segment.extractDuration,
  );

  if (frames.length < 2) {
    return { segment, frames, edges: [], animations: [] };
  }

  const ctx = buildSegmentContext(
    segment,
    frames,
    workspacePath,
    resolvedOptions,
    onProgress,
  );

  const { edges, animations } = await analyzeFrames(ctx);

  return { segment, frames, edges, animations };
}

// ── Segmented Pipeline Orchestrator ──

/**
 * Full segmented pipeline: metadata → plan → parallel extract+analyze → merge → prune → finalize.
 * Called from runPipeline when shouldSegment() returns true.
 */
export async function runSegmentedPipeline(
  options: SieveOptions,
  resolvedOptions: ResolvedOptions,
): Promise<SieveResult> {
  const pipelineStart = Date.now();
  const sessionId = randomUUID();

  let mainWorkspace = '';

  try {
    // 1. Create main workspace
    mainWorkspace = await createWorkspace(sessionId);
    logger.debug(`Segmented pipeline: workspace at ${mainWorkspace}`);

    // 2. Resolve input (buffer mode creates temp file — must precede getVideoMetadata)
    const { resolvedInputPath } = await resolveInput(options, mainWorkspace);
    const inputPath = resolvedInputPath ?? resolvedOptions.inputPath;

    if (!inputPath) {
      throw new Error('No input path available for segmented pipeline');
    }

    // 3. Get video metadata for duration
    const metadata = await getVideoMetadata(inputPath);
    const totalDuration = parseFloat(metadata.format?.duration ?? '0');

    if (totalDuration <= 0) {
      throw new Error(`Invalid video duration: ${totalDuration}`);
    }

    logger.debug(`Video duration: ${totalDuration}s`);

    // 4. Compute segment plan
    const segments = computeSegmentPlan(
      totalDuration,
      resolvedOptions.maxSegmentDuration,
      resolvedOptions.maxFrames,
      resolvedOptions.fps,
    );

    logger.debug(`Segment plan: ${segments.length} segments`);

    // 5. Process segments with concurrency limit
    const limit = concurrencyLimit(resolvedOptions.concurrency);
    const segmentProgresses = new Array<number>(segments.length).fill(0);
    const weights = segments.map((s) => s.duration / totalDuration);

    const emitOverallProgress = (phase: 'EXTRACTING' | 'ANALYZING') => {
      if (!options.onProgress) return;
      const overall = weights.reduce(
        (sum, w, i) => sum + w * (segmentProgresses[i] ?? 0),
        0,
      );
      options.onProgress(phase, Math.min(100, overall));
    };

    options.onProgress?.('EXTRACTING', 0);

    const results = await Promise.all(
      segments.map((segment) =>
        limit(async () => {
          const segWorkspace = await createSegmentWorkspace(
            mainWorkspace,
            segment.index,
          );

          const result = await processSegment(
            inputPath,
            segment,
            segWorkspace,
            resolvedOptions,
            (percent) => {
              segmentProgresses[segment.index] = percent;
              emitOverallProgress('ANALYZING');
            },
          );

          return result;
        }),
      ),
    );

    options.onProgress?.('ANALYZING', 100);

    // 6. Merge segment results
    const { frames, edges, animations } = mergeSegmentFrames(results);
    logger.debug(
      `Merged: ${frames.length} frames, ${edges.length} edges, ${animations.length} animations`,
    );

    // 7. Prune on the merged global graph
    options.onProgress?.('PRUNING', 0);
    const survivingIds = pruneByThresholdWithCap(
      edges,
      frames,
      resolvedOptions.threshold,
      resolvedOptions.count,
    );
    const prunedFrames = frames.filter((f) => survivingIds.has(f.id));
    options.onProgress?.('PRUNING', 100);

    // 8. Finalize output
    options.onProgress?.('FINALIZING', 0);

    const ctx: ProcessContext = {
      options: resolvedOptions,
      workspacePath: mainWorkspace,
      frames,
      graph: edges,
      animations,
      status: 'FINALIZING',
      emitProgress: (percent) => options.onProgress?.('FINALIZING', percent),
    };

    let outputFiles: string[] = [];
    let outputBuffers: Buffer[] | undefined;

    if (
      resolvedOptions.mode === 'buffer' ||
      resolvedOptions.mode === 'frames'
    ) {
      outputBuffers = await readFramesAsBuffers(
        prunedFrames,
        resolvedOptions.quality,
      );
    } else {
      outputFiles = await finalizeOutput(ctx, prunedFrames);
    }

    options.onProgress?.('FINALIZING', 100);

    logger.success(
      `Segmented pipeline: ${prunedFrames.length} scenes from ${frames.length} frames (${segments.length} segments)`,
    );

    return {
      success: true,
      originalFramesCount: frames.length,
      prunedFramesCount: prunedFrames.length,
      outputFiles,
      outputBuffers,
      animations,
      video: {
        originalDurationMs: totalDuration * 1000,
        fps: resolvedOptions.fps,
        resolution: {
          width: resolvedOptions.scale,
          height: Math.round((resolvedOptions.scale * 9) / 16),
        },
      },
      executionTimeMs: Date.now() - pipelineStart,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Segmented pipeline failed: ${err.message}`);
    throw err;
  } finally {
    if (!resolvedOptions.debug) {
      await cleanupWorkspace(mainWorkspace);
    } else {
      logger.debug(`Debug mode: workspace preserved at ${mainWorkspace}`);
    }
  }
}
