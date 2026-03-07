/**
 * Generates sequential token IDs per category.
 * Width: 3 digits for IDs 1-999, 4+ digits for 1000+.
 * Counter can be initialized from existing entries to prevent collisions.
 */
export class TokenGenerator {
  private counters: Map<string, number> = new Map();

  /**
   * Initialize counter for a category from an existing max ID.
   * Call this when loading an existing dictionary via fromJSON().
   */
  initFromExisting(category: string, maxId: number): void {
    const current = this.counters.get(category) ?? 0;
    if (maxId > current) {
      this.counters.set(category, maxId);
    }
  }

  /**
   * Generate the next sequential ID string for a category.
   * e.g. "PER_001", "PER_999", "PER_1000"
   */
  next(category: string): string {
    const current = this.counters.get(category) ?? 0;
    const next = current + 1;
    this.counters.set(category, next);
    return `${category}_${formatId(next)}`;
  }

  /** Get the current counter value for a category (0 if unused). */
  getCounter(category: string): number {
    return this.counters.get(category) ?? 0;
  }

  /** Export all counters for serialization. */
  exportCounters(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [cat, count] of this.counters) {
      result[cat] = count;
    }
    return result;
  }

  /** Import counters from serialized state. */
  importCounters(counters: Record<string, number>): void {
    for (const [cat, count] of Object.entries(counters)) {
      this.counters.set(cat, count);
    }
  }
}

/** Format an integer ID with minimum 3 digits (4+ for values >= 1000). */
function formatId(n: number): string {
  if (n >= 1000) return String(n);
  return String(n).padStart(3, '0');
}
