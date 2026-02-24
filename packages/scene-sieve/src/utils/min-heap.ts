/**
 * Generic binary min-heap.
 *
 * Elements are ordered by a numeric `score` field.
 * push/pop: O(log N), size: O(1).
 */
export class MinHeap<T extends { score: number }> {
  private readonly h: T[] = [];

  get size(): number {
    return this.h.length;
  }

  push(entry: T): void {
    this.h.push(entry);
    this.siftUp(this.h.length - 1);
  }

  pop(): T | undefined {
    const n = this.h.length;
    if (n === 0) return undefined;
    const top = this.h[0];
    const last = this.h.pop()!;
    if (n > 1) {
      this.h[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p]!.score <= this.h[i]!.score) break;
      [this.h[p], this.h[i]] = [this.h[i]!, this.h[p]!];
      i = p;
    }
  }

  private siftDown(i: number): void {
    const n = this.h.length;
    for (;;) {
      let m = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.h[l]!.score < this.h[m]!.score) m = l;
      if (r < n && this.h[r]!.score < this.h[m]!.score) m = r;
      if (m === i) break;
      [this.h[m], this.h[i]] = [this.h[i]!, this.h[m]!];
      i = m;
    }
  }
}
