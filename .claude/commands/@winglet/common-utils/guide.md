# @winglet/common-utils Usage Guide

## Quick Decision Guide

### "I need to work with arrays"
→ See `@winglet/common-utils/array`

```typescript
import { chunk, unique, difference, intersection, groupBy, sortWithReference } from '@winglet/common-utils/array';
```

### "I need to check a value's type"
→ See `@winglet/common-utils/filter`

```typescript
import { isNil, isEmpty, isArray, isObject, isPlainObject, isFalsy } from '@winglet/common-utils/filter';
```

### "I need to clone / compare / merge objects"
→ See `@winglet/common-utils/object`

```typescript
import { clone, cloneLite, merge, equals, stableEquals, transformKeys } from '@winglet/common-utils/object';
```

- Use `clone` for full deep copy (handles Date, Map, Set, circular refs, Symbols).
- Use `cloneLite` for plain objects/arrays with primitive values — much faster.
- Use `equals` for deep comparison (no circular-ref support).
- Use `stableEquals` when circular references are possible.
- Use `merge` for deep merge — mutates target, arrays are concatenated.

### "I need async timing helpers"
→ See `@winglet/common-utils/promise`

```typescript
import { delay, withTimeout, waitAndExecute } from '@winglet/common-utils/promise';

await delay(1000);                            // pause 1 second
const result = await withTimeout(fn, 5000);   // throw TimeoutError if fn > 5s
await waitAndExecute(500, () => doWork());    // wait 500ms then run
```

### "I need to schedule tasks"
→ See `@winglet/common-utils/scheduler`

```typescript
import { scheduleMacrotask, scheduleMicrotask, scheduleNextTick } from '@winglet/common-utils/scheduler';

scheduleMicrotask(fn);   // highest priority, before macrotasks
scheduleNextTick(fn);    // after current I/O, uses process.nextTick in Node.js
scheduleMacrotask(fn);   // uses MessageChannel (faster than setTimeout(0))
```

### "I need debounce or throttle"
→ See `@winglet/common-utils/function`

```typescript
import { debounce, throttle } from '@winglet/common-utils/function';

// debounce: trailing only by default (executes after quiet period)
const debouncedSearch = debounce(searchFn, 300);

// throttle: leading + trailing by default (executes at most once per interval)
const throttledScroll = throttle(scrollFn, 16); // ~60fps
```

### "I need to hash a string"
→ See `@winglet/common-utils/hash`

```typescript
import { Murmur3, polynomialHash } from '@winglet/common-utils/hash';

const hash = Murmur3.hash('hello world');     // 32-bit integer
const shortId = polynomialHash('my-key', 7); // base36 string, max 7 chars
```

### "I need to cache computed values"
→ See `@winglet/common-utils/lib`

```typescript
import { cacheMapFactory, cacheWeakMapFactory } from '@winglet/common-utils/lib';

// For primitive keys (string, number)
const cache = cacheMapFactory<Map<string, number>>();
cache.set('key', 42);
cache.get('key'); // 42

// For object keys (auto GC when object is collected)
const weakCache = cacheWeakMapFactory<ComputedValue, DataModel>();
weakCache.set(model, computedValue);
```

### "I need custom error types"
→ See `@winglet/common-utils/error`

```typescript
import { BaseError, AbortError, InvalidTypeError, TimeoutError } from '@winglet/common-utils/error';

// AbortError is thrown by delay() and withTimeout() on cancellation
// TimeoutError is thrown by timeout() and withTimeout() on timeout
```

### "I need to parse duration strings"
→ See `@winglet/common-utils/convert`

```typescript
import { convertMsFromDuration } from '@winglet/common-utils/convert';

convertMsFromDuration('5s');   // 5000
convertMsFromDuration('30m');  // 1800000
convertMsFromDuration('2h');   // 7200000
convertMsFromDuration('invalid'); // 0
```

## Common Patterns

### Remove nil/empty values from array
```typescript
import { isNotNil } from '@winglet/common-utils/filter';

const clean = array.filter((item): item is NonNullable<typeof item> => isNotNil(item));
```

### Batch API requests
```typescript
import { chunk } from '@winglet/common-utils/array';

const batches = chunk(userIds, 50);
for (const batch of batches) {
  await Promise.all(batch.map(id => fetchUser(id)));
}
```

### Group data for display
```typescript
import { groupBy } from '@winglet/common-utils/array';

const byDepartment = groupBy(employees, e => e.department);
// { Engineering: [...], Marketing: [...] }
```

### Deep clone with limit
```typescript
import { clone } from '@winglet/common-utils/object';

const shallowCopy = clone(data, 1); // only clone top-level properties
```

### Retry with exponential backoff
```typescript
import { delay } from '@winglet/common-utils/promise';

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    return await fetchData();
  } catch (err) {
    if (attempt === 3) throw err;
    await delay(Math.pow(2, attempt - 1) * 1000);
  }
}
```

### Convert snake_case API response to camelCase
```typescript
import { transformKeys } from '@winglet/common-utils/object';

const camel = transformKeys(apiResponse, (_, key) =>
  key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
);
```
