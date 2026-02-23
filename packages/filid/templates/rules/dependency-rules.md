# Rules: dependency

This file covers the two built-in dependency-category rules: `circular-dependency` and `pure-function-isolation`.

---

## Rule: circular-dependency

**ID**: `circular-dependency`
**Category**: dependency
**Severity**: error
**Enabled by default**: yes

### Description

Modules must not have circular dependencies (A imports B, B imports A, or longer cycles).

Circular dependencies cause initialization ordering issues, make modules impossible to independently test, and create tight coupling that resists refactoring. In FCA-AI architecture, modules are organized as a directed acyclic graph (DAG); any cycle violates the fundamental layering principle.

### Current Implementation Status

> **Phase 2 placeholder**: The per-node rule check currently returns an empty violation list.
> Circular dependency detection requires access to the full dependency graph across all modules,
> which is not available at the individual node evaluation level.
>
> Full circular dependency detection is performed by `dependency-graph.ts` (`detectCycles()`) at the project-analyzer level.
> Use the `fca-scan` skill or `project-analyzer` MCP tool to detect project-wide cycles.

### Full Detection (via project-analyzer)

```typescript
import { buildDependencyGraph } from '@lumy-pack/filid';

const graph = await buildDependencyGraph(tree);
const cycles = graph.cycles; // string[][] — each array is one cycle
```

### Fix

Break cycles by:
1. Extracting shared logic into a new organ or pure-function node that both modules can import
2. Inverting the dependency direction using an interface or event pattern
3. Merging two tightly coupled modules into a single fractal node

---

## Rule: pure-function-isolation

**ID**: `pure-function-isolation`
**Category**: dependency
**Severity**: error
**Enabled by default**: yes

### Description

Nodes classified as `pure-function` must not import from `fractal` or `hybrid` modules.

A **pure-function** node is a collection of functions with no side effects, no I/O, and no dependency on stateful or complex modules. If a pure-function node imports from a fractal module, it is no longer truly pure — it has taken on the complexity and state surface of that module.

This rule is enforced at the per-node level using the `dependencies` metadata field populated during AST analysis.

### Violation Example

```
ERROR: pure-function node "math-utils" imports from fractal module "auth-service".
Path: src/shared/math-utils
Suggestion: Move "math-utils" into an organ under "auth-service", or remove the dependency.
```

### Fix Options

1. **Move into the fractal module**: If `math-utils` is only used by `auth-service`, make it an organ inside `auth-service`.
2. **Remove the dependency**: Refactor so the pure function does not need the fractal module. Pass dependencies as arguments instead of importing them.
3. **Reclassify the node**: If `math-utils` genuinely needs fractal-module dependencies, reclassify it from `pure-function` to `organ` or `fractal`.

### Why This Matters

Pure functions are the most reusable, testable, and cacheable unit in FCA-AI architecture. Keeping them free of fractal dependencies ensures they remain universally importable from any layer without risk of introducing unintended coupling.
