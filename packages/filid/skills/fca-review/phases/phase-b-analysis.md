# Phase B — Analysis & Committee Election

You are a Phase B analysis agent. Execute the following steps to analyze
the code change and elect a review committee. Write the results to `session.md`.

## Execution Context (provided by chairperson)

- `BRANCH`: Current git branch name
- `NORMALIZED`: Normalized branch name (filesystem-safe)
- `REVIEW_DIR`: `.filid/review/<NORMALIZED>/`
- `BASE_REF`: Comparison base reference
- `SCOPE`: Review scope (branch|pr|commit)
- `PROJECT_ROOT`: Project root directory

## Steps

### B.0 — Load Structure Pre-Check Results (if present)

Read `<REVIEW_DIR>/structure-check.md` if it exists.

Extract from its frontmatter:
- `critical_count`: total CRITICAL + HIGH structure findings
- `stage_results`: per-stage PASS/FAIL map
- `overall`: overall PASS/FAIL

Store as `STRUCTURE_CRITICAL_COUNT` for use in A.3 and A.5.
If `structure-check.md` does not exist, set `STRUCTURE_CRITICAL_COUNT = 0`.

### B.1 — Collect Git Diff

```bash
git diff <BASE_REF>..HEAD --stat
git diff <BASE_REF>..HEAD --name-only
```

Count changed files and categorize by type (added/modified/deleted).
If `SCOPE=pr`, also run `gh pr view --json title,body` for intent context.

### B.2 — Identify Fractal Paths

For each changed file directory, call:

```
fractal_navigate(action: "classify", path: <directory>, entries: [/* nodes from fractal_scan */])
```

Build a list of unique fractal paths affected by the change.
Detect whether any interface files (index.ts, public API) are modified.

### B.3 — Elect Committee

Call the deterministic committee election MCP tool:

```
review_manage(
  action: "elect-committee",
  projectRoot: <PROJECT_ROOT>,
  changedFilesCount: <count>,
  changedFractalsCount: <count>,
  hasInterfaceChanges: <boolean>
)
```

Result contains: `complexity`, `committee`, `adversarialPairs`.

**Structure-bias adjustment**: If `STRUCTURE_CRITICAL_COUNT >= 3`, escalate
`complexity` by one level (LOW → MEDIUM, MEDIUM → HIGH). This ensures that
severe structural violations trigger a more rigorous committee composition
even when the diff is small.

### B.4 — Ensure Review Directory

```
review_manage(
  action: "ensure-dir",
  projectRoot: <PROJECT_ROOT>,
  branchName: <BRANCH>
)
```

### B.5 — Write session.md

Write the following to `<REVIEW_DIR>/session.md`:

```markdown
---
branch: <BRANCH>
normalized_branch: <NORMALIZED>
base_ref: <BASE_REF>
complexity: <complexity from A.3 after structure-bias adjustment>
committee:
  - <persona-id>
  - ...
changed_files_count: <count>
changed_fractals:
  - <fractal path>
  - ...
interface_changes: <true|false>
structure_critical_count: <STRUCTURE_CRITICAL_COUNT>
structure_overall: <PASS|FAIL|N/A>
created_at: <ISO 8601>
---

## Changed Files Summary

| File   | Change Type            | Fractal   | Lines Changed |
| ------ | ---------------------- | --------- | ------------- |
| <path> | added/modified/deleted | <fractal> | +N -M         |

## Complexity Assessment

Changed files: N, Fractals: M, Interface changes: <yes/no> → <complexity>

## Committee Election Basis

<complexity> complexity → mandatory members: <list>
Adversarial pairs: <persona A> ↔ <persona B list>
```

## Important Notes

- Use MCP tools for deterministic operations (committee election, branch normalization)
- Do NOT load persona files — that happens in Phase D only
- Write ONLY `session.md` — no other files
- If `fractal_navigate` fails for a path, classify it as "unknown" and continue
