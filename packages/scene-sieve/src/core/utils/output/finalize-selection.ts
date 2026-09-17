import { PACKAGE_VERSION } from '../../../constants/package-version.js';
import type { AnimationMetadata, FrameNode, ProcessContext, SieveMetadata } from '../../../types/index.js';
import { finalizeOutput, readFramesAsBuffers } from '../../workspace/index.js';

import { buildSieveMetadata } from '../metadata/build-sieve-metadata.js';
import { buildVideoMetadata } from '../metadata/build-video-metadata.js';
import { renderContactSheet } from '../sheet/render-contact-sheet.js';

/**
 * Read output dimensions once, render optional sheets and finalize the shared v2 document.
 * @param ctx - Pipeline state owned by the orchestrator; this function does not mutate it.
 * @param selected - Selected frames in temporal order.
 * @returns Mode-specific output, the document and zero-based API animations.
 * @throws Propagates image, rendering and output I/O errors to the orchestrator.
 */
export async function finalizeSelection(ctx: ProcessContext, selected: FrameNode[]): Promise<{
  outputFiles: string[];
  outputBuffers?: Buffer[];
  document: SieveMetadata;
  animations: AnimationMetadata[];
  sheetBuffer?: Buffer;
}> {
  const { video, animations } = await buildVideoMetadata(ctx, selected, ctx.analysisResolution);
  const sheet = ctx.options.sheet && selected.length > 0 &&
    video.resolution.width > 0 && video.resolution.height > 0
    ? await renderContactSheet({
      selected, resolution: video.resolution, options: ctx.options.sheet,
      quality: ctx.options.quality,
    }) : undefined;
  const document = buildSieveMetadata({
    ctx, selected, video, animations, version: PACKAGE_VERSION,
    ...(sheet ? { sheet: sheet.metadata } : {}),
  });
  if (ctx.options.mode === 'file') {
    const outputFiles = await finalizeOutput(ctx, selected, document, sheet?.buffer);
    return { outputFiles, document, animations };
  }
  const outputBuffers = await readFramesAsBuffers(selected, ctx.options.quality);
  return {
    outputFiles: [], outputBuffers, document, animations,
    ...(sheet ? { sheetBuffer: sheet.buffer } : {}),
  };
}
