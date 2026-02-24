import { randomUUID } from 'node:crypto';

import type { ProcessContext, SieveOptions, SieveResult } from '../types/index.js';
import { DEFAULT_COUNT, DEFAULT_FPS, DEFAULT_SCALE } from '../constants.js';
import { logger, setDebugMode } from '../utils/logger.js';
import { deriveOutputPath } from '../utils/paths.js';
import { analyzeFrames } from './analyzer.js';
import { extractFrames } from './extractor.js';
import { pruneTo } from './pruner.js';
import { cleanupWorkspace, createWorkspace, finalizeOutput } from './workspace.js';

export async function runPipeline(options: SieveOptions): Promise<SieveResult> {
  const startTime = Date.now();
  const sessionId = randomUUID();
  const debug = options.debug ?? false;

  if (debug) setDebugMode(true);

  const resolvedOptions: ProcessContext['options'] = {
    inputPath: options.inputPath,
    count: options.count ?? DEFAULT_COUNT,
    outputPath: options.outputPath ?? deriveOutputPath(options.inputPath),
    fps: options.fps ?? DEFAULT_FPS,
    scale: options.scale ?? DEFAULT_SCALE,
    debug,
  };

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

    // 2. Extract frames
    ctx.status = 'EXTRACTING';
    ctx.frames = await extractFrames(ctx);

    // 3. Analyze frame similarity
    ctx.status = 'ANALYZING';
    ctx.graph = await analyzeFrames(ctx);

    // 4. Prune to target count
    ctx.status = 'PRUNING';
    const survivingIds = pruneTo(ctx.graph, ctx.frames, resolvedOptions.count);
    const prunedFrames = ctx.frames.filter((f) => survivingIds.has(f.id));
    ctx.emitProgress(100);

    // 5. Finalize output
    ctx.status = 'FINALIZING';
    const outputFiles = await finalizeOutput(ctx, prunedFrames);
    ctx.emitProgress(100);

    ctx.status = 'SUCCESS';
    logger.success(
      `Extracted ${prunedFrames.length} scenes from ${ctx.frames.length} frames`,
    );

    return {
      success: true,
      originalFramesCount: ctx.frames.length,
      prunedFramesCount: prunedFrames.length,
      outputFiles,
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
