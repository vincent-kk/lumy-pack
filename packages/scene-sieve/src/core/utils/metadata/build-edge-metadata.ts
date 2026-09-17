import { map } from '@winglet/common-utils';

import type { EdgeMetadata, ScoreEdge } from '../../../types/index.js';

import { unionArea } from './change/union-area.js';

/**
 * Serialize raw candidate edges in graph order.
 * @param graph - Adjacent-pair edges, optionally carrying tracker partitions.
 * @param analysisResolution - Analysis dimensions used for both area fractions.
 * @returns One-based IDs with six-decimal scores and four-decimal clamped ratios.
 */
export function buildEdgeMetadata(
  graph: ScoreEdge[], analysisResolution: { width: number; height: number },
): EdgeMetadata[] {
  const area = analysisResolution.width * analysisResolution.height;
  return map(graph, (edge) => ({
    sourceFrameId: edge.sourceId + 1,
    targetFrameId: edge.targetId + 1,
    score: Math.round(edge.score * 1e6) / 1e6,
    areaRatio: area > 0
      ? Math.round(Math.max(0, Math.min(1, unionArea(edge.change?.regions ?? []) / area)) * 1e4) / 1e4 : 0,
    animatedAreaRatio: area > 0
      ? Math.round(Math.max(0, Math.min(1, unionArea(edge.change?.animatedRegions ?? []) / area)) * 1e4) / 1e4 : 0,
  }));
}
