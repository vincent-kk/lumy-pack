# Core Utilities — Hash, Convert, Console, Libs, Errors, Constants

---

## Hash Utilities

### Import
```typescript
import { Murmur3, polynomialHash } from '@winglet/common-utils/hash';
```

### Murmur3

Non-cryptographic 32-bit hash (MurmurHash3 by Austin Appleby). Fast and suitable for hash tables, cache keys, and data deduplication.

```typescript
// Static one-shot hash
const hash = Murmur3.hash('hello world');        // number
const seeded = Murmur3.hash('hello', 42);        // with custom seed

// Incremental hashing (chain multiple inputs)
const hasher = new Murmur3();
hasher.hash('part1').hash('part2').hash('part3');
const result = hasher.result();

// Reset and reuse
hasher.reset(0);
hasher.hash(new Uint8Array([1, 2, 3]));
hasher.hash(new ArrayBuffer(8));
```

**Accepts:** `string`, `ArrayBuffer`, `Uint8Array`

**Performance features:**
- Loop unrolling for 4-chunk blocks
- DataView optimization for large aligned binary data
- Endianness detection for binary processing
- Incremental hashing avoids re-processing

**NOT for:** Security-critical applications (passwords, tokens, signatures).

---

### polynomialHash

```typescript
polynomialHash(target: string, length?: number): string
```

