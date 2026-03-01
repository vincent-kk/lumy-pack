/**
 * Creates a concurrency limiter that runs at most `limit` tasks in parallel.
 * Lightweight replacement for p-limit to avoid external dependency.
 */
export function concurrencyLimit(limit: number) {
  limit = Math.max(1, limit);
  let active = 0;
  const queue: Array<() => void> = [];

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    while (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
