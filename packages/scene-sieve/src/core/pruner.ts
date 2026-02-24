import type { FrameNode, ScoreEdge } from '../types/index.js';
import { MinHeap } from '../utils/min-heap.js';

interface EdgeEntry {
  score: number;
  srcId: number;
  tgtId: number;
}

/**
 * Edge-aware greedy merge with re-linking — O(N log N).
 *
 * 1. Build a doubly-linked list of frames
 * 2. Insert all edges into a min-heap
 * 3. Pop the lowest-score edge (most similar pair)
 * 4. Remove the later frame (tgtId), re-link neighbors
 * 5. Push synthetic edge with score = max(left, right)
 * 6. Repeat until surviving count === targetCount
 * 7. First and last frames are never removed (boundary preservation)
 *
 * Stale heap entries (involving removed frames) are lazily skipped on pop.
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
    if (i > 0) prev.set(frames[i]!.id, frames[i - 1]!.id);
    if (i < frames.length - 1) next.set(frames[i]!.id, frames[i + 1]!.id);
  }

  // Edge score lookup for re-linking
  const edgeScore = new Map<string, number>();
  const heap = new MinHeap<EdgeEntry>();

  for (const edge of graph) {
    edgeScore.set(`${edge.sourceId}:${edge.targetId}`, edge.score);
    heap.push({ score: edge.score, srcId: edge.sourceId, tgtId: edge.targetId });
  }

  const surviving = new Set(frames.map((f) => f.id));
  const firstId = frames[0]!.id;
  const lastId = frames[frames.length - 1]!.id;

  while (surviving.size > targetCount && heap.size > 0) {
    const entry = heap.pop()!;

    // Lazy deletion: skip edges involving removed frames
    if (!surviving.has(entry.srcId) || !surviving.has(entry.tgtId)) continue;

    // Skip superseded edges (replaced by a synthetic edge with different score)
    const key = `${entry.srcId}:${entry.tgtId}`;
    if (edgeScore.get(key) !== entry.score) continue;

    // Boundary protection: never remove first or last frame
    if (entry.tgtId === firstId || entry.tgtId === lastId) continue;

    // Remove the later frame
    surviving.delete(entry.tgtId);
    edgeScore.delete(key);

    // Re-link: connect srcId -> next of tgtId
    const tgtNext = next.get(entry.tgtId);
    if (tgtNext !== undefined) {
      const rightKey = `${entry.tgtId}:${tgtNext}`;
      const rightScore = edgeScore.get(rightKey) ?? 0;
      edgeScore.delete(rightKey);

      // Synthetic edge: max of the two merged edges
      const newScore = Math.max(entry.score, rightScore);
      edgeScore.set(`${entry.srcId}:${tgtNext}`, newScore);
      heap.push({ score: newScore, srcId: entry.srcId, tgtId: tgtNext });

      next.set(entry.srcId, tgtNext);
      prev.set(tgtNext, entry.srcId);
    } else {
      next.delete(entry.srcId);
    }

    prev.delete(entry.tgtId);
    next.delete(entry.tgtId);
  }

  return surviving;
}
