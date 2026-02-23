# Rules: structure

This file covers the two built-in structure-category rules: `organ-no-claudemd` and `max-depth`.

---

## Rule: organ-no-claudemd

**ID**: `organ-no-claudemd`
**Category**: structure
**Severity**: error
**Enabled by default**: yes

### Description

Organ nodes must not contain a `CLAUDE.md` file.

An **organ** is a leaf-level directory compartment within a fractal module. Organs handle a single concern (e.g., `utils/`, `types/`, `helpers/`) and are not independent modules. They do not have their own architectural documentation.

If an organ directory has its own `CLAUDE.md`, it implies independent module status — which contradicts the organ classification. This is an error because it signals a structural inconsistency that misleads both humans and AI agents.

### Violation Example

```
ERROR: organ directory "utils" contains CLAUDE.md. Independent documentation is prohibited for organs.
Path: src/auth/utils
Suggestion: Remove CLAUDE.md, or reclassify the directory as a fractal node.
```

### Fix Options

1. **Remove `CLAUDE.md`** if the directory is truly a leaf-level utility compartment with no independent concerns.
2. **Reclassify as `fractal`** if the directory has grown into an independent module with its own architecture, tests, and public API.

### Node Classification Reference

| Type | CLAUDE.md | Fractal children | Description |
|---|---|---|---|
| `fractal` | required | possible | Independent module with own documentation and public API |
| `organ` | forbidden | none | Leaf compartment inside a fractal module |
| `pure-function` | optional | none | Collection of pure functions with no side effects |
| `hybrid` | optional | possible | Transitional node with mixed characteristics |

---

## Rule: max-depth

**ID**: `max-depth`
**Category**: structure
**Severity**: error
**Enabled by default**: yes

### Description

The fractal tree depth of any node must not exceed the configured maximum depth (`maxDepth`).

Deep directory hierarchies increase navigation complexity, make imports verbose, and often indicate that a module has grown too large and should be decomposed differently. Exceeding the depth limit is an error because it typically indicates architectural drift.

Default `maxDepth` comes from `DEFAULT_SCAN_OPTIONS.maxDepth` in `src/types/scan.ts`.

### Violation Example

```
ERROR: "helpers" depth (6) exceeds maximum allowed depth (5).
Path: src/platform/adapters/rest/v2/handlers/helpers
Suggestion: Flatten the directory structure or merge related modules.
```

### Fix Options

1. **Flatten the structure**: Merge intermediate directories if they add no semantic value.
2. **Decompose the module**: Extract deeply nested modules into top-level fractal nodes.
3. **Increase maxDepth** (not recommended): Only do this if the project genuinely requires deep nesting and the complexity is justified.

### Configuring maxDepth

```json
{
  "scan": {
    "maxDepth": 6
  }
}
```

Or pass `ScanOptions` directly to `evaluateRules()`:

```typescript
import { evaluateRules, loadBuiltinRules } from '@lumy-pack/filid';

const result = evaluateRules(tree, loadBuiltinRules(), { maxDepth: 6 });
```
