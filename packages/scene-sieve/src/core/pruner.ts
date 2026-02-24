import type { FrameNode, ScoreEdge } from '../types/index.js';

/**
 * Greedy merge algorithm to prune frames down to targetCount.
 *
 * 1. Sort ScoreEdges by score ascending (lowest = most similar)
 * 2. For each edge, if both source and target are alive, remove the later frame
 * 3. Repeat until (frames.length - targetCount) removals
 * 4. Return surviving frame IDs as a Set
 */
export function pruneTo(
  graph: ScoreEdge[],
  frames: FrameNode[],
  targetCount: number,
): Set<number> {
  if (frames.length <= targetCount) {
    return new Set(frames.map((f) => f.id));
  }

  const surviving = new Set(frames.map((f) => f.id));
  const mergeTarget = frames.length - targetCount;

  const sortedEdges = [...graph].sort((a, b) => a.score - b.score);

  let mergeCount = 0;
  for (const edge of sortedEdges) {
    if (mergeCount >= mergeTarget) break;

    if (surviving.has(edge.sourceId) && surviving.has(edge.targetId)) {
      surviving.delete(edge.targetId);
      mergeCount++;
    }
  }

  return surviving;
}
