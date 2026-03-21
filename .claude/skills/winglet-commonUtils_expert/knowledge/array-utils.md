# Array Utilities — @winglet/common-utils/array

## Import

```typescript
import { ... } from '@winglet/common-utils/array';
// or
import { ... } from '@winglet/common-utils';
```

---

## at

```typescript
at(array: readonly Type[], indexes: number): Type
at(array: readonly Type[], indexes: number[]): Type[]
```

Access elements by index with negative index support. Negative indices count from the end.

```typescript
const arr = [10, 20, 30, 40, 50];
at(arr, -1);       // 50
at(arr, [0, -1]);  // [10, 50]
```

- Non-integer indices are truncated via `Math.trunc()`.
- Out-of-bounds indices return `undefined`.
- Return type is `Type` for single index, `Type[]` for array of indices (inferred automatically).

---

## chunk

```typescript
chunk<Type>(array: Type[], size: number): Type[][]
```

Split an array into subarrays of at most `size` elements.

```typescript
chunk([1,2,3,4,5], 2); // [[1,2],[3,4],[5]]
chunk([1,2,3], 10);    // [[1,2,3]]
```

- Returns `[array]` (wrapped) if `size` is not a positive integer.
- Uses `Math.ceil` to compute chunk count; last chunk contains remaining elements.

---

## difference

```typescript
difference<Type>(source: Type[], exclude: Type[]): Type[]
```

Returns elements from `source` not present in `exclude`. Uses `Set` for O(1) lookup.

```typescript
difference([1,2,3,4], [2,4]); // [1,3]
```

- Uses SameValueZero equality (NaN === NaN, +0 === -0).
- Preserves order and duplicates from source.
- O(n + m) time complexity.

## differenceBy

```typescript
differenceBy<Type>(source: Type[], exclude: Type[], iteratee: (item: Type) => unknown): Type[]
```

Like `difference` but compares via a key function.

```typescript
differenceBy(
  [{id:1},{id:2},{id:3}],
  [{id:2}],
  item => item.id
); // [{id:1},{id:3}]
```

## differenceWith

```typescript
differenceWith<Type>(source: Type[], exclude: Type[], comparator: (a: Type, b: Type) => boolean): Type[]
```

Like `difference` but uses a custom comparator.

## differenceLite

```typescript
differenceLite<Type>(source: Type[], exclude: Type[]): Type[]
```

Lightweight version optimized for small arrays (< 100 elements). Uses linear scan instead of Set.

---

## filter

```typescript
filter<Type>(array: Type[], predicate: (item: Type, index: number, array: Type[]) => boolean): Type[]
```

Returns elements for which `predicate` returns true. Pre-allocates result array for performance.

---

## forEach

```typescript
forEach<Type>(array: Type[], callback: (item: Type, index: number, array: Type[]) => void): void
```

Iterates over array elements. Performance-optimized alternative to `Array.prototype.forEach`.

## forEachDual

```typescript
forEachDual<A, B>(arrayA: A[], arrayB: B[], callback: (itemA: A, itemB: B, index: number) => void): void
```

Iterates two arrays simultaneously. Stops at the length of the shorter array.

## forEachReverse

```typescript
forEachReverse<Type>(array: Type[], callback: (item: Type, index: number, array: Type[]) => void): void
```

Iterates in reverse order (from last to first element).

---

## groupBy

```typescript
groupBy<Type, Key extends PropertyKey>(
  array: Type[],
  getKey: (item: Type) => Key
): Record<Key, Type[]>
```

Groups array elements by computed key. Returns an object where each key maps to an array of elements.

```typescript
groupBy([1,2,3,4,5,6], n => n % 2 === 0 ? 'even' : 'odd');
// { odd: [1,3,5], even: [2,4,6] }

groupBy(employees, e => e.department);
// { Engineering: [...], Marketing: [...] }
```

- Supports `string | number | symbol` keys.
- Maintains element order within each group.
- O(n) time complexity.

---

## intersection

```typescript
intersection<Type>(source: Type[], target: Type[]): Type[]
```

Returns elements present in both arrays. Uses `Set` for O(1) lookup.

```typescript
intersection([1,2,3,4], [2,4,6]); // [2,4]
```

- Duplicates in `source` that exist in `target` are preserved.
- O(n + m) time complexity.

## intersectionBy / intersectionWith / intersectionLite

Same variants as `difference*` — by key function, custom comparator, or lightweight linear scan.

---

## map

```typescript
map<Type, Result>(
  array: Type[],
  callback: (item: Type, index: number, array: Type[]) => Result
): Result[]
```

Transforms each element. Pre-allocates result array for performance.

```typescript
map([1,2,3], n => n * 2); // [2,4,6]
```

---

## orderedMerge

Merges two sorted arrays while maintaining sort order.

---

## primitiveArrayEqual

```typescript
primitiveArrayEqual(a: unknown[], b: unknown[]): boolean
```

Fast equality check for arrays of primitive values. Compares length then each element with `===`.

---

## sortWithReference

```typescript
sortWithReference<Value>(source: Value[], reference?: Value[]): Value[]
```

Sorts `source` according to the order defined in `reference`. Elements not in `reference` are appended at the end in their original relative order.

```typescript
sortWithReference(['c','a','b','d'], ['a','b','c']); // ['a','b','c','d']
```

- O(n + m) time and space complexity.
- Does not mutate the original arrays.
- Returns `source` unchanged if `reference` is not provided.

---

## unique

```typescript
unique<Type>(source: Type[]): Type[]
```

Removes duplicates using JavaScript `Set` (SameValueZero equality).

```typescript
unique([1,2,2,3,3]); // [1,2,3]
unique([NaN, NaN]);  // [NaN]  — NaN deduplication via Set
```

- For objects: compares by reference, not content. Use `uniqueBy` or `uniqueWith` for content-based dedup.
- O(n) time complexity.

## uniqueBy

```typescript
uniqueBy<Type>(source: Type[], iteratee: (item: Type) => unknown): Type[]
```

Returns unique elements by a key function. Keeps first occurrence.

```typescript
uniqueBy([{id:1,v:'a'},{id:1,v:'b'},{id:2,v:'c'}], x => x.id);
// [{id:1,v:'a'},{id:2,v:'c'}]
```

## uniqueWith

```typescript
uniqueWith<Type>(source: Type[], comparator: (a: Type, b: Type) => boolean): Type[]
```

Returns unique elements using a custom equality comparator.
