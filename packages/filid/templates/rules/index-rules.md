# Rule: index-barrel-pattern

**ID**: `index-barrel-pattern`
**Category**: index
**Severity**: warning
**Enabled by default**: yes

## Description

The `index.ts` file in a `fractal` or `hybrid` node must be a **pure barrel** — it may only contain re-export statements and must not contain any direct declarations (functions, classes, constants, types defined inline).

A barrel file is a module entry point that aggregates and re-exports the public API of a module. Mixing declarations into a barrel file violates separation of concerns: declarations belong in dedicated files, and the barrel should only control what is publicly visible.

## What Counts as a Pure Barrel

A pure barrel file contains only `export ... from '...'` statements:

```typescript
// Pure barrel — allowed
export { myFunction } from './my-function.js';
export { MyClass } from './my-class.js';
export type { MyType } from './types.js';
export * from './utils.js';
```

## What Violates the Rule

Any direct declaration in `index.ts` triggers a violation:

```typescript
// NOT a pure barrel — violation
export function myFunction() {   // direct function declaration
  return 42;
}

export const MY_CONSTANT = 'value';  // direct constant declaration

export interface MyInterface {       // direct interface declaration
  name: string;
}
```

## Violation Example

```
WARNING: "auth/index.ts" contains 3 direct declarations. Does not follow pure barrel pattern.
Path: src/auth
Suggestion: Move direct declarations to separate files and re-export from index.ts.
```

## Fix

Extract each direct declaration into its own file, then re-export from `index.ts`:

```
Before:
  src/auth/index.ts   ← contains function declarations

After:
  src/auth/auth.ts    ← contains function declarations
  src/auth/index.ts   ← re-exports from auth.ts
```

## Scope

This rule applies only to `fractal` and `hybrid` nodes that have an `index.ts` or `index.js` file.
It does not apply to `organ` or `pure-function` nodes.

The rule uses the `barrelPattern` metadata field populated during AST analysis
(`{ isPureBarrel: boolean, declarationCount: number }`).
If AST metadata is not available, the rule skips the check (no false positives).

## Notes

- Pure barrel pattern makes it trivial to identify and control the public API of a module
- It enables tree-shaking by bundlers (each named export traces to a single source file)
- Inline declarations in barrel files are often a sign of a module that started small and needs to be formalized
