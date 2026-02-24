import { NORMALIZATION_PERCENTILE } from '../constants.js';
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
    heap.push({
      score: edge.score,
      srcId: edge.sourceId,
      tgtId: edge.targetId,
    });
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
 * Normalize raw G(t) scores to [0, 1] range via percentile-based normalization.
 *
 * Uses P90 (configurable via NORMALIZATION_PERCENTILE) as the reference score
 * instead of global max. This prevents a single outlier transition from
 * suppressing all other meaningful changes.
 *
 * Scores above the percentile reference are capped at 1.0.
 *
 * **Graceful degradation:** When the number of positive scores is 10 or fewer,
 * P90 equals the maximum value -- the function behaves identically to
 * max-normalization. This is expected and acceptable for small inputs.
 *
 * - Filters out non-finite and negative scores (treated as 0)
 * - If all scores are 0 or no valid scores exist, returns all zeros
 *
 * @returns normalized scores array (same length as input graph)
 */
function normalizeScores(graph: ScoreEdge[]): number[] {
  if (graph.length === 0) return [];

  const safeScores = graph.map((e) =>
    Number.isFinite(e.score) && e.score > 0 ? e.score : 0,
  );

  // Sort ascending to find percentile reference
  const sorted = [...safeScores].filter((s) => s > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return safeScores;

  // P90 (or configured percentile) as normalization reference
  const pIdx = Math.min(
    Math.floor(sorted.length * NORMALIZATION_PERCENTILE),
    sorted.length - 1,
  );
  const refScore = sorted[pIdx]!;

  // Normalize: scores above refScore are capped at 1.0
  return safeScores.map((s) => Math.min(s / refScore, 1.0));
}

/**
 * Non-Maximum Suppression (NMS) for consecutive edge runs.
 *
 * Consecutive edges share overlapping frames (edge i: frame i->i+1,
 * edge i+1: frame i+1->i+2), so consecutive passing edges indicate
 * the same visual transition region. This function groups consecutive
 * passing edge indices into "runs" and keeps all distinct peaks per run.
 *
 * Multi-peak detection: within each run, strict local maxima (score higher
 * than both neighbors) are identified. Each local maximum represents a
 * distinct visual transition. If no strict local maxima exist (plateau or
 * monotonic sequence), the global peak of the run is selected as fallback.
 *
 * Single-element runs are unaffected (isolated transitions preserved).
 *
 * @param graph - full ScoreEdge array (for targetId lookup)
 * @param passingIndices - edge indices that passed threshold filtering (sorted ascending)
 * @param normalizedScores - normalized score array (same length as graph)
 * @returns Set of targetIds to add to surviving set (one or more per run)
 */
export function suppressConsecutiveRuns(
  graph: ScoreEdge[],
  passingIndices: number[],
  normalizedScores: number[],
): Set<number> {
  const result = new Set<number>();

  let runStart = 0;
  while (runStart < passingIndices.length) {
    let runEnd = runStart;

    // Extend the run while indices are consecutive
    while (
      runEnd + 1 < passingIndices.length &&
      passingIndices[runEnd + 1]! === passingIndices[runEnd]! + 1
    ) {
      runEnd++;
    }

    const runLen = runEnd - runStart + 1;

    if (runLen === 1) {
      // Single-element run: always keep
      result.add(graph[passingIndices[runStart]!]!.targetId);
    } else {
      // Multi-element run: find all strict local maxima
      const peaks: number[] = [];

      for (let j = runStart; j <= runEnd; j++) {
        const idx = passingIndices[j]!;
        const score = normalizedScores[idx]!;
        const prevScore =
          j > runStart ? normalizedScores[passingIndices[j - 1]!]! : -Infinity;
        const nextScore =
          j < runEnd ? normalizedScores[passingIndices[j + 1]!]! : -Infinity;

        if (score > prevScore && score > nextScore) {
          peaks.push(idx);
        }
      }

      if (peaks.length > 0) {
        // Keep all distinct peaks
        for (const peakIdx of peaks) {
          result.add(graph[peakIdx]!.targetId);
        }
      } else {
        // Plateau or monotonic: fallback to global peak
        let peakIdx = passingIndices[runStart]!;
        for (let j = runStart + 1; j <= runEnd; j++) {
          const idx = passingIndices[j]!;
          if (normalizedScores[idx]! > normalizedScores[peakIdx]!) {
            peakIdx = idx;
          }
        }
        result.add(graph[peakIdx]!.targetId);
      }
    }

    runStart = runEnd + 1;
  }

  return result;
}

/**
 * Threshold-based pruning with NMS -- O(N).
 *
 * 1. Scores are normalized to [0, 1] via percentile normalization.
 * 2. Edges with normalized score >= threshold are collected.
 * 3. Non-Maximum Suppression groups consecutive passing edges and keeps
 *    only the peak per run, preventing near-duplicate frame selection
 *    from a single visual transition.
 *
 * First and last frames are always preserved (boundary protection).
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

  // Stage 1: threshold filtering (collect indices that pass)
  const passingIndices: number[] = [];
  for (let i = 0; i < graph.length; i++) {
    if (normalized[i]! >= threshold) {
      passingIndices.push(i);
    }
  }

  // Stage 2: Non-Maximum Suppression -- one peak per consecutive run
  const nmsTargets = suppressConsecutiveRuns(graph, passingIndices, normalized);
  for (const id of nmsTargets) {
    surviving.add(id);
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
