# re-validate — Reference Documentation

Output format templates, PR comment format, and detailed verification
reference for the Delta re-validation skill.

## re-validate.md Format

```markdown
# Re-validation Result — <branch name>

**Date**: <ISO 8601>
**Verdict**: PASS | FAIL
**Delta Base**: <resolve_commit_sha>
**Delta Commits**: <commit count since resolve>

## Delta Analysis

| File | Change Type | Related Fix |
|------|-------------|-------------|
| <path> | added/modified/deleted | FIX-<ID> |

## Fix Verification

| Fix ID | Status | Detail |
|--------|--------|--------|
| FIX-001 | RESOLVED | <metric before → after> |
| FIX-002 | DEFERRED | Justification accepted, debt created |
| FIX-003 | UNRESOLVED | <what remains unfixed> |
| FIX-004 | UNCONSTITUTIONAL | <non-negotiable rule violated> |

## Debt Changes

| Change | Debt File | Detail |
|--------|-----------|--------|
| CREATED | <debt-id>.md | <from resolve-review> |
| RESOLVED | <debt-id>.md | <rule now satisfied> |

## New Violations Check

| Check | Result | Detail |
|-------|--------|--------|
| New critical violations | NONE / FOUND | <if found, list them> |

## Final Verdict

**<PASS|FAIL>** — <summary statement>

<If PASS>:
All fixes resolved or validly deferred. PR is ready for merge.
Clean up `.filid/review/<branch>/` after merge.

<If FAIL>:
Unresolved items remain. Address the following before re-running:
- <list unresolved items>
```

## PR Comment Format

### PASS Verdict

```markdown
## Re-validation — PASS

**Branch**: <branch>
**Delta**: <N> commits since resolution

| Fix | Status |
|-----|--------|
| FIX-001 | RESOLVED |
| FIX-002 | DEFERRED (debt tracked) |

All fixes resolved or validly deferred. Ready for merge.

> Full report: `.filid/review/<branch>/re-validate.md`
```

### FAIL Verdict

```markdown
## Re-validation — FAIL

**Branch**: <branch>
**Delta**: <N> commits since resolution

| Fix | Status |
|-----|--------|
| FIX-001 | RESOLVED |
| FIX-003 | UNRESOLVED |

Action required: address unresolved items before merge.

> Full report: `.filid/review/<branch>/re-validate.md`
```

## Verification MCP Tool Map

| Fix Type | Verification Tool | Pass Condition |
|----------|------------------|----------------|
| LCOM4 violation | `ast-analyze(lcom4)` | LCOM4 < 2 |
| CC violation | `ast-analyze(cyclomatic-complexity)` | CC <= 15 |
| 3+12 violation | `test-metrics(check-312)` | All files PASS |
| Structure violation | `structure-validate` | No violations |
| Circular dependency | `ast-analyze(dependency-graph)` | No cycles |
| Drift | `drift-detect` | No drift |
| Document compliance | `doc-compress(auto)` + Read | CLAUDE.md <= 100 lines |

## Non-Negotiable Rules (Constitutional)

These rules cannot be deferred via justification. Any justification
attempting to defer these is marked UNCONSTITUTIONAL:

1. **Hardcoded secrets/credentials** — always FAIL
2. **Circular dependencies** — always FAIL
3. **Security vulnerabilities** (injection, auth bypass) — always FAIL

## Debt Resolution Criteria

A debt item is considered resolved when:

1. The file at `debt.file_path` was modified in the Delta
2. The violated rule is re-verified and now passes
3. Both conditions must be true for `debt-manage(resolve)` to execute

Partial resolution is not supported (1 debt = 1 rule violation).
