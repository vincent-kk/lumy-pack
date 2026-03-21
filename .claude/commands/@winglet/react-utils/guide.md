# Usage Guide — @winglet/react-utils

Quick command reference for common tasks with this library.

---

## Installation

```bash
npm install @winglet/react-utils
# or
yarn add @winglet/react-utils
```

Peer dependencies (install separately):
```bash
npm install react react-dom
```

---

## Import Patterns

```typescript
// All exports (largest bundle)
import { useConstant, useWindowSize, Portal, withErrorBoundary } from '@winglet/react-utils';

// Tree-shakeable sub-paths (recommended)
import { useConstant, useMemorize } from '@winglet/react-utils/hook';
import { withErrorBoundary, withUploader } from '@winglet/react-utils/hoc';
import { Portal } from '@winglet/react-utils/portal';
import { isReactComponent, isReactElement } from '@winglet/react-utils/filter';
import { remainOnlyReactComponent } from '@winglet/react-utils/object';
import { renderComponent } from '@winglet/react-utils/render';
```

---

## Common Recipes

### Prevent Stale Closures

```typescript
// useReference — always-current ref
const countRef = useReference(count);
const logCount = useCallback(() => console.log(countRef.current), [countRef]);

// useHandle — stable callback with always-fresh closure
const handleClick = useHandle(() => processData(data));
<MemoChild onClick={handleClick} /> // child never re-renders due to callback
```

### Memoize Expensive Work

```typescript
// One-time, eager
const table = useConstant(() => buildLookupTable(rawData));

// One-time, lazy (factory called on first access)
const service = useTruthyConstant(() => new HeavyService());

// Recompute on deps
const filtered = useMemorize(() => items.filter(activeOnly), [items]);
```

### Stabilize Object Props

```typescript
// Shallow comparison (flat objects, rest props)
const stableRest = useRestProperties(restProps);

// Deep comparison (nested objects)
const stableConfig = useSnapshot({ theme: user.theme, locale: user.locale });
```

### Lifecycle

```typescript
// Mount
useOnMount(() => {
  const sub = subscribe(onData);
  return () => sub.unsubscribe(); // cleanup
});

// Unmount — use useReference for current state
const dataRef = useReference(data);
useOnUnmount(() => saveDraft(dataRef.current));

// Effect until success
useEffectUntil(() => {
  if (!service.ready) return false;
  initFeature(service);
  return true;
}, [service]);
```

### Debounce & Timeout

```typescript
// Debounce search on query change
const { cancel } = useDebounce(() => search(query), [query], 300);
useEffect(() => cancel, [cancel]);

// Managed timeout with explicit control
const { schedule, cancel, isIdle } = useTimeout(() => hideTooltip(), 2000);
<div onMouseEnter={schedule} onMouseLeave={cancel}>Hover me</div>
```

### Portal System

```typescript
import { Portal } from '@winglet/react-utils/portal';

const Page = Portal.with(() => (
  <div>
    {showModal && (
      <Portal>
        <Modal onClose={() => setShowModal(false)} />
      </Portal>
    )}
    <content />
    <Portal.Anchor className="modal-root" />
  </div>
));
```

### Error Boundaries

```typescript
import { withErrorBoundary, withErrorBoundaryForwardRef } from '@winglet/react-utils/hoc';

const SafeWidget = withErrorBoundary(Widget, <p>Widget failed to load.</p>);

// For forwardRef components
const SafeInput = withErrorBoundaryForwardRef(CustomInput);
const ref = useRef<HTMLInputElement>(null);
<SafeInput ref={ref} />
```

### File Upload

```typescript
import { withUploader } from '@winglet/react-utils/hoc';

const UploadButton = withUploader(Button);
<UploadButton
  acceptFormat={['.jpg', '.png', '.pdf']}
  onChange={(file: File) => handleUpload(file)}
>
  Select File
</UploadButton>
```

### Component Type Checking

```typescript
import { isReactComponent, isReactElement, renderComponent } from '@winglet/react-utils';

function renderProp(value: unknown) {
  if (isReactElement(value)) return value;
  if (isReactComponent(value)) return renderComponent(value, { size: 'sm' });
  return null;
}
```

### Force Re-render / Cache Bust

```typescript
const [version, refresh] = useVersion();

// Invalidate useMemo
const result = useMemo(() => compute(input), [input, version]);

// Remount child component
<ComplexForm key={version} />

// Button to trigger refresh
<button onClick={refresh}>Refresh</button>
```

### Responsive Layout

```typescript
const { width, height } = useWindowSize();
const isMobile = width < 768;
const columns = Math.max(1, Math.floor(width / 300));
```

---

## Decision Tree

```
Need a value that never changes?
  ├─ Known at render time → useConstant(value)
  └─ Factory function, defer until needed → useTruthyConstant(() => factory())

Need a value that recomputes when deps change?
  └─ useMemorize(valueOrFactory, deps)

Need stable object reference?
  ├─ Flat object / rest props → useRestProperties(obj)
  └─ Nested object / API response → useSnapshot(obj, omitKeys?)

Need stable function reference?
  ├─ Always calls latest handler → useHandle(fn)
  └─ Just need current value in async code → useReference(value)

Need lifecycle hooks?
  ├─ On mount → useOnMount / useOnMountLayout
  ├─ On unmount → useOnUnmount / useOnUnmountLayout
  └─ Repeat until condition → useEffectUntil / useLayoutEffectUntil

Need timing utilities?
  ├─ Debounce on deps → useDebounce(fn, deps, ms)
  └─ Manual timer control → useTimeout(fn, ms)

Need to render content outside DOM parent?
  └─ Portal.with + <Portal> + <Portal.Anchor>

Need crash protection?
  ├─ Regular component → withErrorBoundary(Component, fallback)
  └─ forwardRef component → withErrorBoundaryForwardRef(Component, fallback)
```
