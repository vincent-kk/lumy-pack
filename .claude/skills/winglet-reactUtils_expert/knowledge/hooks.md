# Hooks Reference — @winglet/react-utils

All 18 hooks, organized by category. Each entry includes signature, behavior, key notes, and real-world patterns.

---

## State / Constant Hooks

### useConstant

```typescript
function useConstant<T>(input: T): T
```

Stores `input` in a `useRef` on the first render and returns it unchanged on every subsequent render. If a function is passed, it is stored as-is (not called). Use `useTruthyConstant` when you want lazy initialization from a factory function.

**Behavior**: Eager — runs on first render, never recomputes.

**Use when**: You need a value that must never change across the component lifecycle (stable config objects, initial data, stable callbacks you create manually).

```typescript
// Stable object reference — never triggers React.memo re-renders
const defaultConfig = useConstant({ showIcon: true, pageSize: 20 });

// Expensive one-time array initialization
const lookupTable = useConstant(() => buildLookupTable(rawData));
// NOTE: the function itself is stored, not called.
// Use useTruthyConstant if you want the function to be called.
```

**Difference from useMemo**: `useMemo` can recompute; `useConstant` never does.
**Difference from useRef directly**: Communicates intent — "this value is intentionally immutable."

---

### useTruthyConstant

```typescript
function useTruthyConstant<T>(input: T | (() => T)): T
```

Like `useConstant` but supports **lazy initialization**: if a function is passed, it is called on first access (when the ref is falsy). Re-initializes if the stored value becomes falsy.

**Behavior**: Lazy — factory function runs only when the value is first needed.

**Caveat**: Do not use for values that might legitimately be `0`, `''`, `false`, or `null` — those will trigger re-initialization.

```typescript
// Only instantiates when component accesses the value
const analyticsService = useTruthyConstant(() => new AnalyticsService(config));

// Conditional initialization
const processor = useTruthyConstant(() => {
  if (!videoUrl) return null; // null → re-initializes next time, use with care
  return new VideoProcessor({ codec: 'h264' });
});
```

---

### useMemorize

```typescript
function useMemorize<T>(input: T | (() => T), dependencies?: DependencyList): T
```

Thin wrapper over `useMemo` with a cleaner overloaded API. Accepts either a direct value or a factory function, plus an optional dependency array (defaults to `[]`).

**Two modes**:
1. **Value mode**: `useMemorize(obj, [a, b])` — equivalent to `useMemo(() => obj, [a, b])`
2. **Function mode**: `useMemorize(() => compute(), [a, b])` — calls factory on dep change

```typescript
// Value mode — stabilize an inline object
const config = useMemorize({ theme, locale }, [theme, locale]);

// Function mode — recompute expensive transform
const processed = useMemorize(
  () => rawData.map(item => expensiveTransform(item)),
  [rawData],
);

// One-time computation (empty deps, same as useConstant but via useMemo)
const constant = useMemorize(() => generateLargeDataset());
```

---

## Reference Hooks

### useReference

```typescript
function useReference<T>(value: T): RefObject<T>
```

Creates a ref that is updated to the latest `value` on **every render**. The ref object itself is stable (same reference throughout lifecycle), but `ref.current` always reflects the current render's value.

**Primary use case**: Solve the stale closure problem without recreating callbacks.

```typescript
const [count, setCount] = useState(0);
const countRef = useReference(count);

// This callback is created once and never changes,
// but always reads the current count
const logCount = useCallback(() => {
  console.log(countRef.current); // always current
}, [countRef]);

useEffect(() => {
  const id = setInterval(logCount, 1000);
  return () => clearInterval(id);
}, [logCount]);
```

---

### useHandle

```typescript
function useHandle<P extends any[], R>(
  handler?: (...args: P) => R
): (...args: P) => R
```

Builds on `useReference` to create a **stable function reference** that always delegates to the latest version of `handler`. The returned function never changes identity, making it safe to pass to `React.memo` children or use in effects with empty dependency arrays.

If `handler` is `undefined`, the returned function returns `null` instead of throwing.

