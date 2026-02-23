# sync — Reference Documentation

Detailed workflow, MCP tool call signatures, and output format templates for the
structural drift synchronization skill. For the quick-start overview, see [SKILL.md](./SKILL.md).

## Section 1 — Scan

`drift-analyzer` calls `fractal_scan` to retrieve the full directory tree and current
node classifications.

```
fractal_scan({ path: "<target-path>" })
// Returns: ScanReport { tree: { nodes: Map<path, FractalNode>, root: string }, modules: ModuleInfo[], timestamp, duration }
```

For each node, confirm:

- `category`: current classification (fractal / organ / pure-function / hybrid)
- `hasIndex`: index.ts barrel export present
- `hasMain`: main.ts entry point present
- `children`: child node paths

## Section 2 — Detect & Classify

`drift_detect` identifies all deviations from fractal principles.

```
drift_detect({ path: "<target-path>", severity: "<level>" })
// Returns: { drifts: DriftItem[], total: number, bySeverity: SeverityCount }
```

When `--severity` is provided, only items at or above that level are returned.

Each `DriftItem` fields:

- `path`: node path where drift was detected
- `driftType`: `category-mismatch` | `missing-index` | `missing-main` | `naming-violation` | `orphaned-node`
- `severity`: `critical` | `high` | `medium` | `low`
- `expected`: expected state
- `actual`: current state
- `suggestedAction`: recommended `SyncAction`

`DriftSeverity` criteria:

- `critical`: breaks module resolution or causes import errors
- `high`: missing required files (index.ts, main.ts) or wrong category assignment
- `medium`: naming convention violations or incomplete barrel exports
- `low`: style/convention drift with no functional impact

## Section 3 — Plan & Approval

`drift-analyzer` generates the correction plan. For reclassification candidates,
`fractal-architect` uses `lca_resolve` to confirm the correct target location.

```
lca_resolve({ path: "<drifted-path>", moduleA: "<neighbor1>", moduleB: "<neighbor2>" })
// Returns: { lcaPath: string, recommendedParent: string, confidence: number }
```

Correction plan format:

```yaml
sync-plan:
  target: src/
  generated: '2026-02-22T00:00:00Z'
  severity-filter: high
  items:
    - drift-id: D001
      severity: critical
      path: src/shared/state
      action: reclassify
      from: organ
      to: fractal
      lca: src/features
    - drift-id: D002
      severity: high
      path: src/features/auth
      action: create-index
      target: src/features/auth/index.ts
```

`--dry-run` mode output:

```
[DRY RUN] Drift detected — severity: high and above
  critical (2 items):
    D001 RECLASSIFY src/shared/state: organ → fractal
    D002 RENAME     src/utils/UserHelper.ts → src/utils/user-helper.ts
  high (3 items):
    D003 CREATE-INDEX src/features/auth/index.ts
    D004 CREATE-MAIN  src/features/user/main.ts
    D005 MOVE         src/components/AuthWidget → src/features/auth/components/AuthWidget
No changes applied. Remove --dry-run to execute.
```

Without `--auto-approve`, request explicit user confirmation:

```
Apply the above correction plan?
Drift items: N  |  Affected files: N
[y/N]
```

## Section 4 — Correction Execution

`restructurer` applies each action from the approved sync-plan in this order:
`reclassify` → `move` → `rename` → `create-index` → `create-main`

After each move or rename, import paths are updated immediately:

```
for each drift-item with move/rename action:
  oldPath = drift-item.path
  newPath = drift-item.target
  affectedFiles = grep(oldPath, all_source_files)
  for file in affectedFiles:
    edit(file, replace(oldPath, newPath))
```

After execution, `structure_validate` confirms correctness:

```
structure_validate({ path: "<target-path>" })
// Returns: { passed: boolean, checks: ValidationCheck[], violations: Violation[] }
```

### Final Report Format

```
## Sync Complete — <target path>

### Drift Detected
| Severity | Detected | Corrected | Skipped |
|----------|----------|-----------|---------|
| critical | 2 | 2 | 0 |
| high | 3 | 3 | 0 |
| medium | 5 | 0 | 5 (severity filter) |
| low | 7 | 0 | 7 (severity filter) |

### Corrections Applied
| Drift ID | Path | Action | Status |
|----------|------|--------|--------|
| D001 | src/shared/state | reclassify: organ → fractal | ✓ |
| D002 | src/utils/UserHelper.ts | rename → user-helper.ts | ✓ |
| D003 | src/features/auth/index.ts | create-index | ✓ |
| D004 | src/features/user/main.ts | create-main | ✓ |
| D005 | src/components/AuthWidget | move → src/features/auth/... | ✓ |

### Validation Result
structure_validate: PASS
- All imports resolvable: ✓
- All fractal nodes have index.ts: ✓
- Organ directory rules satisfied: ✓

### Summary
- Corrections applied: 5
- Skipped (severity filter): 12
- Validation: PASS
```
