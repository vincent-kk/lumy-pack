# Portal System — @winglet/react-utils

## Overview

The Portal system renders React content at a different DOM location while preserving the React component tree (context, event bubbling). It is a context-based alternative to `ReactDOM.createPortal` that avoids manual DOM node management.

## Architecture

```
withPortal(Component)
  └── PortalContextProvider         (manages registry + anchor ref)
        ├── Component               (user's component tree)
        │     ├── <Portal>          (registers children into context)
        │     └── <Portal.Anchor>   (renders as <div ref={anchorRef}>)
        └── createPortal(content, anchorRef.current)
```

### PortalContext

```typescript
type PortalContextType = {
  portalAnchorRef: RefObject<HTMLDivElement | null>;
  register: (element: ReactNode) => string;   // returns unique id
  unregister: (id: string) => void;
};
```

Created with `createContext<PortalContextType | null>(null)`.

### PortalContextProvider

Manages:
- `components: { id: string; element: ReactNode }[]` — registry of all active Portal instances
- `portalAnchorRef` — ref to the Anchor DOM node
- `register(element)` — adds to registry with `getRandomString(36)` id, returns id
- `unregister(id)` — removes from registry

Renders all registered content via `ReactDOM.createPortal` into `anchorRef.current` when the anchor exists.

### Portal Component

```typescript
const Portal = memo(({ children }: PropsWithChildren) => {
  const { register, unregister } = usePortalContext();
  useEffect(() => {
    const id = register(children);
    return () => { if (id) unregister(id); };
  }, [children, register, unregister]);
  return null;
});
```

- Renders `null` at its own location
- Registers children into context on mount; unregisters on unmount
- Re-registers when `children` changes

### Portal.Anchor (Anchor)

```typescript
const Anchor = memo((props: Omit<HTMLAttributes<HTMLDivElement>, 'children'>) => {
  const ref = usePortalAnchorRef();
  return <div {...props} ref={ref} />;
});
```

A `<div>` that receives the `portalAnchorRef`. Accepts all standard HTML div attributes for styling.

### withPortal HOC

```typescript
const withPortal = <T extends object>(Component: ComponentType<T>) =>
  memo((props: T) => (
    <PortalContextProvider>
      <Component {...props} />
    </PortalContextProvider>
  ));
```

Wraps any component with `PortalContextProvider`. This is the standard setup entry point.

### Compound Portal Object

The default export from `@winglet/react-utils/portal` is:

```typescript
const Portal = Object.assign(BasePortal, {
  with: withPortal,
  Anchor,
});
```

This enables the `Portal.with`, `Portal.Anchor`, `<Portal>` compound object pattern.

---

## Usage Patterns

### Pattern 1: Portal.with (recommended)

```typescript
import { Portal } from '@winglet/react-utils/portal';

const App = Portal.with(() => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <button onClick={() => setShowModal(true)}>Open</button>

      {showModal && (
        <Portal>
          <div className="modal-backdrop">
            <div className="modal">
              <button onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </Portal>
      )}

      <Portal.Anchor className="modal-root" />
    </div>
  );
});
```

### Pattern 2: Direct PortalContextProvider

For cases where you cannot use the HOC:

```typescript
import { PortalContextProvider } from '@winglet/react-utils/portal';

const Layout = () => (
  <PortalContextProvider>
    <App />
  </PortalContextProvider>
);
```

### Pattern 3: Nested Contexts

Each `Portal.with` creates an independent scope. Nested contexts do not interfere:

```typescript
const Outer = Portal.with(() => (
  <div>
    <Portal><div>Goes to outer anchor</div></Portal>
    <Inner />
    <Portal.Anchor id="outer-anchor" />
  </div>
));

const Inner = Portal.with(() => (
  <div>
    <Portal><div>Goes to inner anchor</div></Portal>
    <Portal.Anchor id="inner-anchor" />
  </div>
));
```

### Pattern 4: Multiple Portals

Multiple `<Portal>` instances under the same provider all render at the single `Portal.Anchor`:

```typescript
const Page = Portal.with(() => (
  <div>
    <Portal><ModalComponent /></Portal>
    <Portal><TooltipComponent /></Portal>
    <Portal><NotificationComponent /></Portal>

    <main>Page content</main>

    <Portal.Anchor /> {/* All three render here */}
  </div>
));
```

---

## Styling the Anchor

`Portal.Anchor` accepts all `HTMLDivElement` attributes:

```typescript
<Portal.Anchor
  className="overlay-root"
  style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
  aria-live="polite"
/>
```

---

## Sticky Header Use Case

The documented use case from the README — render header content at a different location:

```typescript
const PageLayout = Portal.with(() => (
  <div>
    <Portal.Anchor className={styles.header} />  {/* header renders here */}

    <Portal>
      <h1>Page Title</h1>
      <nav>...</nav>
    </Portal>

    <main>
      Page body content
    </main>
  </div>
));
```

---

## Constraints and Limitations

1. `Portal` and `Portal.Anchor` must be descendants of the same `PortalContextProvider` (or `Portal.with` wrapper).
2. `Portal.Anchor` must be mounted before portal content renders — content only appears when `anchorRef.current` is non-null.
3. Only one `Portal.Anchor` per provider scope (the first one to mount wins).
4. No cleanup function inside `<Portal>` — the Portal component's unmount automatically unregisters.
5. Server-side rendering: `createPortal` is client-only; ensure SSR guards if needed.
