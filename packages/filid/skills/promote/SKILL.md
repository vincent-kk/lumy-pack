---
name: promote
description: "Promote stable test.ts files to parameterized spec.ts"
---

# /promote — Test Promotion

Identify and promote stable test.ts files to parameterized spec.ts files.

## What This Skill Does

1. **Identify candidates** — test.ts files stable for 90+ days with no failures
2. **Analyze test cases** — count and categorize basic vs complex tests
3. **Generate spec.ts** — create parameterized spec from stable test patterns
4. **Validate** — ensure promoted spec.ts stays within 3+12 rule (max 15 cases)

## Usage

```
/promote [path] [--days=90]
```

- `path` (optional): Target directory. Defaults to current working directory.
- `--days`: Minimum stability period in days (default: 90).

## Steps

1. Use `test-metrics` tool with action `count` to analyze test files
2. Check promotion eligibility using stability criteria
3. For eligible files, generate parameterized spec.ts structure
4. Validate the new spec against 3+12 rule before writing