```typescript
const [data, setData] = useState(initialData);

// Stable ref — ExpensiveChild never re-renders due to onClick
const handleClick = useHandle(() => process(data));
// handleClick identity is stable; it internally reads latest 'data'

return <ExpensiveChild onClick={handleClick} />;
```

**vs useCallback**: `useCallback` recreates the function when deps change; `useHandle` never recreates.

---

### useSnapshot

```typescript
function useSnapshot<T extends object | undefined>(
  input: T,
  omit?: Set<keyof T> | Array<keyof T>
): T
```

Returns the **same object reference** as long as the object's contents are deeply equal to the previous render's value. When content actually changes, returns the new object.

**Use for**: Nested objects, API responses, complex configuration objects.

```typescript
// Effect only re-runs when config content actually changes
const stableConfig = useSnapshot({ theme: user.theme, locale: user.locale });
useEffect(() => {
  initWidget(stableConfig);
}, [stableConfig]);

// Exclude volatile fields from comparison
const stableResponse = useSnapshot(apiResponse, ['timestamp', 'requestId']);
```

**vs useRestProperties**: `useSnapshot` does deep comparison; `useRestProperties` does shallow.

---

### useSnapshotReference

```typescript
function useSnapshotReference<T extends object | undefined>(
  input: T,
  omit?: Set<keyof T> | Array<keyof T>
): RefObject<T>
```

Same deep-comparison logic as `useSnapshot`, but returns a **ref object** instead of the value directly. The ref object itself is always the same reference; only `ref.current` updates when contents change.

**Use when**: You need ref semantics — stable ref for use in callbacks, timers, imperative APIs.

```typescript
const dataRef = useSnapshotReference(complexData);

// Stable callback: never recreates even when complexData changes structure
const processData = useCallback(() => {
  const result = expensiveComputation(dataRef.current);
  onProcess(result);
}, [dataRef]); // dataRef ref object never changes
```

---

### useRestProperties

```typescript
function useRestProperties<T extends Dictionary>(props: T): T
```

Performs **shallow equality comparison** and returns the previous object reference when all top-level property values are strictly equal. Prevents unnecessary re-renders caused by inline object literals or spread operators.

**Use for**: Flat prop objects, rest props in component APIs, context values with flat shape.

```typescript
const Button = ({ variant, size, ...restProps }) => {
  const stableRest = useRestProperties(restProps);
  // MemoizedButton only re-renders when restProps content actually changes
  return <MemoizedButton variant={variant} size={size} {...stableRest} />;
};
```

**Algorithm**: O(1) for unchanged reference; O(n) for key/value comparison.

---

## Lifecycle Hooks

### useOnMount

```typescript
function useOnMount(handler: EffectCallback): void
```

Runs `handler` once after the component mounts (after paint). Equivalent to `useEffect(handler, [])`. Supports cleanup by returning a function.

```typescript
useOnMount(() => {
  const ws = new WebSocket('wss://api.example.com');
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  return () => ws.close();
});
```

---

### useOnMountLayout

```typescript
function useOnMountLayout(handler: EffectCallback): void
```

Synchronous version of `useOnMount` — runs before browser paint via `useLayoutEffect`. Use to prevent FOUC, apply initial DOM measurements, or restore scroll positions.

```typescript
useOnMountLayout(() => {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.classList.add('dark-mode');
});
```

**Performance warning**: Blocks browser paint. Use only when synchronous behavior is required.

---

### useOnUnmount

```typescript
function useOnUnmount(handler: Fn): void
```

Runs `handler` when the component unmounts. The handler captures values at **mount time** — a stale closure. Use `useReference` to access current state in cleanup.

```typescript
// Stale closure problem:
const [count, setCount] = useState(0);
useOnUnmount(() => {
  console.log(count); // always 0 (mount-time value)
});

// Solution:
const countRef = useReference(count);
useOnUnmount(() => {
  console.log(countRef.current); // current value
  analytics.track('session_end', { finalCount: countRef.current });
});
```

---

### useOnUnmountLayout

```typescript
function useOnUnmountLayout(handler: Fn): void
```

