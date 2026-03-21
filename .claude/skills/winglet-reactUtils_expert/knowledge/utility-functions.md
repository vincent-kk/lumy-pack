# Utility Functions — @winglet/react-utils

## Filter Utilities (`@winglet/react-utils/filter`)

Functions for runtime React type inspection. All return type-safe boolean predicates usable as TypeScript type guards.

---

### isReactComponent

```typescript
function isReactComponent<
  Props extends object = any,
  Component extends ComponentType<Props> = ComponentType<Props>
>(component: unknown): component is Component
```

Returns `true` for function components, class components, and `React.memo` wrapped components. Implemented as `isFunctionComponent || isMemoComponent || isClassComponent`.

**Does NOT detect**: `forwardRef` components (they are objects with `$$typeof === Symbol.for('react.forward_ref')`).

```typescript
import { isReactComponent } from '@winglet/react-utils/filter';

const Fn = () => <div />;
const Cls = class extends React.Component { render() { return <div />; } };
const Memo = React.memo(() => <div />);
const Fwd = React.forwardRef((props, ref) => <div ref={ref} />);

isReactComponent(Fn);   // true
isReactComponent(Cls);  // true
isReactComponent(Memo); // true
isReactComponent(Fwd);  // false — forwardRef not supported
isReactComponent({});   // false
isReactComponent(null); // false
```

---

### isReactElement

```typescript
// Re-export of React's isValidElement
function isReactElement(object: unknown): object is React.ReactElement
```

Returns `true` for values that are rendered JSX elements or results of `React.createElement`. This is the **element** check (rendered instance), not the **component** check (definition).

```typescript
import { isReactElement } from '@winglet/react-utils/filter';

isReactElement(<div>Hello</div>);               // true
isReactElement(React.createElement('span'));    // true
isReactElement(() => <div />);                  // false (component, not element)
isReactElement({ type: 'div', props: {} });     // false (missing React internals)
isReactElement('text');                         // false
isReactElement(null);                           // false
```

---

### isFunctionComponent

```typescript
function isFunctionComponent<
  Props extends object = any,
  Component extends FC<Props> = FC<Props>
>(component: unknown): component is Component
```

Returns `true` for plain function components. Specifically: is a function AND does not have `prototype.isReactComponent`. This means it also returns `true` for arbitrary functions, not just React components — validate in context.

```typescript
isFunctionComponent(() => <div />);   // true
isFunctionComponent(function Comp() { return <div />; }); // true
isFunctionComponent(React.memo(() => <div />));            // false (object)
isFunctionComponent(React.forwardRef((_, ref) => <div ref={ref} />)); // false (object)
```

---

### isClassComponent

```typescript
function isClassComponent<
  Props extends object = any,
  State = any,
  Component extends ComponentClass<Props, State> = ComponentClass<Props, State>
>(component: unknown): component is Component
```

Returns `true` when the value is a class that extends `React.Component` or `React.PureComponent`. Checks `typeof === 'function' && prototype.isReactComponent`.

```typescript
class MyClass extends React.Component {
  render() { return <div />; }
}

isClassComponent(MyClass);              // true
isClassComponent(() => <div />);        // false
isClassComponent(React.memo(MyClass));  // false (wrapped in object)
```

---

### isMemoComponent

```typescript
function isMemoComponent<
  Props extends object = any,
  Component extends MemoExoticComponent<ComponentType<Props>> = MemoExoticComponent<ComponentType<Props>>
>(component: unknown): component is Component
```

Returns `true` for components wrapped with `React.memo()`. Checks `$$typeof === Symbol.for('react.memo')`.

```typescript
const Memoized = React.memo(() => <div />);
const MemoizedClass = React.memo(class extends React.Component { render() { return <div />; } });

isMemoComponent(Memoized);         // true
isMemoComponent(MemoizedClass);    // true
isMemoComponent(() => <div />);    // false (not wrapped)
```

---

## Object Utilities (`@winglet/react-utils/object`)

### remainOnlyReactComponent

```typescript
function remainOnlyReactComponent<
  Input extends Record<string, unknown>,
  Output extends Record<string, ComponentType>
>(dictionary: Input): Output
```

Filters an object to retain only values that pass `isReactComponent`. Useful for processing plugin registries, component maps, or configuration objects that mix components with other values.

```typescript
import { remainOnlyReactComponent } from '@winglet/react-utils/object';

const registry = {
  Button: ButtonComponent,      // component — kept
  Icon: IconComponent,          // component — kept
  helper: helperFunction,       // plain function (could pass isFunctionComponent but...) — kept if function
  config: { timeout: 3000 },    // plain object — removed
  label: 'Submit',              // string — removed
};

const components = remainOnlyReactComponent(registry);
// { Button: ButtonComponent, Icon: IconComponent, helper: helperFunction }
// (helper is kept because isFunctionComponent returns true for any plain function)
```

**Note**: Since `isReactComponent` uses `isFunctionComponent` internally and `isFunctionComponent` returns `true` for any non-class function, be aware that non-component functions will also pass through. Validate component behavior separately if needed.

---

## Render Utilities (`@winglet/react-utils/render`)

### renderComponent

```typescript
function renderComponent<P extends object>(
  Component: ReactNode | ComponentType<P>,
  props?: P,
): ReactNode
```

Safely renders various forms of React "renderable" values with a unified API:

| Input type | Behavior |
|-----------|----------|
| `null`, `undefined`, `0`, `false`, `''` | Returns `null` |
| React element (JSX) | Returns the element as-is, ignores `props` |
| React component (function, class, memo) | Calls `React.createElement(Component, props)` |
| Any other value | Returns `null` |

```typescript
import { renderComponent } from '@winglet/react-utils/render';

const Button = (props) => <button {...props}>{props.children}</button>;

// Component type — instantiated with props
renderComponent(Button, { onClick: handleClick, children: 'Submit' });
// → <Button onClick={handleClick}>Submit</Button>

// Already rendered element — returned as-is (props ignored)
renderComponent(<Button>Cancel</Button>);
// → <Button>Cancel</Button>

// Conditional rendering
renderComponent(condition ? Button : null, { children: 'Maybe' });
// → <Button>Maybe</Button>  or  null

// Unknown prop values
function Wrapper({ label }: { label: string | ComponentType | ReactNode }) {
  return <div>{renderComponent(label)}</div>;
}

// Works with string/number/null gracefully
renderComponent(undefined); // null
renderComponent('text');    // null (strings are not components or elements)
```

**Primary use case**: Component configuration patterns where a prop can be a component type, a pre-rendered element, or absent:

```typescript
interface CardProps {
  icon?: ComponentType | ReactNode;
  title: string;
}

const Card = ({ icon, title }: CardProps) => (
  <div className="card">
    {renderComponent(icon)}
    <h2>{title}</h2>
  </div>
);

// All valid:
<Card title="Settings" icon={GearIcon} />
<Card title="Settings" icon={<img src={gearSvg} />} />
<Card title="Settings" /> {/* icon absent → null */}
```
