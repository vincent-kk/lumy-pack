# Async Utilities — @winglet/common-utils/promise + scheduler

---

## Promise Utilities

### Import
```typescript
import { ... } from '@winglet/common-utils/promise';
```

---

### delay

```typescript
delay(ms?: number, options?: { signal?: AbortSignal }): Promise<void>
```

Creates a Promise that resolves after `ms` milliseconds (default: 0).

```typescript
await delay(1000); // wait 1 second

// Cancellable delay
const controller = new AbortController();
setTimeout(() => controller.abort(), 500);
try {
  await delay(2000, { signal: controller.signal });
} catch (e) {
  if (e instanceof AbortError) console.log('cancelled');
}
```

**Behavior:**
- If `signal` is already aborted, rejects immediately without creating a timer.
- On abort during delay: clears timer and rejects with `AbortError`.
- Event listeners are automatically cleaned up on both completion and cancellation.

---

### timeout

```typescript
timeout(ms: number, options?: { signal?: AbortSignal }): Promise<never>
```

Returns a Promise that always rejects with `TimeoutError` after `ms` milliseconds.

```typescript
// Typically used via withTimeout, not directly
```

---

### withTimeout

```typescript
withTimeout<T>(fn: () => Promise<T>, ms: number, options?: { signal?: AbortSignal }): Promise<T>
```

Wraps an async function with a timeout. Uses `Promise.race`.

```typescript
try {
  const data = await withTimeout(() => fetchData(), 5000);
} catch (e) {
  if (e instanceof TimeoutError) {
    console.log('timed out after 5s');
  }
}
```

**Error hierarchy:**
- `TimeoutError` — execution exceeded `ms`
- `AbortError` — cancelled via `signal`
- Any error thrown by `fn` is propagated unchanged

---

### waitAndExecute

```typescript
waitAndExecute<T>(ms: number, fn: () => T): Promise<T>
```

Waits `ms` milliseconds then executes and returns the result of `fn`.

```typescript
const result = await waitAndExecute(500, () => computeValue());
```

---

### waitAndReturn

```typescript
waitAndReturn<T>(ms: number, value: T): Promise<T>
```

Waits `ms` milliseconds then resolves with `value`.

```typescript
const val = await waitAndReturn(1000, 'hello'); // resolves after 1s
```

---

## Scheduler Utilities

### Import
```typescript
import { ... } from '@winglet/common-utils/scheduler';
```

### Event Loop Execution Order

```
Synchronous code
  → Microtasks (scheduleMicrotask / queueMicrotask)
  → Next tick (scheduleNextTick / process.nextTick in Node.js)
  → Macrotasks (scheduleMacrotask / setImmediate / MessageChannel)
  → setTimeout(0)
  → Browser rendering
```

---

### scheduleMicrotask

```typescript
scheduleMicrotask(task: () => void): void
```

Schedules `task` in the microtask queue. Executes before any macrotasks.

- Uses native `queueMicrotask` when available (Chrome 71+, Node 11+).
- Falls back to `Promise.resolve().then(task)` in legacy environments.

```typescript
scheduleMicrotask(() => {
  console.log('runs before macrotasks');
});
```

**Use for:** State synchronization, batching synchronous state updates, immediate DOM updates.

---

### scheduleNextTick

```typescript
scheduleNextTick(task: () => void): void
```

Defers execution to the next event loop iteration.

- **Node.js:** `Promise.resolve().then(() => process.nextTick(task))` — after I/O events
- **Modern browsers:** `setImmediate` where available
- **Fallback:** `setTimeout(task, 0)` — subject to 4ms minimum delay

**Use for:** Server-side I/O coordination, resource cleanup, Node.js-style next-tick patterns.

---

### scheduleMacrotask

```typescript
scheduleMacrotask(callback: () => void): number
```

Schedules a callback in the macrotask queue. Returns a numeric ID.

- **Node.js:** Uses native `setImmediate` for true macrotask semantics.
- **Browsers:** Uses custom `MessageChannelScheduler` — no 4ms minimum delay, automatic batching.

```typescript
const id = scheduleMacrotask(() => {
  console.log('macrotask');
});
```

### cancelMacrotask

```typescript
cancelMacrotask(id: number): void
```

Cancels a scheduled macrotask by ID. Safe to call with invalid IDs.

### scheduleCancelableMacrotask

```typescript
scheduleCancelableMacrotask(callback: () => void): () => void
```

Schedules a macrotask and returns a cancellation function (instead of an ID).

```typescript
const cancel = scheduleCancelableMacrotask(() => doWork());
// Cancel before execution:
cancel();
```

---

### MessageChannelScheduler

The `MessageChannelScheduler` class powers browser macrotask scheduling. It uses `MessageChannel` for immediate macrotask execution without the 4ms minimum delay of `setTimeout`.

**Key features:**
- Automatic batching of synchronously scheduled tasks
- Individual task cancellation from batches
- ~0.01ms scheduling overhead

**Handler functions (exported from `@winglet/common-utils/scheduler`):**
- `setImmediate(callback)` — schedule via MessageChannelScheduler
- `clearImmediate(id)` — cancel
- `getPendingCount()` — number of pending tasks
- `destroyGlobalScheduler()` — cleanup

---

## Common Async Patterns

### Retry with exponential backoff
```typescript
import { delay } from '@winglet/common-utils/promise';

async function retry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await delay(Math.pow(2, attempt - 1) * 1000);
    }
  }
  throw new Error('unreachable');
}
```

### Timeout-protected fetch
```typescript
import { withTimeout } from '@winglet/common-utils/promise';
import { TimeoutError } from '@winglet/common-utils/error';

async function safeFetch(url: string) {
  try {
    return await withTimeout(() => fetch(url).then(r => r.json()), 10000);
  } catch (e) {
    if (e instanceof TimeoutError) throw new Error('Request timed out');
    throw e;
  }
}
```

### Batch updates with microtask
```typescript
import { scheduleMicrotask } from '@winglet/common-utils/scheduler';

class StateManager {
  private pendingUpdate = false;

  setState(update: Partial<State>) {
    Object.assign(this.state, update);
    if (!this.pendingUpdate) {
      this.pendingUpdate = true;
      scheduleMicrotask(() => {
        this.pendingUpdate = false;
        this.notifySubscribers();
      });
    }
  }
}
```
