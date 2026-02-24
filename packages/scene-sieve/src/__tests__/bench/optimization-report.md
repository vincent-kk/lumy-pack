# scene-sieve Performance Optimization Report

Generated: 2026-02-24
Node.js: v20.19.5 | Platform: darwin

---

## 1. Benchmark Results

### 1.1 DBSCAN Clustering

| Input Size (n) | Mean (ms) | Std Dev | Mem Delta (KB) |
|----------------|-----------|---------|----------------|
| 100            | 0.419     | ±0.495  | -164.7         |
| 500            | 0.940     | ±0.033  | 202.4          |
| 1000           | 2.557     | ±0.507  | -22.2          |
| 3000           | 24.831    | ±0.833  | 176.1          |
| 5000           | 65.187    | ±1.203  | -193.7         |

#### Empirical Complexity Analysis

| Transition         | Size Ratio | Time Ratio | Empirical Exponent |
|--------------------|-----------|------------|-------------------|
| n=100 → n=500     | 5.0x      | 2.24x      | O(n^0.50)         |
| n=500 → n=1000    | 2.0x      | 2.72x      | O(n^1.44)         |
| n=1000 → n=3000   | 3.0x      | 9.71x      | O(n^2.07)         |
| n=3000 → n=5000   | 1.7x      | 2.63x      | O(n^1.89)         |

**Conclusion**: DBSCAN shows ~O(n^2) behavior at larger scales (n≥1000), consistent with
the `findNeighbors` O(n) linear scan called once per point. At small n (<500), the Set-based
seed tracking overhead dominates, yielding sub-quadratic apparent complexity.

Real-world inputs from AKAZE detection typically produce 50–500 keypoints per frame pair,
so DBSCAN n=1000 (2.56 ms) is the practical worst case. At n=5000 (65 ms), DBSCAN
would be a significant bottleneck.

### 1.2 IoU N×N All-Pairs

| N   | Pairs   | Mean (ms) | Std Dev |
|-----|---------|-----------|---------|
| 10  | 45      | 0.042     | ±0.045  |
| 50  | 1225    | 0.168     | ±0.051  |
| 100 | 4950    | 0.149     | ±0.077  |
| 500 | 124750  | 2.460     | ±0.909  |

**Conclusion**: IoU is extremely cheap per call (~20 ns/pair). At realistic scales (IoUTracker
maintains only matched bounding boxes, typically <30 regions), IoU is not a bottleneck.
N=500 all-pairs in 2.46 ms shows good scalability for realistic usage.

### 1.3 Information Gain Scoring

| Clusters | Mean (ms) | Std Dev |
|----------|-----------|---------|
| 5        | 0.0003    | ±0.0001 |
| 20       | 0.0002    | ±0.0000 |
| 50       | 0.0003    | ±0.0000 |
| 100      | 0.0007    | ±0.0001 |
| 300      | 0.0021    | ±0.0001 |

**Conclusion**: `computeInformationGain` is O(n) and sub-millisecond even at 300 clusters.
Completely negligible. No optimization needed.

---

## 2. Bottleneck Analysis

### Primary Bottlenecks (ranked by impact)

1. **OpenCV WASM AKAZE Detection** (dominant cost, not benchmarked directly)
   - `detectAndCompute` runs AKAZE feature extraction on each frame
   - AKAZE is O(W×H×octaves) per image — for 1280×720 grayscale, this is ~10–100 ms per call
   - Called twice per frame pair (frame_i and frame_{i+1})
   - **Estimated contribution**: 80–95% of total pipeline time

2. **Sharp Preprocessing** (moderate cost)
   - Each frame: resize + grayscale + blur + raw buffer = ~5–20 ms per frame
   - Called once per frame (N frames total, not N pairs)
   - Sequential `Promise.all` within batch is parallel but still disk-bound

3. **DBSCAN at n>1000** (potential bottleneck)
   - O(n²) linear scan in `findNeighbors`
   - At n=3000: 24.8 ms, at n=5000: 65.2 ms
   - AKAZE on complex scenes can produce 2000–5000 keypoints
   - **Risk**: dense-texture frames (crowds, foliage) → large n → slow DBSCAN

4. **OpenCV WASM Initialization** (one-time cost)
   - Cold start: 500 ms – 3000 ms (WASM compilation + heap allocation)
   - Already mitigated by lazy singleton `cvReady` pattern
   - No further optimization needed

