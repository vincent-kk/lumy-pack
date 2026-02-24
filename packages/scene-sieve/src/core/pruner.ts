import type { FrameNode, ScoreEdge } from '../types/index.js';

/**
 * Edge-aware greedy merge with re-linking.
 *
 * 1. Build a doubly-linked list of frames and an edge score map
 * 2. Find the lowest-score edge among surviving pairs (most similar)
 * 3. Remove the later frame (targetId), re-link neighbors
 * 4. Compute synthetic edge score = max(left, right) for the new link
 * 5. Repeat until surviving count === targetCount
 * 6. First and last frames are never removed (boundary preservation)
 */
export function pruneTo(
  graph: ScoreEdge[],
  frames: FrameNode[],
  targetCount: number,
): Set<number> {
  if (frames.length <= targetCount) {
    return new Set(frames.map((f) => f.id));
  }

  // Doubly-linked list: frameId -> prev/next frameId
  const prev = new Map<number, number>();
  const next = new Map<number, number>();

  for (let i = 0; i < frames.length; i++) {
    if (i > 0) prev.set(frames[i].id, frames[i - 1].id);
    if (i < frames.length - 1) next.set(frames[i].id, frames[i + 1].id);
  }

  // Edge score map: "srcId:tgtId" -> score
  const edgeScore = new Map<string, number>();
  for (const edge of graph) {
    edgeScore.set(`${edge.sourceId}:${edge.targetId}`, edge.score);
  }

  const surviving = new Set(frames.map((f) => f.id));
  const firstId = frames[0].id;
  const lastId = frames[frames.length - 1].id;

  while (surviving.size > targetCount) {
    // Find the lowest-score edge among surviving pairs
    let minScore = Infinity;
    let minKey = '';
    let minSrc = -1;
    let minTgt = -1;

    for (const [key, score] of edgeScore) {
      if (score >= minScore) continue;
      const sep = key.indexOf(':');
      const src = Number(key.slice(0, sep));
      const tgt = Number(key.slice(sep + 1));

      // Skip if either endpoint is already removed
      if (!surviving.has(src) || !surviving.has(tgt)) continue;
      // Never remove boundary frames
      if (tgt === firstId || tgt === lastId) continue;

      minScore = score;
      minKey = key;
      minSrc = src;
      minTgt = tgt;
    }

    if (minSrc === -1) break; // No removable edge found

    // Remove the later frame
    surviving.delete(minTgt);
    edgeScore.delete(minKey);

    // Re-link: connect minSrc -> next of minTgt
    const tgtNext = next.get(minTgt);
    if (tgtNext !== undefined) {
      const rightKey = `${minTgt}:${tgtNext}`;
      const rightScore = edgeScore.get(rightKey) ?? 0;
      edgeScore.delete(rightKey);

      // Synthetic edge: max of the two merged edges
      const newScore = Math.max(minScore, rightScore);
      edgeScore.set(`${minSrc}:${tgtNext}`, newScore);

      next.set(minSrc, tgtNext);
      prev.set(tgtNext, minSrc);
    } else {
      next.delete(minSrc);
    }

    prev.delete(minTgt);
    next.delete(minTgt);
  }

  return surviving;
}