Synchronous cleanup on unmount via `useLayoutEffect`. Use when DOM must be cleaned up before reflow/repaint to prevent visual artifacts.

```typescript
useOnMountLayout(() => {
  document.body.style.overflow = 'hidden';
});
useOnUnmountLayout(() => {
  document.body.style.overflow = ''; // restore before next paint
});
```

---

### useEffectUntil

```typescript
function useEffectUntil<D extends DependencyList>(
  effect: () => boolean,
  dependencies?: D
): void
```

Runs `effect` on mount and on dependency changes. Once `effect` returns `true`, it **permanently stops** executing even if dependencies continue to change.

**Use for**: Polling until success, initialization sequences, one-shot async operations.

```typescript
useEffectUntil(() => {
  const socket = connectToWebSocket(url);
  if (socket.readyState === WebSocket.OPEN) {
    setConnection(socket);
    return true; // stop
  }
  return false; // keep trying
}, [url]);
```

No cleanup function support — use regular `useEffect` if you need cleanup.

---

### useLayoutEffectUntil

```typescript
function useLayoutEffectUntil<D extends DependencyList>(
  effect: () => boolean,
  dependencies?: D
): void
```

Synchronous version of `useEffectUntil`. Use for DOM-dependent initialization that must complete before paint.

```typescript
useLayoutEffectUntil(() => {
  const el = ref.current;
  if (!el) return false;
  const { width } = el.getBoundingClientRect();
  if (width > maxWidth) {
    setFontSize(prev => prev - 1);
    return false;
  }
  return true; // fits
}, [fontSize, maxWidth]);
```

---

## Utility Hooks

### useDebounce

```typescript
function useDebounce(
  callback: Fn,
  dependencyList?: DependencyList,
  ms?: number,
  options?: { immediate?: boolean }
): { isIdle: () => boolean; cancel: () => void }
```

Debounces `callback` execution triggered by dependency changes. By default (`immediate: true`), executes immediately if the debounce timer is idle, then waits `ms` before re-executing on subsequent rapid changes.

Returns `isIdle()` to check pending state, and `cancel()` to abort.

```typescript
const [query, setQuery] = useState('');
const { cancel } = useDebounce(
  () => searchAPI(query),
  [query],
  300,
);

// Cancel pending search on unmount
useEffect(() => cancel, [cancel]);
```

**Internally**: built on `useHandle` + `useTimeout`.

---

### useTimeout

```typescript
function useTimeout(
  callback: Fn,
  timeout?: number
): { isIdle: () => boolean; schedule: () => void; cancel: () => void }
```

Provides explicit control over a `setTimeout`: `schedule()` starts or resets the timer, `cancel()` aborts it, `isIdle()` reports whether no timer is pending. Auto-cleans on unmount.

```typescript
const { schedule, cancel, isIdle } = useTimeout(
  () => setVisible(false),
  3000
);

// Auto-dismiss notification, pause on hover
useEffect(() => { schedule(); return cancel; }, []);
return (
  <div onMouseEnter={cancel} onMouseLeave={schedule}>
    {message}
  </div>
);
```

---

### useVersion

```typescript
function useVersion(callback?: Fn): [version: number, update: () => void]
```

Returns `[version, update]` where `update()` optionally calls `callback` then increments `version`, triggering a re-render. Starting version is `0`.

**Use for**: Manual refresh buttons, cache invalidation, forcing effect re-runs, child remount via `key` prop.

```typescript
const [version, refresh] = useVersion();
// version as key forces child remount
return <ComplexForm key={version} />;

// version as effect dep forces refetch
useEffect(() => { fetchData(); }, [version]);
```

---

### useWindowSize

```typescript
function useWindowSize(): { width: number; height: number }
```

Subscribes to `window.resize` events and returns `{ width, height }` in pixels. Returns `{ width: 0, height: 0 }` during SSR. Automatically cleans up the listener on unmount.

**Performance note**: Resize events fire at high frequency. For expensive derivations, combine with `useDebounce`.

```typescript
const { width } = useWindowSize();
const isMobile = width < 768;

return isMobile ? <MobileView /> : <DesktopView />;
```
