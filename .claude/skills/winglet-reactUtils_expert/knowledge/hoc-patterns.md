# HOC Patterns — @winglet/react-utils

## withErrorBoundary

```typescript
function withErrorBoundary<Props extends Dictionary>(
  Component: ComponentType<Props>,
  fallback?: ReactNode,
): ComponentType<Props>
```

Wraps `Component` in an `ErrorBoundary` class component. When any error is thrown during rendering, the fallback UI is displayed instead of crashing the application. If `fallback` is omitted, a default `FallbackMessage` component is shown.

### ErrorBoundary Internals

```typescript
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback || FALLBACK;
    return this.props.children;
  }
}
```

### Usage

```typescript
import { withErrorBoundary } from '@winglet/react-utils/hoc';

// Basic — default fallback message
const SafeChart = withErrorBoundary(ChartComponent);

// Custom fallback
const SafeDataTable = withErrorBoundary(
  DataTable,
  <div className="error-state">
    <p>Unable to load data. Please refresh.</p>
  </div>,
);

// In JSX
function Dashboard() {
  return (
    <div>
      <SafeChart data={chartData} />
      <SafeDataTable rows={rows} columns={columns} />
    </div>
  );
}
```

### When to Use

- Third-party components that may throw
- Data-driven components rendering from API responses
- Any feature that should not crash the entire page on failure
- Micro-frontend boundaries

### Limitations

- Does not catch errors in event handlers (use try/catch there)
- Does not catch asynchronous errors (use error state pattern)
- Does not catch errors in the fallback itself
- React class component internally — cannot be a hook

---

## withErrorBoundaryForwardRef

```typescript
function withErrorBoundaryForwardRef<Props extends Dictionary, Ref>(
  Component: ForwardRefExoticComponent<Props & RefAttributes<Ref>>,
  fallback?: ReactNode,
): ForwardRefExoticComponent<PropsWithoutRef<Props> & RefAttributes<Ref>>
```

Same as `withErrorBoundary` but for components created with `React.forwardRef`. Preserves the ref forwarding contract so consumers can still call `ref.current.focus()` or access the imperative handle.

### Usage

```typescript
import { withErrorBoundaryForwardRef } from '@winglet/react-utils/hoc';

const CustomInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input {...props} ref={ref} className="custom-input" />
));

const SafeInput = withErrorBoundaryForwardRef(
  CustomInput,
  <div>Input failed to load</div>,
);

// Ref forwarding still works
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <SafeInput ref={inputRef} placeholder="Enter value" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </div>
  );
}
```

### When to Use Over withErrorBoundary

Use `withErrorBoundaryForwardRef` when:
- The component is created with `forwardRef`
- Consumers need `ref` access (focus, scroll, imperative handles)
- The component exposes a `useImperativeHandle` API

---

## withUploader

```typescript
function withUploader<Props extends { onClick?: Fn<[e?: MouseEvent]> }>(
  Component: ComponentType<Props>,
): MemoExoticComponent<(props: Props & UploaderProps) => JSX.Element>

type UploaderProps = {
  acceptFormat?: string[];
  onChange?: (file: File) => void;
}
```

Transforms any clickable component into a file upload trigger. Renders a hidden `<input type="file">` and intercepts the component's `onClick` to open the native file dialog. After file selection, calls `onChange(file)` with the `File` object.

### Behavior Details

- Calls the original `onClick` handler before triggering the file dialog
- Clears `input.value` after each selection to allow re-selecting the same file
- `acceptFormat` is joined into a comma-separated `accept` attribute (e.g., `['.jpg', '.png']` → `'.jpg,.png'`)
- Only handles **single file** selection (uses `files[0]`)
- Wrapped with `React.memo` for performance

### Usage

```typescript
import { withUploader } from '@winglet/react-utils/hoc';

// Transform any button into an upload trigger
const UploadButton = withUploader(Button);

function ProfileEditor() {
  const handleFile = (file: File) => {
    console.log('Selected:', file.name, `(${file.size} bytes)`);
    uploadToServer(file);
  };

  return (
    <UploadButton
      acceptFormat={['.jpg', '.jpeg', '.png', '.webp']}
      onChange={handleFile}
      onClick={() => analytics.track('upload_initiated')}
    >
      Change Avatar
    </UploadButton>
  );
}
```

### Image Uploader with Custom Zone

```typescript
const DropZone = ({ children, ...props }) => (
  <div className="drop-zone" {...props}>{children}</div>
);

const ImageDropZone = withUploader(DropZone);

<ImageDropZone
  acceptFormat={['.jpg', '.png', '.gif']}
  onChange={(file) => setImage(URL.createObjectURL(file))}
>
  <Icon name="upload" />
  <span>Click to upload</span>
</ImageDropZone>
```

### Document Upload

```typescript
const DocumentPicker = withUploader(Card);

<DocumentPicker
  acceptFormat={['.pdf', '.doc', '.docx', '.txt', '.xlsx']}
  onChange={handleDocumentUpload}
>
  <p>Click to select document</p>
</DocumentPicker>
```

### Props Forwarding

`withUploader` extracts `onClick`, `onChange`, and `acceptFormat` from props. All remaining props are forwarded to the wrapped `Component` as-is.

### Constraints

- Requires the wrapped component to accept an `onClick` prop (type: `Fn<[e?: MouseEvent]>`)
- Only single file selection — for multi-file, use native `<input multiple>`
- The hidden input is rendered as a sibling (inside a `Fragment`)
