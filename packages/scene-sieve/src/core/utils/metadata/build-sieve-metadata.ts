import { basename } from 'node:path';

import { map } from '@winglet/common-utils';

import { METADATA_VERSION } from '../../../constants/pipeline-defaults.js';
import type { AnimationMetadata, FrameNode, ProcessContext, SheetMetadata, SieveMetadata, VideoMetadata } from '../../../types/index.js';

import { buildEdgeMetadata } from './build-edge-metadata.js';
import { buildFrameMetadata } from './build-frame-metadata.js';
import { buildToolMetadata } from './build-tool-metadata.js';

/**
 * Assemble the complete v2 document without I/O or mutation.
 * @param input - Pipeline state, selections, output-space video and zero-based animations.
 * @returns Contract-ordered metadata, omitting unrequested optional keys entirely.
 */
export function buildSieveMetadata(input: {
  ctx: ProcessContext;
  selected: FrameNode[];
  video: VideoMetadata;
  animations: AnimationMetadata[];
  version: string;
  sheet?: SheetMetadata;
}): SieveMetadata {
  const { ctx, selected, video, animations, version, sheet } = input;
  const analysisResolution = ctx.analysisResolution ?? { width: 0, height: 0 };
  return {
    metadataVersion: METADATA_VERSION,
    tool: buildToolMetadata(ctx.options, version),
    video: {
      originalDurationMs: video.originalDurationMs,
      fps: video.fps,
      resolution: video.resolution,
      candidatesCount: ctx.frames.length,
      selectedCount: selected.length,
      source: {
        fileName: ctx.options.mode === 'file' && ctx.options.inputPath
          ? basename(ctx.options.inputPath) : null,
        mode: ctx.options.mode,
      },
    },
    frames: buildFrameMetadata({
      frames: ctx.frames, graph: ctx.graph, selected,
      originalDurationMs: video.originalDurationMs, analysisResolution,
      outputResolution: video.resolution,
    }),
    animations: map(animations, (animation) => ({
      ...animation,
      startFrameId: animation.startFrameId + 1,
      endFrameId: animation.endFrameId + 1,
      durationMs: Math.round(animation.durationMs),
    })),
    ...(sheet ? { sheet } : {}),
    ...(ctx.options.includeEdges ? { edges: buildEdgeMetadata(ctx.graph, analysisResolution) } : {}),
  };
}