5. **Memory Allocation Patterns**
   - Each `preprocessFrame` creates a new `Uint8Array` from Buffer
   - OpenCV Mats allocated and deleted per frame pair (correct, but GC pressure)
   - DBSCAN allocates `new Array<number>()` + `new Set()` per call

---

## 3. Optimization Proposals

### 3.1 DBSCAN: Grid-Based Spatial Indexing (QUICK WIN)

**Target**: Replace O(n) linear scan in `findNeighbors` with O(1) average grid lookup.

**Current**: `findNeighbors` iterates all n points for each of n core points → O(n²) total.

**Proposal**: Partition the image into grid cells of size `eps × eps`. For each query point,
only check the 9 neighboring cells (3×3 grid around the cell). Average neighbor check
becomes O(k) where k = average points per cell.

```typescript
// Grid cell size = eps
// Cell (cx, cy) = floor(x / eps), floor(y / eps)
// Neighbors of point p = check cells (cx±1, cy±1)

class SpatialGrid {
  private cells = new Map<string, number[]>();
  constructor(points: Point2D[], private cellSize: number) {
    for (let i = 0; i < points.length; i++) {
      const key = this.cellKey(points[i]!.x, points[i]!.y);
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key)!.push(i);
    }
  }
  private cellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }
  query(p: Point2D, eps: number): number[] {
    const cx = Math.floor(p.x / this.cellSize);
    const cy = Math.floor(p.y / this.cellSize);
    const result: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const candidates = this.cells.get(key);
        if (candidates) result.push(...candidates);
      }
    }
    return result;
  }
}
```

| Metric                | Before         | After (estimated) |
|-----------------------|----------------|-------------------|
| n=1000 time           | 2.56 ms        | ~0.3 ms           |
| n=3000 time           | 24.8 ms        | ~1.0 ms           |
| n=5000 time           | 65.2 ms        | ~1.7 ms           |
| Complexity            | O(n²)          | O(n) average      |
| Implementation effort | —              | Low               |
| Trade-offs            | —              | Extra Map memory (~n entries); string key allocation |

**Estimated improvement**: 15–40x speedup at n≥1000. Minimal impact at n<200.

---

### 3.2 Sharp Preprocessing: Pipeline Reuse & Concurrent I/O (QUICK WIN)

**Current**: `preprocessFrame` creates a new sharp pipeline per frame, sequentially
resolved via `Promise.all` within each batch.

**Proposal A – Concurrent I/O (already partially done)**:
The current `Promise.all(frames.map(...preprocessFrame...))` is already concurrent for I/O.
No major change needed here.

**Proposal B – Avoid redundant `new Uint8Array(data.buffer)` copy**:
Sharp's `.raw().toBuffer()` returns a `Buffer` (Node.js). Creating `new Uint8Array(data.buffer)`
shares the underlying `ArrayBuffer` with zero copy. This is already zero-copy, but the
`Buffer` itself is pinned until the `Uint8Array` is released. This is correct.

**Proposal C – Sharp pipeline caching (low value)**:
Sharp pipelines are lightweight objects; creating one per frame is not the bottleneck.
The bottleneck is disk I/O and JPEG decode time, not Sharp setup.

**Proposal D – Batch size tuning**:
`OPENCV_BATCH_SIZE = 10` controls how many frames are preprocessed before OpenCV analysis.
Increasing this reduces overhead from repeated WASM context switching but increases peak
memory. Recommended: profile at 20–50 to find sweet spot for typical video lengths.

| Metric                | Current        | Proposal B     |
|-----------------------|----------------|----------------|
| Implementation effort | —              | Already done   |
| Memory savings        | —              | Negligible     |

**Recommendation**: Low priority. Current implementation is already near-optimal for I/O.

---

### 3.3 OpenCV WASM: Worker Thread Isolation (MEDIUM TERM)

**Problem**: OpenCV WASM runs on the main Node.js thread. WASM is single-threaded and
blocks the JS event loop during computation. This prevents concurrent I/O during AKAZE.

**Proposal**: Move `ensureOpenCV()` + `computeAKAZEDiff()` to a Worker thread via
`node:worker_threads`. The main thread sends raw pixel data via `SharedArrayBuffer` and
receives keypoint arrays back.

