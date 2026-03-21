# Math Utilities — @winglet/common-utils/math

## Import

```typescript
import { ... } from '@winglet/common-utils/math';
```

---

## Basic Arithmetic

### abs
```typescript
abs(value: number): number
```
Absolute value with enhanced type safety. Returns `Math.abs(value)`.

### clamp
```typescript
clamp(value: number, min: number, max: number): number
```
Restricts `value` to the range `[min, max]`.

```typescript
clamp(5, 1, 10);  // 5
clamp(-3, 0, 10); // 0
clamp(15, 0, 10); // 10
```

### round
```typescript
round(value: number, decimals?: number): number
```
Rounds to specified decimal places (default: 0).

```typescript
round(3.14159, 2); // 3.14
round(1.005, 2);   // 1.01
```

### sum
```typescript
sum(values: number[]): number
```
Sum of all numbers in array. Optimized iteration.

### mean
```typescript
mean(values: number[]): number
```
Arithmetic mean (average).

### median
```typescript
median(values: number[]): number
```
Middle value of array (sorts internally, does not mutate original).

### range
```typescript
range(values: number[]): number
```
Difference between max and min values.

---

## Min / Max

### min
```typescript
min(values: number[]): number
```
Minimum value in array.

### minLite
```typescript
minLite(a: number, b: number): number
```
Returns smaller of two values. Faster than `min([a, b])` for just two numbers.

### max
```typescript
max(values: number[]): number
```
Maximum value in array.

### maxLite
```typescript
maxLite(a: number, b: number): number
```
Returns larger of two values.

---

## Number Predicates

### inRange
```typescript
inRange(value: number, min: number, max: number): boolean
```
Returns true if `min <= value <= max` (inclusive).

### isClose
```typescript
isClose(a: number, b: number, tolerance?: number): boolean
```
Compares floating-point numbers within a tolerance. Handles precision issues across all number magnitudes.

```typescript
isClose(0.1 + 0.2, 0.3);        // true
isClose(1000000.1, 1000000.2);   // false (default tolerance)
```

### isEven
```typescript
isEven(value: number): boolean
```
Returns true if value is even.

### isOdd
```typescript
isOdd(value: number): boolean
```
Returns true if value is odd. Handles negative numbers correctly.

### isPrime
```typescript
isPrime(value: number): boolean
```
Optimized trial division algorithm.

---

## Number Theory

### gcd
```typescript
gcd(a: number, b: number): number
```
Greatest common divisor using Euclidean algorithm.

```typescript
gcd(12, 8);  // 4
gcd(17, 5);  // 1
```

### lcm
```typescript
lcm(a: number, b: number): number
```
Least common multiple. Uses GCD internally: `|a * b| / gcd(a, b)`.

```typescript
lcm(4, 6);  // 12
```

### digitSum
```typescript
digitSum(value: number): number
```
Sum of all digits in an integer.

```typescript
digitSum(123); // 6
digitSum(999); // 27
```

---

## Combinatorics

### factorial
```typescript
factorial(n: number): number
```
Factorial of non-negative integer. Uses intelligent caching for repeated calls.

```typescript
factorial(5);  // 120
factorial(10); // 3628800
```

### fibonacci
```typescript
fibonacci(n: number): number
```
Nth Fibonacci number using optimized iterative algorithm with caching.

```typescript
fibonacci(0);  // 0
fibonacci(10); // 55
fibonacci(20); // 6765
```

### combination
```typescript
combination(n: number, r: number): number
```
Number of combinations (n choose r). Efficient iterative method.

```typescript
combination(10, 3); // 120
```

### permutation
```typescript
permutation(n: number, r: number): number
```
Number of permutations (n permute r).

```typescript
permutation(5, 3); // 60
```

---

## Base Conversion

### toBase
```typescript
toBase(value: number, base: number): string
```
Converts decimal integer to string in any base (2–36).

```typescript
toBase(255, 16); // 'ff'
toBase(10, 2);   // '1010'
toBase(36, 36);  // '10'
```

### fromBase
```typescript
fromBase(value: string, base: number): number
```
Converts string in given base back to decimal.

```typescript
fromBase('ff', 16); // 255
fromBase('1010', 2); // 10
```