31-based polynomial rolling hash (like Java's `String.hashCode()`). Returns a base36-encoded string.

```typescript
polynomialHash('my-cache-key');      // '2g4k8f1' (7 chars, default)
polynomialHash('my-cache-key', 4);   // '2g4k'
```

- Output length: default 7, max 7
- Returns string padded/sliced to exact `length`
- Deterministic and fast: O(n) where n is string length
- NOT cryptographically secure

**Use for:** Cache keys, short identifiers, quick lookup hashes.

---

## Convert Utilities

### Import
```typescript
import { convertMsFromDuration } from '@winglet/common-utils/convert';
```

### convertMsFromDuration

```typescript
convertMsFromDuration(duration: string): number
```

Converts a human-readable duration string to milliseconds. Returns `0` for invalid input (never throws).

**Supported units:**

| Unit | Meaning | Example | Result |
|------|---------|---------|--------|
| `ms` | milliseconds | `'500ms'` | `500` |
| `s` | seconds | `'5s'` | `5000` |
| `m` | minutes | `'30m'` | `1800000` |
| `h` | hours | `'2h'` | `7200000` |

```typescript
convertMsFromDuration('100ms'); // 100
convertMsFromDuration('5s');    // 5000
convertMsFromDuration('30m');   // 1800000
convertMsFromDuration('2h');    // 7200000

// Whitespace tolerant
convertMsFromDuration(' 5 s '); // 5000

// Invalid inputs → 0
convertMsFromDuration('1.5s');  // 0 (decimals not supported)
convertMsFromDuration('5S');    // 0 (case sensitive)
convertMsFromDuration('5 sec'); // 0 (full words not supported)
convertMsFromDuration('');      // 0
```

**Regex is lazily initialized and cached** — subsequent calls reuse the same regex instance.

---

## Console Utilities

### Import
```typescript
import { printError } from '@winglet/common-utils/console';
```

Dedicated sub-path: `@winglet/common-utils/console` (not `/lib` and not `/error`).

### printError

```typescript
printError(error: unknown): void
```

Prints an error to the console in a formatted way, handling various error types gracefully. Safe for `BaseError` subclasses (prints `code`, `details`) and falls back to plain formatting for unknown values.

---

## Core Library Utilities

### Import
```typescript
import { ... } from '@winglet/common-utils/lib';
```

### cacheMapFactory

```typescript
cacheMapFactory<M extends Map<string, any>>(
  defaultValue?: M | Iterable<[string, any]>
): CacheMap
```

Creates a Map-based cache with a convenience API. For primitive keys (strings, numbers).

```typescript
const cache = cacheMapFactory<Map<string, User>>();
cache.set('user-1', user);
cache.get('user-1');    // User | undefined
cache.has('user-1');    // boolean
cache.delete('user-1'); // boolean
cache.size();           // number
cache.keys();           // IterableIterator<string>
cache.values();         // IterableIterator<User>
cache.entries();        // IterableIterator<[string, User]>
cache.clear();          // void
cache.getCache();       // underlying Map<string, User>
```

### cacheWeakMapFactory

```typescript
cacheWeakMapFactory<V, K extends object = object>(
  defaultValue?: WeakMap<K, V>
): WeakCacheMap
```

Creates a WeakMap-based cache for object keys. Entries are automatically garbage collected when key objects are no longer referenced.

```typescript
const cache = cacheWeakMapFactory<ComputedValue, DataModel>();
cache.set(model, computedValue);
cache.get(model);    // ComputedValue | undefined
cache.has(model);    // boolean
cache.delete(model); // boolean
cache.getCache();    // underlying WeakMap
```

**Choose between them:**
- `cacheMapFactory` — primitive keys, need to enumerate/count entries
- `cacheWeakMapFactory` — object keys, automatic memory management, no enumeration needed

### counterFactory

```typescript
counterFactory(start?: number): () => number
```

Creates an auto-incrementing counter function.

```typescript
const nextId = counterFactory();
nextId(); // 0
nextId(); // 1
nextId(); // 2

const nextId2 = counterFactory(100);
nextId2(); // 100
nextId2(); // 101
```

### getTypeTag

```typescript
getTypeTag(value: unknown): string
```

Returns the internal `[[Class]]` type tag via `Object.prototype.toString.call(value)`.

```typescript
getTypeTag([]);           // '[object Array]'
getTypeTag(new Date());   // '[object Date]'
getTypeTag(new Map());    // '[object Map]'
getTypeTag(null);         // '[object Null]'
```

### getKeys

```typescript
getKeys(object: object): string[]
```

Returns own enumerable property keys. Typed wrapper for `Object.keys`.

### hasOwnProperty

```typescript
hasOwnProperty(object: unknown, key: PropertyKey): boolean
```

Safe `hasOwnProperty` check that works even on `Object.create(null)` objects.

### random

Random number generation utilities:

```typescript
import { getRandomNumber, getRandomString, getRandomBoolean } from '@winglet/common-utils/lib';

getRandomNumber(min, max);           // random integer in [min, max]
getRandomString(length);             // random alphanumeric string
getRandomBoolean();                  // random boolean
```

---

## Error Classes

### Import
```typescript
import { BaseError, AbortError, InvalidTypeError, TimeoutError } from '@winglet/common-utils/error';
```

### BaseError (abstract)

```typescript
abstract class BaseError extends Error {
  readonly group: string;    // error group identifier
  readonly specific: string; // specific error code
  readonly code: string;     // format: "${group}.${specific}"
  readonly details: Record<string, unknown>;
}
```

Base class for all custom errors. Ensures prototype chain is set correctly for `instanceof` checks.

### AbortError

Thrown by `delay()` and `withTimeout()` when cancelled via `AbortSignal`.

```typescript
try {
  await delay(5000, { signal: controller.signal });
} catch (e) {
  if (e instanceof AbortError) {
    console.log(e.code);    // e.g., 'ABORT.SIGNAL_RECEIVED'
    console.log(e.message); // 'Abort signal received'
  }
}
```

### TimeoutError

Thrown by `timeout()` and `withTimeout()` when the time limit is exceeded.

```typescript
try {
  await withTimeout(() => slowOperation(), 3000);
} catch (e) {
  if (e instanceof TimeoutError) {
    console.log('Operation timed out');
  }
}
```

### InvalidTypeError

Thrown when a value has an unexpected type. Use in validation logic.

---

## Constants

### Import
```typescript
import { MILLISECOND, SECOND, MINUTE, HOUR, DAY } from '@winglet/common-utils/constant';
// or
import { TIME_UNITS, TYPE_TAGS } from '@winglet/common-utils/constant';
```

### Time constants

```typescript
MILLISECOND = 1
SECOND      = 1_000
MINUTE      = 60_000
HOUR        = 3_600_000
DAY         = 86_400_000
```

### TYPE_TAGS

String constants for `[[Class]]` type tags:

```typescript
TYPE_TAGS.array    // '[object Array]'
TYPE_TAGS.date     // '[object Date]'
TYPE_TAGS.map      // '[object Map]'
TYPE_TAGS.set      // '[object Set]'
TYPE_TAGS.regexp   // '[object RegExp]'
// ...etc
```

Used internally by `getTypeTag` comparisons.
