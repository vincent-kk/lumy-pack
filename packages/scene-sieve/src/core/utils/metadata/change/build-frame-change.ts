import { map } from '@winglet/common-utils';

import type { FrameChange, ScoreEdge } from '../../../../types/index.js';

import { scaleBoundingBox } from '../scale-bounding-box.js';
import { selectRegions } from './select-regions.js';
import { unionArea } from './union-area.js';

/**
 * Aggregate adjacent-pair evidence across one selected-frame span.
 * @param input - Ordered raw edges, one-based previous ID, skipped count and dimensions.
 * @returns Rounded raw scores, analysis-space union ratio and output-space regions.
 */
export function buildFrameChange(input: {
  spanEdges: ScoreEdge[];
  fromFrameId: number;
  skippedCandidates: number;
  analysisResolution: { width: number; height: number };
  outputResolution: { width: number; height: number };
  regionLimit: number;
}): FrameChange {
  const { spanEdges, fromFrameId, skippedCandidates, analysisResolution, outputResolution, regionLimit } = input;
  const boxes = spanEdges.flatMap((edge) => edge.change?.regions ?? []);
  const area = analysisResolution.width * analysisResolution.height;
  const peakScore = spanEdges.reduce((peak, edge) => Math.max(peak, edge.score), 0);
  const sumScore = spanEdges.reduce((sum, edge) => sum + edge.score, 0);
  const areaRatio = area > 0 ? Math.max(0, Math.min(1, unionArea(boxes) / area)) : 0;
  const regions = area > 0 ? selectRegions(map(boxes, (box) => scaleBoundingBox(
    box, outputResolution.width / analysisResolution.width,
    outputResolution.height / analysisResolution.height,
    outputResolution.width, outputResolution.height,
  )), regionLimit) : [];
  return {
    fromFrameId, skippedCandidates,
    peakScore: Math.round(peakScore * 1e6) / 1e6,
    sumScore: Math.round(sumScore * 1e6) / 1e6,
    areaRatio: Math.round(areaRatio * 1e4) / 1e4,
    regions,
  };
}
