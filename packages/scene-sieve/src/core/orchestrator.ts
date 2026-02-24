import { randomUUID } from 'node:crypto';

import type { ProcessContext, SieveOptions, SieveResult } from '../types/index.js';
import { logger, setDebugMode } from '../utils/logger.js';
import { analyzeFrames } from './analyzer.js';
import { extractFrames } from './extractor.js';
import { resolveInput, resolveOptions } from './input-resolver.js';
import { pruneTo, pruneByThreshold } from './pruner.js';
import {
  cleanupWorkspace,
  createWorkspace,
  finalizeOutput,
  readFramesAsBuffers,
} from './workspace.js';

export async function runPipeline(options: SieveOptions): Promise<SieveResult> {
  const startTime = Date.now();
  const sessionId = randomUUID();
  const debug = options.debug ?? false;

  if (debug) setDebugMode(true);

  const resolvedOptions = resolveOptions(options);

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
    }

    ctx.emitProgress(100);

    // 3. Analyze frame similarity
    ctx.status = 'ANALYZING';
    ctx.graph = await analyzeFrames(ctx);

    // 4. Prune: threshold mode (keep all above threshold) or count mode (keep exact N)
    ctx.status = 'PRUNING';
    const survivingIds =
      resolvedOptions.threshold !== undefined
        ? pruneByThreshold(ctx.graph, ctx.frames, resolvedOptions.threshold)
        : pruneTo(ctx.graph, ctx.frames, resolvedOptions.count);
    const prunedFrames = ctx.frames.filter((f) => survivingIds.has(f.id));
    ctx.emitProgress(100);

    // 5. Finalize output
    ctx.status = 'FINALIZING';

    let outputFiles: string[] = [];
    let outputBuffers: Buffer[] | undefined;

    if (resolvedOptions.mode === 'buffer' || resolvedOptions.mode === 'frames') {
      // Return buffers instead of writing to disk
      outputBuffers = await readFramesAsBuffers(prunedFrames);
      ctx.emitProgress(100);
    } else {
      // 'file' mode: write to output directory
      outputFiles = await finalizeOutput(ctx, prunedFrames);
      ctx.emitProgress(100);
    }

    ctx.status = 'SUCCESS';
    logger.success(
      `Extracted ${prunedFrames.length} scenes from ${ctx.frames.length} frames`,
    );

    return {
      success: true,
      originalFramesCount: ctx.frames.length,
      prunedFramesCount: prunedFrames.length,
      outputFiles,
      outputBuffers,
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
