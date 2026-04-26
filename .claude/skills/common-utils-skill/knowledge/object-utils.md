# Object Utilities — @winglet/common-utils/object

## Import

```typescript
import { ... } from '@winglet/common-utils/object';
```

---

## clone

```typescript
clone<Type>(target: Type, maxDepth?: number): Type
```

Full deep clone with comprehensive type support and circular reference detection.

**Supported types:**
- Primitives (returned as-is)
- Plain objects, arrays
- Date, RegExp, Map, Set, Error
- ArrayBuffer, SharedArrayBuffer, TypedArrays, DataView
- File, Blob (browser)
- Symbol properties
- Custom prototype chains

```typescript
const obj = { a: 1, b: { c: [2, 3] }, d: new Date() };
const copy = clone(obj);
// copy.b !== obj.b (deep copy)
// copy.d !== obj.d (Date cloned)

// Circular reference safe
const circular: any = { name: 'root' };
circular.self = circular;
const cloned = clone(circular);
cloned.self === cloned; // true
```

**`maxDepth` parameter:** Objects at or beyond this depth are returned by reference.

```typescript
const copy = clone(deepObject, 2); // clone only 2 levels deep
```

**Limitations:**
- Functions are cloned by reference.
- DOM elements are returned as-is.
- Performance: ~3x slower than `JSON.parse(JSON.stringify())` but handles far more types.

---

## cloneLite

```typescript
cloneLite<Type>(target: Type): Type
```

High-performance deep clone for simple structures: primitives, plain objects, and arrays only.

- Does NOT handle Date, Map, Set, RegExp, etc.
- No circular reference detection (will stack overflow).
- Significantly faster than `clone` for simple data.

```typescript
cloneLite({ a: 1, b: [2, 3] }); // fast, plain structures only
```

---

## shallowClone

```typescript
shallowClone<Type>(target: Type): Type
```

Creates a shallow copy of an array or plain object. Nested objects are shared references.

---

## countKey

```typescript
countKey(object: object): number
```

Counts all enumerable properties including inherited ones (uses `for...in`).

## countObjectKey

```typescript
countObjectKey(object: object): number
```

Counts only own enumerable properties (uses `Object.keys`).

---

## equals

```typescript
equals<Left, Right>(
  left: Left,
  right: Right,
  omit?: Set<PropertyKey> | Array<PropertyKey>
): boolean
```

Deep equality comparison. Handles NaN correctly (NaN === NaN returns true).

```typescript
equals({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }); // true
equals({ a: 1, b: 2, ts: Date.now() }, { a: 1, b: 2, ts: 0 }, ['ts']); // true (omit ts)
```

**IMPORTANT:** Does NOT handle circular references — will cause stack overflow. Use `stableEquals` instead.

**Performance:** ~2x faster than `stableEquals`, ~30% faster than Lodash `isEqual`.

---

## stableEquals

```typescript
stableEquals<Left, Right>(left: Left, right: Right): boolean
```

Circular-reference-safe deep equality. Handles all types including Date, RegExp, TypedArrays, Symbol properties.

Use when:
- Circular references may exist
- Comparing Date, RegExp, TypedArray values
- Maximum reliability is needed over performance

---

## getEmptyObject

```typescript
getEmptyObject(): Record<PropertyKey, never>
```

Creates a truly empty object with no prototype chain (`Object.create(null)`).

---

## getFirstKey

```typescript
getFirstKey(object: object): string | undefined
```

Returns the first enumerable own property key.

---

## getJSONPointer

```typescript
getJSONPointer(object: object, pointer: string): unknown
```

Gets a value using a JSON Pointer path (RFC 6901). E.g., `/user/name`.

---

## getObjectKeys

```typescript
getObjectKeys<T extends object>(object: T): Array<keyof T>
```

Returns `Object.keys(object)` typed as `Array<keyof T>`.

---

## getSymbols

```typescript
getSymbols(object: object): symbol[]
```

Returns all own symbol properties via `Object.getOwnPropertySymbols`.

---

## hasUndefined

```typescript
hasUndefined(object: object): boolean
```

Returns true if any own property value is `undefined`.

---

## merge

```typescript
merge<Target, Source>(target: Target, source: Source): Target & Source
```

Deep recursive merge. **Mutates `target` in place.**

**Merge rules:**
- `object + object` → recursive deep merge
- `array + array` → concatenation (target + source)
- incompatible types → source replaces target value
- `undefined` source value does NOT override defined target value

```typescript
merge({ a: 1, b: { x: 10 } }, { b: { y: 20 }, c: 3 });
// { a: 1, b: { x: 10, y: 20 }, c: 3 }

merge({ tags: ['a'] }, { tags: ['b'] });
// { tags: ['a', 'b'] }  ← arrays concatenated
```

**IMPORTANT:** No circular reference protection — will stack overflow.

---

## removePrototype

```typescript
removePrototype(object: object): void
```

Removes the prototype chain from an object in-place (`Object.setPrototypeOf(obj, null)`).

---

## removeUndefined

```typescript
removeUndefined<T extends object>(object: T): Partial<T>
```

Returns a new object with all `undefined`-valued properties removed.

---

## serializeNative / serializeObject / serializeWithFullSortedKeys / stableSerialize

Serialization functions for converting objects to JSON strings.

```typescript
serializeObject(obj);                    // JSON.stringify with error handling
serializeWithFullSortedKeys(obj);        // JSON.stringify with keys sorted recursively
stableSerialize(obj);                    // stable serialization (consistent key order)
```

---

## sortObjectKeys

```typescript
sortObjectKeys<T extends object>(object: T): T
```

Returns a new object with keys sorted alphabetically.

---

## transformKeys

```typescript
transformKeys<Type, Key extends PropertyKey>(
  object: Type,
  getKey: (value: Type[keyof Type], key: keyof Type, object: Type) => Key
): Record<Key, Type[keyof Type]>
```

Creates a new object by transforming all keys. Values are unchanged.

```typescript
// snake_case → camelCase
transformKeys(apiResponse, (_, key) =>
  key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
);

// Add prefix
transformKeys(data, (_, key) => `user_${key}`);
```

- Processes only own enumerable properties.
- Key collisions after transformation: last write wins.

---

## transformValues

```typescript
transformValues<Type, Value>(
  object: Type,
  getValue: (value: Type[keyof Type], key: keyof Type, object: Type) => Value
): Record<keyof Type, Value>
```

Creates a new object by transforming all values. Keys are unchanged.

```typescript
transformValues({ a: 1, b: 2, c: 3 }, v => v * 2);
// { a: 2, b: 4, c: 6 }
```
