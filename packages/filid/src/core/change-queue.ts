/** Change record type */
export interface ChangeRecord {
  /** Absolute path of the changed file */
  filePath: string;
  /** Change type */
  changeType: 'created' | 'modified' | 'deleted';
  /** Change timestamp (auto-set if not provided) */
  timestamp?: number;
}

/**
 * Change queue for batch synchronization at PR time.
 *
 * In FCA-AI, agents analyze code increments and synchronize
 * context documents only at PR creation time, not per-commit.
 * This queue accumulates changes in between.
 */
export class ChangeQueue {
  private queue: ChangeRecord[] = [];

  /** Add a change record to the queue */
  enqueue(record: ChangeRecord): void {
    this.queue.push({
      ...record,
      timestamp: record.timestamp ?? Date.now(),
    });
  }

  /** Return all queued changes and clear the queue */
  drain(): ChangeRecord[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }

  /** Return all queued changes without clearing */
  peek(): ChangeRecord[] {
    return [...this.queue];
  }

  /** Group changes by file path */
  getChangesByPath(): Map<string, ChangeRecord[]> {
    const grouped = new Map<string, ChangeRecord[]>();
    for (const record of this.queue) {
      const existing = grouped.get(record.filePath) ?? [];
      existing.push(record);
      grouped.set(record.filePath, existing);
    }
    return grouped;
  }

  /** Return unique parent directories (fractals) of changed files */
  getAffectedFractals(): string[] {
    const dirs = new Set<string>();
    for (const record of this.queue) {
      const lastSlash = record.filePath.lastIndexOf('/');
      if (lastSlash > 0) {
        dirs.add(record.filePath.slice(0, lastSlash));
      }
    }
    return [...dirs];
  }

  /** Clear all queued changes */
  clear(): void {
    this.queue = [];
  }

  /** Return the queue size */
  size(): number {
    return this.queue.length;
  }

  /** Check if the queue is empty */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
