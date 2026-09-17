/** Internal sweep helper retaining cover counts and lengths between sorted y bounds. */
export class YCoverageTree {
  /** Number of whole-node covering intervals, independent of descendants. */
  private readonly counts: number[];
  /** Covered geometric length for each node, including partially covered children. */
  private readonly lengths: number[];

  /**
   * Allocate linear storage for the elementary intervals between coordinates.
   * @param bounds - At least two sorted unique finite y endpoints.
   */
  constructor(private readonly bounds: number[]) {
    this.counts = Array<number>(4 * bounds.length).fill(0);
    this.lengths = Array<number>(4 * bounds.length).fill(0);
  }

  /** Total active covered y length, in the input coordinate system. */
  get coveredLength(): number {
    return this.lengths[1];
  }

  /**
   * Adjust a nonempty half-open interval and refresh its ancestors' lengths.
   * @param start - Inclusive endpoint index; 0 <= start < end.
   * @param end - Exclusive endpoint index; end < bounds.length.
   * @param delta - One on entry, minus one for the matching departure.
   * @param node - Internal tree slot; callers use the root default.
   * @param left - Inclusive endpoint index of this node.
   * @param right - Exclusive endpoint index of this node.
   * @returns Nothing; mutates this tree's coverage in O(log n).
   */
  update(start: number, end: number, delta: number, node = 1, left = 0, right = this.bounds.length - 1): void {
    if (start <= left && right <= end) {
      this.counts[node] += delta;
    } else {
      const middle = Math.floor((left + right) / 2);
      if (start < middle) this.update(start, end, delta, node * 2, left, middle);
      if (end > middle) this.update(start, end, delta, node * 2 + 1, middle, right);
    }
    this.lengths[node] = this.counts[node] > 0
      ? this.bounds[right] - this.bounds[left]
      : right - left === 1 ? 0 : this.lengths[node * 2] + this.lengths[node * 2 + 1];
  }
}
