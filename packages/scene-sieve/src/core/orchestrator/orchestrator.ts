import { randomUUID } from 'node:crypto';

import { filter } from '@winglet/common-utils';

import type {
  ProcessContext,
  SieveOptions,
  SieveResult,
} from '../../types/index.js';
import { logger, setDebugMode } from '../../logging/logger.js';

import { analyzeFrames } from '../analyzer/index.js';
import { finalizeSelection } from '../utils/output/finalize-selection.js';
import { extractFrames } from '../extractor/index.js';
import { resolveInput, resolveOptions } from '../input-resolver/index.js';
import { pruneByThresholdWithCap } from '../pruner/index.js';
import { runSegmentedPipeline, shouldSegment } from '../segmenter/index.js';
import {
  cleanupWorkspace,
  createWorkspace,
} from '../workspace/index.js';

/**
 * Run the five pipeline stages, delegating segmented inputs to the segmenter.
 * @param options - Mode-specific input and optional pipeline settings.
 * @returns Selected outputs with v2 frame metadata and zero-based API animations.
 * @throws Propagates stage failures after cleaning the workspace unless debug is enabled.
 */
export async function runPipeline(options: SieveOptions): Promise<SieveResult> {
  setDebugMode(options.debug ?? false);

  const resolvedOptions = resolveOptions(options);

  // Long video segmentation: delegate to segmented pipeline if applicable
  if (shouldSegment(resolvedOptions, options)) {
    return runSegmentedPipeline(options, resolvedOptions);
  }

  const startTime = Date.now();
  const sessionId = randomUUID();

  const ctx: ProcessContext = {
    options: resolvedOptions,
    workspacePath: '',
    frames: [],
    graph: [],
    status: 'INIT',
    emitProgress: (percent) => {
      if (
        options.onProgress &&
        ctx.status !== 'INIT' &&
        ctx.status !== 'SUCCESS' &&
        ctx.status !== 'FAILED'
      ) {
        options.onProgress(ctx.status, percent);
      }
    },
  };

  try {
    // 1. Init workspace
    ctx.workspacePath = await createWorkspace(sessionId);
    logger.debug(`Workspace created: ${ctx.workspacePath}`);

    // 2. Resolve input
    ctx.status = 'EXTRACTING';
    const { frames: resolvedFrames, resolvedInputPath } = await resolveInput(
      options,
      ctx.workspacePath,
    );

    if (resolvedOptions.mode === 'frames') {
      // 'frames' mode: buffers already written as FrameNodes
      ctx.frames = resolvedFrames;
      ctx.effectiveFps = 1;
    } else {
      // 'file' or 'buffer' mode: extract frames via FFmpeg
      const extractCtx: ProcessContext = {
        ...ctx,
        options: {
          ...resolvedOptions,
          inputPath: resolvedInputPath,
        },
      };
      ctx.frames = await extractFrames(extractCtx);
      ctx.effectiveFps = extractCtx.effectiveFps;
      ctx.sourceDurationSec = extractCtx.sourceDurationSec;
    }

    ctx.emitProgress(100);

    // 3. Analyze frame similarity
    ctx.status = 'ANALYZING';
    const { edges, animations, analysisResolution } = await analyzeFrames(ctx);
    ctx.graph = edges;
    ctx.animations = animations;
    ctx.analysisResolution = analysisResolution;

    // 4. Prune: threshold + count cap
    ctx.status = 'PRUNING';
    const survivingIds = pruneByThresholdWithCap(
      ctx.graph,
      ctx.frames,
      resolvedOptions.threshold,
      resolvedOptions.count,
    );
    const prunedFrames = filter(ctx.frames, (f) => survivingIds.has(f.id));
    ctx.emitProgress(100);

    // 5. Finalize output
    ctx.status = 'FINALIZING';

    const finalized = await finalizeSelection(ctx, prunedFrames);
    ctx.emitProgress(100);

    ctx.status = 'SUCCESS';
    logger.success(
      `Extracted ${prunedFrames.length} scenes from ${ctx.frames.length} frames`,
    );

    return {
      success: true,
      originalFramesCount: ctx.frames.length,
      prunedFramesCount: prunedFrames.length,
      outputFiles: finalized.outputFiles,
      outputBuffers: finalized.outputBuffers,
      video: finalized.document.video,
      animations: finalized.animations,
      frames: finalized.document.frames,
      ...(finalized.document.sheet ? { sheet: finalized.document.sheet } : {}),
      ...(finalized.sheetBuffer ? { sheetBuffer: finalized.sheetBuffer } : {}),
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    ctx.status = 'FAILED';
    ctx.error = error instanceof Error ? error : new Error(String(error));
    logger.error(`Pipeline failed: ${ctx.error.message}`);
    throw ctx.error;
  } finally {
    if (!resolvedOptions.debug) {
      await cleanupWorkspace(ctx.workspacePath);
    } else {
      logger.debug(`Debug mode: workspace preserved at ${ctx.workspacePath}`);
    }
  }
}
