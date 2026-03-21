# Filter / Type Guard Utilities — @winglet/common-utils/filter

## Import

```typescript
import { ... } from '@winglet/common-utils/filter';
```

All functions are TypeScript type guards unless stated otherwise.

---

## Nil / Existence Checks

### isNil
```typescript
isNil(value?: unknown): value is null | undefined
```
Returns `true` for `null` or `undefined`. Uses loose equality (`value == null`).

```typescript
isNil(null);      // true
isNil(undefined); // true
isNil(0);         // false
isNil('');        // false
```

### isNotNil
```typescript
isNotNil<T>(value: T | null | undefined): value is T
```
Inverse of `isNil`. Narrows type to exclude `null | undefined`.

### isNull
```typescript
isNull(value: unknown): value is null
```

### isUndefined
```typescript
isUndefined(value: unknown): value is undefined
```

---

## Emptiness Check

### isEmpty
```typescript
isEmpty(value: unknown): boolean
```
Comprehensive emptiness check:
- `null`, `undefined` → true
- Falsy primitives (`''`, `0`, `false`, `NaN`, `0n`) → true
- Objects/arrays with no own enumerable properties → true (`{}`, `[]`, `new Set()`, `new Map()`)
- Functions → always false

```typescript
isEmpty(null);        // true
isEmpty('');          // true
isEmpty(0);           // true
isEmpty({});          // true
isEmpty([]);          // true
isEmpty(new Set());   // true
isEmpty('hello');     // false
isEmpty([1]);         // false
isEmpty(() => {});    // false
```

### isEmptyArray
```typescript
isEmptyArray(value: unknown): value is never[]
```
Returns true if value is an array with zero elements.

### isEmptyObject
```typescript
isEmptyObject(value: unknown): value is Record<PropertyKey, never>
```
Returns true if value is an object with no own enumerable properties.

### isEmptyPlainObject
```typescript
isEmptyPlainObject(value: unknown): boolean
```
Returns true if value is a plain object (`{}`) with no own enumerable properties.

---

## Truthy / Falsy

### isTruthy
```typescript
isTruthy<T>(value: T | Falsy): value is T
```
Type guard that narrows to the truthy type.

### isFalsy
```typescript
isFalsy<T>(value: T): value is Falsy
```
Returns true for `null`, `undefined`, `false`, `0`, `0n`, `''`, `NaN`.

---

## Primitive Type Guards

### isString
```typescript
isString(value: unknown): value is string
```

### isNumber
```typescript
isNumber(value: unknown): value is number
```
Note: `isNumber(NaN)` returns `true` since `typeof NaN === 'number'`.

### isBoolean
```typescript
isBoolean(value: unknown): value is boolean
```

### isSymbol
```typescript
isSymbol(value: unknown): value is symbol
```

### isInteger
```typescript
isInteger(value: unknown): value is number
```
Returns true if value is a safe integer (`Number.isInteger`).

### isPrimitiveType
```typescript
isPrimitiveType(value: unknown): value is string | number | boolean | null | undefined | symbol | bigint
```
Returns true for any JavaScript primitive.

### isPrimitiveObject
```typescript
isPrimitiveObject(value: unknown): boolean
```
Returns true for primitive wrapper objects (`new String()`, `new Number()`, `new Boolean()`).

---

## Object / Collection Type Guards

### isObject
```typescript
isObject(value: unknown): value is object
```
Returns true if `typeof value === 'object'` and value is not null. Includes arrays, Date, Map, etc.

### isPlainObject
```typescript
isPlainObject(value: unknown): value is Record<PropertyKey, unknown>
```
Returns true only for plain objects: created via `{}`, `Object.create(null)`, or `new Object()`.

### isFunction
```typescript
isFunction(value: unknown): value is Function
```

### isArray
```typescript
isArray(value: unknown): value is unknown[]
```
Alias for `Array.isArray`.

### isArrayLike
```typescript
isArrayLike(value: unknown): boolean
```
Returns true if value has a numeric `length` property (strings, NodeList, arguments, etc.).

### isArrayIndex
```typescript
isArrayIndex(value: unknown): boolean
```
Returns true if value is a valid array index (non-negative integer string or number).

### isMap
```typescript
isMap(value: unknown): value is Map<unknown, unknown>
```

### isSet
```typescript
isSet(value: unknown): value is Set<unknown>
```

### isWeakMap
```typescript
isWeakMap(value: unknown): value is WeakMap<object, unknown>
```

### isWeakSet
```typescript
isWeakSet(value: unknown): value is WeakSet<object>
```

### isDate
```typescript
isDate(value: unknown): value is Date
```

### isRegex
```typescript
isRegex(value: unknown): value is RegExp
```

### isError
```typescript
isError(value: unknown): value is Error
```

### isPromise
```typescript
isPromise(value: unknown): value is Promise<unknown>
```

---

## Binary / Buffer Type Guards

### isArrayBuffer
```typescript
isArrayBuffer(value: unknown): value is ArrayBuffer
```

### isSharedArrayBuffer
```typescript
isSharedArrayBuffer(value: unknown): value is SharedArrayBuffer
```

### isTypedArray
```typescript
isTypedArray(value: unknown): boolean
```
Returns true for Uint8Array, Int32Array, Float64Array, etc.

### isDataView
```typescript
isDataView(value: unknown): value is DataView
```

### isBuffer
```typescript
isBuffer(value: unknown): boolean
```
Returns true for Node.js Buffer instances.

---

## Web API Type Guards

### isBlob
```typescript
isBlob(value: unknown): value is Blob
```

### isFile
```typescript
isFile(value: unknown): value is File
```

---

## Cloneability

### isCloneable
```typescript
isCloneable(value: unknown): boolean
```
Returns true if value can be deep-cloned by the `clone` function (non-null objects that aren't functions).

---

## String Validation

### isValidRegexPattern
```typescript
isValidRegexPattern(value: string): boolean
```
Returns true if the string is a valid regular expression pattern (tested via `new RegExp(value)`).

---

## Usage Patterns

```typescript
// Type-narrowing in conditional
function process(value: unknown) {
  if (isString(value)) {
    return value.toUpperCase(); // TypeScript knows: string
  }
  if (isArray(value)) {
    return value.length;        // TypeScript knows: unknown[]
  }
}

// Filter nulls from array
const clean = items.filter(isNotNil); // TypeScript narrows type

// Guard before accessing properties
if (isPlainObject(data) && !isEmpty(data)) {
  // safe to access data properties
}
```
