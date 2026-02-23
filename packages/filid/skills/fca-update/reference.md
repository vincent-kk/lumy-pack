# fca-update — Reference Documentation

Detailed workflow, MCP tool call signatures, and output format templates for the
code-docs-tests synchronization skill. For the quick-start overview, see [SKILL.md](./SKILL.md).

## Section 0 — Change Detection

Stage 0 MCP calls:

```
cache_manage({ action: "compute-hash", cwd: "<target-path>" })
// Returns: { hash: string, cwd: string }

cache_manage({ action: "get-hash", cwd: "<target-path>", skillName: "fca-update" })
// Returns: { hash: string | null, skillName: string, found: boolean }
```

Decision logic:
- `found === false` → first run ever, proceed to Stage 1
- `found === true` and `hash === currentHash` and no `--force` → output "No changes since last run. Use --force to override." and exit
- `found === true` and `hash !== currentHash` → changes detected, proceed to Stage 1

## Section 1 — Scan

Collect branch diff:
```bash
git branch --show-current          # current branch name
git diff --name-only main...HEAD   # list of changed files (default base: main)
```

Restrict scan to changed files only:

```
fractal_scan({ path: "<target-path>" })
// Returns: { nodes: FractalNode[], summary: ScanSummary }

test_metrics({ action: "check-312", files: [{ filePath, content }] })
// Returns: { violations: TestViolation[], summary: { total, passing, failing } }
```

Scan result categories:
- CLAUDE.md exceeds 100-line limit
- CLAUDE.md present inside an organ directory
- test/spec files violating 3+12 rule (> 15 test cases)
- Unclassified directories

## Section 2 — Sync

**Execution condition**: runs only when Stage 1 detects `critical` or `high` severity violations.

```
drift_detect({ path: "<target-path>", severity: "high" })
// Returns: { items: DriftItem[], bySeverity: { critical, high, medium, low } }
```

### Severity Normalization Table

`fca-scan` and `fca-sync` use different severity vocabularies. This table maps
scan violations to Stage 2 gate conditions:

| fca-scan Violation Type | Stage 2 Gate |
|-------------------------|--------------|
| CLAUDE.md exceeds 100 lines | high — triggers Stage 2 |
| CLAUDE.md present in organ directory | critical — triggers Stage 2 |
| 3+12 rule violation (test count > 15) | high — triggers Stage 2 |
| Unclassified directory | medium — does NOT trigger Stage 2 |
| SPEC.md append-only growth | medium — does NOT trigger Stage 2 |

fca-sync DriftSeverity ordering: `critical > high > medium > low`
- Stage 2 gate: execute when `critical` or `high` is present
- `medium` and `low` are reported but not auto-corrected

Correction calls:
```
lca_resolve({ path: "<target-path>", moduleA: "...", moduleB: "..." })
// Returns: { lcaPath: string, suggestedPlacement: string }

structure_validate({ path: "<target-path>" })
// Returns: { passed: boolean, violations: Violation[] }
```

## Section 3 — Doc & Test Update

### Document Update (CLAUDE.md / SPEC.md)

For each fractal node containing changed files:

1. **Check CLAUDE.md**: existence and 100-line limit
2. **Create CLAUDE.md if missing**: include 3-tier boundary sections
   ```markdown
   # <module-name> — <one-line description>
   ## Purpose
   ## Structure
   | File | Role |
   ## Conventions
   ## Boundaries
   ### Always do
   ### Ask first
   ### Never do
   ## Dependencies
   ```
3. **Update CLAUDE.md if present**: reflect implemented changes; compress if > 100 lines

```
doc_compress({ mode: "auto", filePath: "<path>", content: "<content>", exports: [...] })
// Suggests compression when content exceeds 100 lines
```

4. **Check and update SPEC.md**: refresh implementation contracts (API signatures, type definitions)

### Test Organization (test.ts / spec.ts)

For each changed source file:

1. **Check test.ts/spec.ts**: existence and 3+12 rule compliance (max 15 cases)
2. **Create if missing**: scaffold 3 basic tests + 12 extended test slots

```
ast_analyze({ source: "<source>", analysisType: "full" })
// Checks LCOM4, CC metrics → recommends module split or compression

test_metrics({ action: "check-312", files: [...] })
// Validates 3+12 rule compliance
```

3. **Update if present**: add/modify tests to match new functions and changed behaviour

## Section 4 — Finalize

Save run hash:
```
cache_manage({ action: "save-hash", cwd: "<path>", skillName: "fca-update", hash: "<currentHash>" })
// Returns: { saved: true, skillName: "fca-update", hash: "..." }
```

### Consolidated Report Format

```
## fca-update Report — <path>

**Date**: <ISO 8601>
**Mode**: incremental | full (--force)
**Project Hash**: <hash>

### Stage 0 — Change Detection
Status: CHANGED | NO_CHANGE | FIRST_RUN
Previous hash: <hash> | (none)
Current hash: <hash>
Changed files: <n>

### Stage 1 — Scan
Violations: <n> (critical: <n>, high: <n>, medium: <n>, low: <n>)
Files scanned: <n>

### Stage 2 — Sync
Status: SKIPPED (no critical/high violations) | APPLIED (<n> corrections) | SKIPPED (--no-sync)
Corrections: <n> applied

### Stage 3 — Doc & Test Update
CLAUDE.md updated: <n> files
SPEC.md updated: <n> files
test.ts/spec.ts updated: <n> files
Created: <n> new files

### Summary
Overall: PASS | NEEDS_ATTENTION | FAIL
Run hash saved: <hash>
Next run will be incremental unless --force is used.
```
