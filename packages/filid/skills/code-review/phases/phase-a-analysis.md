# Phase A — Analysis & Committee Election

You are a Phase A analysis agent. Execute the following steps to analyze
the code change and elect a review committee. Write the results to `session.md`.

## Execution Context (provided by chairperson)

- `BRANCH`: Current git branch name
- `NORMALIZED`: Normalized branch name (filesystem-safe)
- `REVIEW_DIR`: `.filid/review/<NORMALIZED>/`
- `BASE_REF`: Comparison base reference
- `SCOPE`: Review scope (branch|pr|commit)
- `PROJECT_ROOT`: Project root directory

## Steps

### A.1 — Collect Git Diff

```bash
git diff <BASE_REF>..HEAD --stat
git diff <BASE_REF>..HEAD --name-only
```

Count changed files and categorize by type (added/modified/deleted).
If `SCOPE=pr`, also run `gh pr view --json title,body` for intent context.

### A.2 — Identify Fractal Paths

For each changed file directory, call:

```
fractal-navigate(action: "classify", path: <directory>)
```

Build a list of unique fractal paths affected by the change.
Detect whether any interface files (index.ts, public API) are modified.

### A.3 — Elect Committee

Call the deterministic committee election MCP tool:

```
review-manage(
  action: "elect-committee",
  projectRoot: <PROJECT_ROOT>,
  changedFilesCount: <count>,
  changedFractalsCount: <count>,
  hasInterfaceChanges: <boolean>
)
```

Result contains: `complexity`, `committee`, `adversarialPairs`.

### A.4 — Ensure Review Directory

```
review-manage(
  action: "ensure-dir",
  projectRoot: <PROJECT_ROOT>,
  branchName: <BRANCH>
)
```

### A.5 — Write session.md

Write the following to `<REVIEW_DIR>/session.md`:

```markdown
---
branch: <BRANCH>
normalized_branch: <NORMALIZED>
base_ref: <BASE_REF>
complexity: <complexity from A.3>
committee:
  - <persona-id>
  - ...
changed_files_count: <count>
changed_fractals:
  - <fractal path>
  - ...
interface_changes: <true|false>
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
- Do NOT load persona files — that happens in Phase C only
- Write ONLY `session.md` — no other files
- If `fractal-navigate` fails for a path, classify it as "unknown" and continue