```
Main Thread:
  preprocessFrame() [I/O + sharp]
    → SharedArrayBuffer (pixel data)
      → Worker Thread: AKAZE detectAndCompute
        → keypoints (transferable ArrayBuffer)
          → Main Thread: dbscan + informationGain
```

**Benefits**:
- AKAZE runs off-event-loop: I/O and Sharp preprocessing for next batch can overlap
- N worker threads → N×AKAZE throughput (limited by WASM memory per worker)

**Trade-offs**:
- SharedArrayBuffer requires `--experimental-shared-memory` or explicit setup
- Each worker thread initializes its own WASM heap (~50–100 MB)
- Serialization overhead for keypoint arrays (mitigated by transferable buffers)
- Significant implementation complexity

| Metric                | Current        | With Worker    |
|-----------------------|----------------|----------------|
| Effective throughput  | 1×             | ~2–4× (2–4 workers) |
| Memory overhead       | 50–100 MB WASM | 100–400 MB (per worker) |
| Implementation effort | —              | High           |
| Risk                  | —              | Medium (WASM in workers has quirks) |

**Estimated improvement**: 2–4× pipeline throughput for long videos (>50 frames).

---

### 3.4 Memory: TypedArray Reuse & Object Pooling (LOW PRIORITY)

**Current issues**:
- DBSCAN allocates `new Array<number>(points.length).fill(UNVISITED)` per call
- IoUTracker pushes new `TrackedRegion` objects and filters them (GC churn)
- keypoint `Point2D` objects allocated per keypoint per frame pair

**Proposals**:

**A – Pre-allocate labels array**:
```typescript
// Reuse a shared Int32Array for labels
const labelsBuffer = new Int32Array(MAX_POINTS).fill(UNVISITED);
```
Eliminates `Array` allocation + GC. Negligible impact at n<1000, ~5% at n=5000.

**B – IoUTracker region pool**:
Maintain a fixed-size region pool, reuse slots instead of push/filter.
Saves GC pressure for long videos with many tracked regions.

**C – Point2D flat TypedArray**:
Replace `Point2D[]` with `Float32Array` (interleaved x,y):
```typescript
const pts = new Float32Array(n * 2); // [x0,y0, x1,y1, ...]
```
Reduces object allocation overhead and improves cache locality in `findNeighbors`.
~10–20% DBSCAN speedup at n≥1000 (cache miss reduction).

| Metric                | Current        | With TypedArray |
|-----------------------|----------------|-----------------|
| DBSCAN at n=5000      | 65.2 ms        | ~52–58 ms (est.)|
| Memory fragmentation  | High           | Low             |
| Implementation effort | —              | Medium          |
| API breakage          | —              | Point2D interface changes |

---

## 4. Classification Summary

### Quick Wins (implement in current sprint)

| Optimization               | Effort | Estimated Speedup | Risk |
|----------------------------|--------|-------------------|------|
| DBSCAN grid spatial index  | Low    | 15–40× at n≥1000  | Low  |
| DBSCAN Float32Array points | Medium | 10–20% at n≥1000  | Low  |

### Medium-Term Roadmap (next sprint)

| Optimization               | Effort | Estimated Speedup | Risk   |
|----------------------------|--------|-------------------|--------|
| Worker thread AKAZE        | High   | 2–4× throughput   | Medium |
| OPENCV_BATCH_SIZE tuning   | Low    | 5–15%             | Low    |

### Long-Term Roadmap

| Optimization               | Effort | Estimated Speedup | Risk   |
|----------------------------|--------|-------------------|--------|
| IoUTracker object pool     | Medium | 2–5% GC reduction | Low    |
| SharedArrayBuffer pipeline | High   | 3–5× throughput   | High   |
| Native AKAZE (N-API)       | Very High | 5–10×          | High   |

---

## 5. Priority Recommendation

**Immediate**: Implement grid-based spatial indexing for DBSCAN (`src/core/dbscan.ts`).
This is a pure algorithmic improvement with no API changes, low risk, and 15–40× speedup
for edge-case dense keypoint frames. Implementation is ~50 lines.

**Next**: Profile OpenCV WASM AKAZE time directly (requires a test harness with real images).
Until AKAZE is measured, DBSCAN optimization may reduce a non-dominant cost. Measure first.

**Do not optimize**: `computeInformationGain` (sub-millisecond), `computeIoU` (negligible),
Sharp pipeline setup (already near-optimal).
