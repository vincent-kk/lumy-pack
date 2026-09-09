import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { filter, map } from '@winglet/common-utils';

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
 * Partition the global extraction grid into nonempty logical segments.
 * @param totalDuration Positive source duration in seconds.
 * @param maxSegmentDuration Positive logical segment width in seconds.
 * @param maxFrames Candidate budget, defensively raised to at least two.
 * @param fps Positive requested sampling frequency.
 * @returns Contiguous plan indices with grid-aligned seeks and overlap-inclusive limits.
 */
export function computeSegmentPlan(
  totalDuration: number,
  maxSegmentDuration: number,
  maxFrames: number,
  fps: number,
): SegmentPlan[] {
  const frameLimit = Math.max(2, maxFrames);
  const effectiveFps = Math.min(fps, frameLimit / totalDuration);

  if (totalDuration <= maxSegmentDuration) {
    return [
      {
        index: 0,
        startTime: 0,
        endTime: totalDuration,
        duration: totalDuration,
        allocatedFrames: frameLimit,
        effectiveFps,
        overlapBefore: 0,
        overlapAfter: 0,
        extractStartTime: 0,
        extractDuration: totalDuration,
      },
    ];
  }

  const segments: SegmentPlan[] = [];

  for (let slot = 0; slot < frameLimit; slot++) {
    const timestamp = slot / effectiveFps;
    if (timestamp >= totalDuration) break;
    const startTime =
      Math.floor(timestamp / maxSegmentDuration) * maxSegmentDuration;
    const previous = segments[segments.length - 1];
    if (previous?.startTime === startTime) {
      previous.allocatedFrames++;
      continue;
    }

    const endTime = Math.min(startTime + maxSegmentDuration, totalDuration);
    segments.push({
      index: segments.length,
      startTime,
      endTime,
      duration: endTime - startTime,
      allocatedFrames: 1,
      effectiveFps,
      overlapBefore: 0,
      overlapAfter: 0,
      extractStartTime: timestamp,
      extractDuration: 0,
    });
  }

  let firstSlot = 0;
  for (const segment of segments) {
    const nextSlot = firstSlot + segment.allocatedFrames;
    segment.overlapBefore = segment.index > 0 ? 1 : 0;
    segment.overlapAfter = segment.index < segments.length - 1 ? 1 : 0;
    segment.extractStartTime =
      (firstSlot - segment.overlapBefore) / effectiveFps;
    const extractEndTime = segment.overlapAfter
      ? Math.min(totalDuration, (nextSlot + 1) / effectiveFps)
      : totalDuration;
    segment.extractDuration = extractEndTime - segment.extractStartTime;
    segment.allocatedFrames += segment.overlapBefore + segment.overlapAfter;
    firstSlot = nextSlot;
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
 * Sort frames in place and alias overlap duplicates to the first survivor.
 * @param frames Collected entries whose segment index and local ID identify a frame.
 * @param effectiveFps Positive sampling frequency; half a frame interval is the threshold.
 * @returns Timestamp-ordered survivors and duplicate keys pointing directly to survivor keys.
 */
function deduplicateFrames(
  frames: FrameEntry[],
  effectiveFps: number,
): { unique: FrameEntry[]; aliases: Map<string, string> } {
  frames.sort((a, b) => a.frame.timestamp - b.frame.timestamp);

  const dupThreshold = 1 / (effectiveFps * 2);
  const unique: FrameEntry[] = [];
  const aliases = new Map<string, string>();

  for (const entry of frames) {
    if (unique.length > 0) {
      const last = unique[unique.length - 1];
      if (
        Math.abs(entry.frame.timestamp - last.frame.timestamp) < dupThreshold
      ) {
        aliases.set(
          `${entry.segmentIndex}:${entry.localId}`,
          `${last.segmentIndex}:${last.localId}`,
        );
        continue;
      }
    }
    unique.push(entry);
  }

  return { unique, aliases };
}

/**
 * Assign sequential global IDs and retain duplicate local IDs as aliases.
 * @param uniqueFrames Timestamp-ordered survivors with distinct segment/local keys.
 * @param aliases Duplicate keys pointing directly to keys in uniqueFrames.
 * @returns Remapped frames and a global ID lookup covering survivors and duplicates.
 */
function remapFrameIds(
  uniqueFrames: FrameEntry[],
  aliases: Map<string, string>,
): {
  frames: FrameNode[];
  globalIdMap: Map<string, number>;
} {
  const globalIdMap = new Map<string, number>(); // "segmentIndex:localId" -> globalId
  const frames: FrameNode[] = uniqueFrames.map((entry, globalId) => {
    globalIdMap.set(`${entry.segmentIndex}:${entry.localId}`, globalId);
    return {
      id: globalId,
      timestamp: entry.frame.timestamp,
      extractPath: entry.frame.extractPath,
    };
  });
  for (const [alias, survivor] of aliases) {
    globalIdMap.set(alias, globalIdMap.get(survivor)!);
  }
  return { frames, globalIdMap };
}

/**
 * Remap edges, dropping missing endpoints and self loops while keeping the highest pair score.
 * @param segmentResults Segment-local edges in encounter order.
 * @param globalIdMap Survivor and duplicate local keys mapped to global IDs.
 * @returns One edge per surviving directed pair without changing its score.
 */
function remapEdges(
  segmentResults: SegmentResult[],
  globalIdMap: Map<string, number>,
): ScoreEdge[] {
  const edges: ScoreEdge[] = [];
  const edgeMap = new Map<string, number>(); // "sourceId-targetId" -> index

  for (const result of segmentResults) {
    for (const edge of result.edges) {
      const newSourceId = globalIdMap.get(
        `${result.segment.index}:${edge.sourceId}`,
      );
      const newTargetId = globalIdMap.get(
        `${result.segment.index}:${edge.targetId}`,
      );

      if (newSourceId === undefined || newTargetId === undefined) continue;
      if (newSourceId === newTargetId) continue;

      const edgeKey = `${newSourceId}-${newTargetId}`;
      const existingIdx = edgeMap.get(edgeKey);

      if (existingIdx !== undefined) {
        if (edges[existingIdx].score < edge.score) {
          edges[existingIdx] = {
            sourceId: newSourceId,
            targetId: newTargetId,
            score: edge.score,
          };
        }
      } else {
        edgeMap.set(edgeKey, edges.length);
        edges.push({
          sourceId: newSourceId,
          targetId: newTargetId,
          score: edge.score,
        });
      }
    }
  }

  return edges;
}

/**
 * Remap animations, dropping missing or collapsed endpoints and retaining the first pair entry.
 * @param segmentResults Segment-local tracker entries in encounter order.
 * @param globalIdMap Survivor and duplicate local keys mapped to global IDs.
 * @returns One animation per directed pair with its original tracker duration and metadata.
 */
function remapAnimations(
  segmentResults: SegmentResult[],
  globalIdMap: Map<string, number>,
): AnimationMetadata[] {
  const animations = new Map<string, AnimationMetadata>();

  for (const result of segmentResults) {
    for (const anim of result.animations) {
      const newStartId = globalIdMap.get(
        `${result.segment.index}:${anim.startFrameId}`,
      );
      const newEndId = globalIdMap.get(
        `${result.segment.index}:${anim.endFrameId}`,
      );

      if (newStartId === undefined || newEndId === undefined) continue;
      if (newStartId === newEndId) continue;

      const animationKey = `${newStartId}-${newEndId}`;
      if (animations.has(animationKey)) continue;
      animations.set(animationKey, {
        ...anim,
        startFrameId: newStartId,
        endFrameId: newEndId,
      });
    }
  }

  return [...animations.values()];
}

/**
 * Merge multiple segment results into a single unified frame/edge/animation set.
 * @param segmentResults Local frames, edges and tracker entries with distinct segment indices.
 * @returns Global timestamp-ordered frames, aliased edges and animations without self loops.
 * Duplicate edges keep the higher score; duplicate animations keep the first tracker entry.
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
  const { unique, aliases } = deduplicateFrames(allFrames, effectiveFps);
  const { frames, globalIdMap } = remapFrameIds(unique, aliases);
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
    effectiveFps: segment.effectiveFps,
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
    segment.allocatedFrames,
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
    const weights = map(segments, (s) => s.duration / totalDuration);

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
      map(segments, (segment) =>
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
    const prunedFrames = filter(frames, (f) => survivingIds.has(f.id));
    options.onProgress?.('PRUNING', 100);

    // 8. Finalize output
    options.onProgress?.('FINALIZING', 0);

    const ctx: ProcessContext = {
      options: resolvedOptions,
      effectiveFps: segments[0]?.effectiveFps,
      sourceDurationSec: totalDuration,
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
