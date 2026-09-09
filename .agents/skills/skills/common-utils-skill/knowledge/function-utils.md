# Function Utilities — @winglet/common-utils/function

## Import

```typescript
import { debounce, throttle, getTrackableHandler } from '@winglet/common-utils/function';
```

---

## debounce

```typescript
debounce<F extends Fn<any[]>>(
  fn: F,
  ms: number,
  options?: {
    signal?: AbortSignal;
    leading?: boolean;  // default: false
    trailing?: boolean; // default: true
  }
): DebouncedFn<F>
```

Creates a debounced function that delays execution until `ms` milliseconds have elapsed since the last call.

### Return type: DebouncedFn

```typescript
interface DebouncedFn<F extends Fn<any[]>> {
  (...args: Parameters<F>): void;
  execute: () => void; // execute immediately with last arguments
  clear: () => void;   // cancel pending execution
}
```

### Execution modes

| `leading` | `trailing` | Behavior |
|-----------|------------|----------|
| `false` (default) | `true` (default) | Execute only after quiet period ends |
| `true` | `false` | Execute immediately, ignore subsequent calls during delay |
| `true` | `true` | Execute immediately AND again after delay if calls continue |

```typescript
// Default: trailing only — execute after user stops typing
const searchDebounced = debounce(searchFn, 300);
input.addEventListener('input', e => searchDebounced(e.target.value));

// Leading only — execute immediately, block for 500ms
const leadingDebounced = debounce(logAction, 500, { leading: true, trailing: false });

// Both — execute immediately and again if calls happen during window
const bothDebounced = debounce(updateUI, 200, { leading: true, trailing: true });
```

### Manual control

```typescript
const debounced = debounce(fn, 1000);

debounced(args);        // Schedule execution
debounced.execute();    // Execute immediately with last args (bypass timer)
debounced.clear();      // Cancel pending execution
```

### AbortSignal integration

```typescript
const controller = new AbortController();
const debounced = debounce(fn, 300, { signal: controller.signal });

controller.abort(); // Clears pending execution, debounced becomes a no-op
```

### Anti-patterns to avoid

```typescript
// WRONG: creating inside render — new function every render, breaks debouncing
function Component() {
  const debounced = debounce(fn, 300); // recreated every render!
}

// CORRECT: stable reference
const debounced = useMemo(() => debounce(fn, 300), []);

// CORRECT: cleanup on unmount
useEffect(() => {
  const d = debounce(fn, 300);
  element.addEventListener('scroll', d);
  return () => { d.clear(); element.removeEventListener('scroll', d); };
}, []);
```

---

## throttle

```typescript
throttle<F extends Fn<any[]>>(
  fn: F,
  ms: number,
  options?: {
    signal?: AbortSignal;
    leading?: boolean;  // default: true
    trailing?: boolean; // default: true
  }
): ThrottledFn<F>
```

Creates a throttled function that executes at most once per `ms` milliseconds.

### Key difference from debounce

- **Debounce:** delays execution until activity _stops_ (quiet period)
- **Throttle:** executes at regular intervals _during_ activity

### Return type: ThrottledFn

Same interface as `DebouncedFn`: callable + `execute()` + `clear()`.

### Default behavior (both leading and trailing)

```typescript
const throttledScroll = throttle(handleScroll, 100);
// Executes immediately on first call, then at most once per 100ms
```

### Execution modes

| `leading` | `trailing` | Best for |
|-----------|------------|----------|
| `true` (default) | `true` (default) | Scroll/resize handlers, real-time updates |
| `true` | `false` | Button clicks (prevent double-click) |
| `false` | `true` | API batching (collect then send) |

```typescript
// ~60fps animation frame rate
const smoothAnimation = throttle(updatePosition, 16);

// API rate limiting — at most 1 request per second
const throttledAPI = throttle(sendRequest, 1000);

// Leading only — prevent double-clicks
const clickProtected = throttle(submitForm, 2000, { leading: true, trailing: false });
```

---

## getTrackableHandler

```typescript
getTrackableHandler<Args extends any[] = [], Result = void, State extends Dictionary = {}>(
  origin: (...args: Args) => Promise<Result>,
  options?: TrackableHandlerOptions<Args, State>
): TrackableHandlerFunction<Args, Result, State>
```

Wraps an async function with state tracking, lifecycle hooks, and subscription-based change notifications.

### TrackableHandlerOptions

```typescript
type TrackableHandlerOptions<Args, State> = {
  preventConcurrent?: boolean; // default: true
  initialState?: State;
  beforeExecute?: (args: Args, stateManager: StateManager<State>) => void;
  afterExecute?: (args: Args, stateManager: StateManager<State>) => void;
};

type StateManager<State> = {
  readonly state: State; // read-only current state
  update(updater: Partial<State> | ((prev: State) => Partial<State>)): void;
};
```

Note: there is **no** `onError` option. Errors thrown by `origin` propagate to the caller; `afterExecute` still runs inside a `finally` block so cleanup always happens.

### TrackableHandlerFunction interface

The returned handler is callable as the original function, plus:

- `(...args) => Promise<Result>` — calls `origin` (or resolves `undefined` when `preventConcurrent` blocks the call)
- `.state` — current state object (read-only, non-enumerable)
- `.pending` — `boolean`, true while `origin` is executing (read-only, non-enumerable)
- `.subscribe(listener)` — register a change listener; returns an unsubscribe function

There is **no** `.loading` property (use `.pending`) and **no** `.execute()` / `.clear()` methods.

### Usage

```typescript
import { getTrackableHandler } from '@winglet/common-utils/function';

const fetchUser = async (userId: string) => {
  const res = await fetch(`/api/users/${userId}`);
  return res.json();
};

const trackableFetch = getTrackableHandler(fetchUser, {
  preventConcurrent: true,  // default — ignore calls while one is in flight
  initialState: { data: null as User | null, error: null as string | null },
  beforeExecute: (args, sm) => sm.update({ error: null }),
  afterExecute:  (args, sm) => sm.update(prev => ({ ...prev })), // always runs
});

// Subscribe to state / pending changes
const unsubscribe = trackableFetch.subscribe(() => {
  console.log('pending:', trackableFetch.pending);
  console.log('state:',   trackableFetch.state);
});

// Call the handler like the original function
await trackableFetch('user-123');

unsubscribe();
```

### preventConcurrent

When `true` (default), calls made while a previous invocation is pending return a Promise resolving to `undefined` (cast as `Result`) without invoking `origin`. Useful for preventing duplicate submits / double-clicks.

```typescript
const trackableSubmit = getTrackableHandler(submitForm); // preventConcurrent defaults to true
button.addEventListener('click', () => trackableSubmit(formData));
// Rapid clicks during submission are silently skipped.
```

### Execution flow

1. If `preventConcurrent && pending` → resolve `undefined` immediately.
2. Call `beforeExecute(args, stateManager)` — if it throws, the original function is not invoked.
3. Set `pending = true` and notify subscribers.
4. `await origin(...args)` (propagates errors as-is).
5. In `finally`: call `afterExecute(args, stateManager)`, set `pending = false`, notify subscribers.

### Source layout

- `debounce`, `throttle` → `src/utils/function/rateLimit/`
- `getTrackableHandler` → `src/utils/function/enhance/getTrackableHandler/`

All three are re-exported from `@winglet/common-utils/function`.
