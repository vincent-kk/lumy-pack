# restructure — Reference Documentation

Detailed workflow, MCP tool call signatures, and output format templates for the
fractal structure restructuring skill. For the quick-start overview, see [SKILL.md](./SKILL.md).

## Section 1 — Analysis & Proposal

`fractal-architect` scans the full tree with `fractal-scan`.

```
fractal-scan({ path: "<target-path>" })
// Returns: { nodes: FractalNode[], summary: ScanSummary, violations: Violation[] }
```

Detect fractal principle deviations with `drift-detect`.

```
drift-detect({ path: "<target-path>" })
// Returns: { drifts: DriftItem[], total: number }
```

Use `lca-resolve` when the correct target location for a move must be determined.

```
lca-resolve({ nodePath: "<path>", contextPaths: ["<sibling1>", "<sibling2>"] })
// Returns: { lcaPath: string, recommendedParent: string, confidence: number }
```

Fetch active rules with `rule-query` to anchor proposal rationale.

```
rule-query({ action: "list" })
// Returns: { rules: Rule[] }
```

After analysis, `fractal-architect` generates a structured YAML proposal:

```yaml
restructure-plan:
  target: src/
  generated: '2026-02-22T00:00:00Z'
  actions:
    - type: move
      source: src/components/AuthModal
      target: src/features/auth/components/AuthModal
      reason: fractal module incorrectly placed under organ directory
    - type: rename
      source: src/utils/UserHelper.ts
      target: src/utils/user-helper.ts
      reason: kebab-case naming convention violation (HOL-N001)
    - type: create-index
      target: src/features/auth
      reason: fractal node missing index.ts barrel export
    - type: reclassify
      path: src/shared/state
      from: organ
      to: fractal
      reason: Contains state management logic; organ classification is incorrect
```

## Section 2 — Plan Review & Approval

In `--dry-run` mode, print the plan and exit without changes:

```
[DRY RUN] Restructuring Plan — 4 actions:
  MOVE       src/components/AuthModal → src/features/auth/components/AuthModal
  RENAME     src/utils/UserHelper.ts → src/utils/user-helper.ts
  CREATE     src/features/auth/index.ts (barrel export)
  RECLASSIFY src/shared/state: organ → fractal
No changes applied. Remove --dry-run to execute.
```

Without `--auto-approve`, request explicit user confirmation:

```
Apply the above restructuring plan?
Affected files: N  |  Import path updates: N
[y/N]
```

Proceed to Stage 3 when the user enters 'y' or `--auto-approve` is set.

## Section 3 — Execution

`restructurer` applies actions in this priority order:

1. `reclassify` (metadata changes only, no file moves)
2. `move` (file system changes)
3. `rename` (file system changes)
4. `create-index` (new file creation)
5. `create-main` (new file creation)
6. `split` / `merge` (compound operations)

After each move or rename, import paths are updated immediately:

```
affectedFiles = grep("<old-path>", all_source_files)
for file in affectedFiles:
  edit(file, replace("<old-import>", "<new-import>"))
```

Example generated index.ts:

```typescript
// src/features/auth/index.ts
export { AuthModal } from './components/AuthModal';
export { useAuth } from './hooks/useAuth';
export type { AuthUser, AuthState } from './types';
```

## Section 4 — Validation

After `restructurer` completes, `fractal-architect` validates with `structure-validate`.

```
structure-validate({ path: "<target-path>" })
// Returns: { passed: boolean, checks: ValidationCheck[], violations: Violation[] }
```

Validation checks:

- All imports are resolvable
- No orphaned files (unreferenced after moves)
- All fractal nodes have index.ts
- No organ directories contain fractal children
- No naming convention violations

### Final Execution Report Format

```
## Restructure Complete — <target path>

### Actions Executed
| Action | Source | Target / Result | Status |
|--------|--------|----------------|--------|
| move | src/components/AuthModal | src/features/auth/components/AuthModal | ✓ |
| rename | src/utils/UserHelper.ts | src/utils/user-helper.ts | ✓ |
| create-index | src/features/auth/index.ts | — | ✓ |
| reclassify | src/shared/state | fractal | ✓ |

### Import Path Updates
| File | Old Import | New Import |
|------|------------|------------|
| src/app.ts | ../components/AuthModal | ../features/auth/components/AuthModal |

### Validation Result
structure-validate: PASS
- All imports resolvable: ✓
- No orphaned files: ✓
- All fractal nodes have index.ts: ✓
- Organ directory rules satisfied: ✓

### Summary
- Files moved: N
- Files renamed: N
- Files created: N
- Import paths updated: N
- Validation: PASS
```
