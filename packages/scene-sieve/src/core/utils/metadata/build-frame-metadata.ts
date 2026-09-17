import { map } from '@winglet/common-utils';

import { CHANGE_REGION_LIMIT } from '../../../constants/pipeline-defaults.js';
import type { FrameMetadata, FrameNode, ScoreEdge } from '../../../types/index.js';

import { buildFrameChange } from './change/build-frame-change.js';

/**
 * Describe selected frames using candidate adjacency rather than synthetic pruning edges.
 * @param input - Chronological candidates and selections, raw graph and output dimensions.
 * @returns One-based frame summaries with rounded timestamps and nonnegative holds.
 */
export function buildFrameMetadata(input: {
  frames: FrameNode[];
  graph: ScoreEdge[];
  selected: FrameNode[];
  originalDurationMs: number;
  analysisResolution: { width: number; height: number };
  outputResolution: { width: number; height: number };
}): FrameMetadata[] {
  const { frames, graph, selected, originalDurationMs, analysisResolution, outputResolution } = input;
  const edgesByPair = new Map(map(graph, (edge) => [`${edge.sourceId}:${edge.targetId}`, edge] as const));
  const candidateIndices = new Map(map(frames, (frame, index) => [frame.id, index] as const));
  const padding = Math.max(4, String(frames.length).length);
  return map(selected, (frame, index) => {
    const timestampMs = Math.round(frame.timestamp * 1000);
    const nextTimestampMs = index + 1 < selected.length
      ? Math.round(selected[index + 1].timestamp * 1000) : originalDurationMs;
    const previous = selected[index - 1];
    const previousIndex = previous ? candidateIndices.get(previous.id)! : 0;
    const currentIndex = candidateIndices.get(frame.id)!;
    const spanEdges: ScoreEdge[] = [];
    if (previous) {
      for (let i = previousIndex; i < currentIndex; i++) {
        const edge = edgesByPair.get(`${frames[i].id}:${frames[i + 1].id}`);
        if (edge) spanEdges.push(edge);
      }
    }
    return {
      step: index + 1,
      fileName: `frame_${String(frame.id + 1).padStart(padding, '0')}.jpg`,
      frameId: frame.id + 1,
      timestampMs,
      holdsMs: Math.max(0, nextTimestampMs - timestampMs),
      change: previous ? buildFrameChange({
        spanEdges, fromFrameId: previous.id + 1,
        skippedCandidates: currentIndex - previousIndex - 1,
        analysisResolution, outputResolution, regionLimit: CHANGE_REGION_LIMIT,
      }) : null,
    };
  });
}
