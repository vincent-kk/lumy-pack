# Rule: module-entry-point

**ID**: `module-entry-point`
**Category**: module
**Severity**: warning
**Enabled by default**: yes

## Description

Every `fractal` or `hybrid` node must have an entry point file: either `index.ts` or `main.ts`.

A module entry point defines the public API of a fractal module. Without one, the module has no explicit contract — consumers must import from internal files directly, which creates tight coupling and makes refactoring dangerous.

- **`index.ts`**: Standard barrel entry point. Should contain only re-export statements (see `index-barrel-pattern`).
- **`main.ts`**: Alternative entry point for modules with a single primary export or an executable entry. Acceptable when a barrel pattern is not appropriate (e.g., CLI entry points, scripts).

## Violation Example

```
WARNING: fractal module "payments" has no entry point (index.ts or main.ts).
Path: src/payments
Suggestion: Create index.ts or main.ts to define the module's public API.
```

## Fix

Create an `index.ts` that re-exports the module's public API:

```typescript
// src/payments/index.ts
export { processPayment } from './payment-processor.js';
export { PaymentStatus } from './types.js';
export type { PaymentOptions, PaymentResult } from './types.js';
```

Or create a `main.ts` if the module has a single primary concern:

```typescript
// src/payments/main.ts
export { PaymentService } from './payment-service.js';
```

## Scope

This rule applies only to nodes classified as `fractal` or `hybrid`.

- `organ` nodes: No entry point required (organs are internal compartments, not independent modules)
- `pure-function` nodes: No entry point required (pure functions are accessed directly)

## Why Entry Points Matter in FCA-AI

In FCA-AI architecture, fractal modules are the units of independent ownership and documentation.
An entry point is the formal declaration of a module boundary. It signals:

1. **What is public**: Only symbols exported from `index.ts` / `main.ts` are part of the module's contract
2. **What is internal**: Files not re-exported are implementation details that can change freely
3. **Where to import from**: Consumers always import from the entry point, never from internal files

Enforcing this rule ensures that the dependency graph remains clean and that module boundaries are respected by both humans and AI agents.

## Module Split Signals

When a fractal module grows large, filid uses additional metrics to signal when a split is needed:

| Metric | Threshold | Action |
|---|---|---|
| LCOM4 (Lack of Cohesion) | >= 2 | Split into separate modules |
| Cyclomatic Complexity | > 20 | Compress or abstract |
| File size | > 500 lines | Consider splitting |

These are reported by the `fca-scan` skill and the `module-split-decision` MCP tool.
