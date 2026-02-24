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

/**
 * Normalize raw G(t) scores to [0, 1] range via max-normalization.
 *
 * - Filters out non-finite and negative scores (treated as 0)
 * - If all scores are 0 or no valid scores exist, returns all zeros
 * - Avoids division by zero: only divides when maxScore > 0
 *
 * @returns normalized scores array (same length as input graph)
 */
function normalizeScores(graph: ScoreEdge[]): number[] {
  if (graph.length === 0) return [];

  const safeScores = graph.map((e) =>
    Number.isFinite(e.score) && e.score > 0 ? e.score : 0,
  );
  const maxScore = Math.max(...safeScores);

  if (maxScore === 0) return safeScores;

  return safeScores.map((s) => s / maxScore);
}

/**
 * Threshold-based pruning — O(N).
 *
 * Scores are normalized to [0, 1] via max-normalization.
 * threshold=0.5 means "keep frames where the change is at least 50%
 * of the maximum change observed in this sequence".
 *
 * First and last frames are always preserved (boundary protection).
 *
 * Unlike pruneTo (which targets an exact count via greedy merge),
 * this function has no count limit — every significant scene transition
 * above the threshold is preserved.
 */
export function pruneByThreshold(
  graph: ScoreEdge[],
  frames: FrameNode[],
  threshold: number,
): Set<number> {
  if (frames.length === 0) return new Set();

  const surviving = new Set<number>();
  surviving.add(frames[0]!.id);
  surviving.add(frames[frames.length - 1]!.id);

  const normalized = normalizeScores(graph);

  for (let i = 0; i < graph.length; i++) {
    if (normalized[i]! >= threshold) {
      surviving.add(graph[i]!.targetId);
    }
  }

  return surviving;
}

/**
 * Combined threshold + count pruning -- 2-stage pipeline.
 *
 * Stage 1: pruneByThreshold -- keep all frames with normalized score >= threshold
 * Stage 2: if result exceeds maxCount, rebuild subgraph with synthetic edges
 *          (min-score over each gap) and apply pruneTo on the surviving subset
 *
 * Edge reconstruction: for consecutive survivors A, B with removed frames
 * [x1, x2, ...] between them, the synthetic edge score is:
 *   min(score(A->x1), score(x1->x2), ..., score(xN->B))
 * This preserves the "weakest link" semantics.
 */
export function pruneByThresholdWithCap(
  graph: ScoreEdge[],
  frames: FrameNode[],
  threshold: number,
  maxCount: number,
): Set<number> {
  // Stage 1: threshold filtering
  const thresholdSurvivors = pruneByThreshold(graph, frames, threshold);

  // If already within cap, return as-is
  if (thresholdSurvivors.size <= maxCount) {
    return thresholdSurvivors;
  }

  // Stage 2: rebuild subgraph for surviving frames, then pruneTo
  const survivingFrames = frames.filter((f) => thresholdSurvivors.has(f.id));

  // Build index: frameId -> position in original frames array
  const idToOrigIdx = new Map<number, number>();
  for (let i = 0; i < frames.length; i++) {
    idToOrigIdx.set(frames[i]!.id, i);
  }

  // Build edge lookup: "sourceId:targetId" -> score (for original consecutive edges)
  const edgeLookup = new Map<string, number>();
  for (const e of graph) {
    edgeLookup.set(`${e.sourceId}:${e.targetId}`, e.score);
  }

  // Reconstruct edges between consecutive surviving frames
  const syntheticEdges: ScoreEdge[] = [];

  for (let i = 0; i < survivingFrames.length - 1; i++) {
    const srcSurvivor = survivingFrames[i]!;
    const tgtSurvivor = survivingFrames[i + 1]!;

    const srcOrigIdx = idToOrigIdx.get(srcSurvivor.id)!;
    const tgtOrigIdx = idToOrigIdx.get(tgtSurvivor.id)!;

    // Collect all original edges in the gap: src -> ... -> tgt
    let minScore = Infinity;
    for (let j = srcOrigIdx; j < tgtOrigIdx; j++) {
      const fromId = frames[j]!.id;
      const toId = frames[j + 1]!.id;
      const score = edgeLookup.get(`${fromId}:${toId}`) ?? 0;
      if (score < minScore) {
        minScore = score;
      }
    }

    syntheticEdges.push({
      sourceId: srcSurvivor.id,
      targetId: tgtSurvivor.id,
      score: minScore === Infinity ? 0 : minScore,
    });
  }

  return pruneTo(syntheticEdges, survivingFrames, maxCount);
}
