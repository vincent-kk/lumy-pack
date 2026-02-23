---
name: fca-revalidate
user_invocable: true
description: Delta-based lightweight re-validation after fix resolution. Extracts changes since resolve_commit_sha, verifies accepted fixes resolved their issues, checks justifications for constitutional compliance, resolves cleared debt, and renders final PASS/FAIL verdict with optional PR comment. On PASS, automatically cleans up the review session directory (.filid/review/<branch>/); debt files are preserved.
version: 1.0.0
complexity: medium
---

# fca-revalidate — Delta Re-validation

Perform lightweight re-validation after fix resolution. Extract the Delta
since `resolve_commit_sha`, verify fixes resolved their issues, and render
a final PASS/FAIL verdict. Optionally post the result as a PR comment.

> **References**: `reference.md` (output templates, PR comment format).

## When to Use

- After `/filid:fca-resolve` and applying accepted fixes
- To verify that code changes address the original fix requests
- To get final PASS/FAIL verdict before PR merge

## Core Workflow

### Step 1 — Branch Detection & File Loading

1. Detect branch: `git branch --show-current` (Bash)
2. Normalize: `review_manage(action: "normalize-branch", projectRoot: <project_root>, branchName: <branch>)` MCP tool
3. Load review files from `.filid/review/<normalized>/`:
   - `review-report.md` — original review findings
   - `fix-requests.md` — original fix requests
   - `justifications.md` — resolution decisions + `resolve_commit_sha`
4. If any file missing: abort with guidance message.

### Step 2 — Extract Delta

Extract `resolve_commit_sha` from `justifications.md` frontmatter.

```bash
git diff <resolve_commit_sha>..HEAD --name-only
git diff <resolve_commit_sha>..HEAD --stat
```

For semantic analysis on changed files:

```
ast_analyze(source: <new>, oldSource: <old>, analysisType: "tree-diff")
```

### Steps 3–5 (Parallel — after Step 2)

Steps 3, 4, and 5 are **independent** and run **in parallel** as separate Task
subagents (`run_in_background: true`). Await all three before Step 6.

### Step 3 — Verify Accepted Fixes

For each accepted fix item from `justifications.md`:

1. Check if the target file was modified in the Delta
2. Re-run the relevant MCP tool to confirm the rule is now satisfied:
   - LCOM4 violation → `ast_analyze(lcom4)` — verify LCOM4 < 2
   - CC violation → `ast_analyze(cyclomatic-complexity)` — verify CC <= 15
   - 3+12 violation → `test_metrics(check-312)` — verify PASS
   - Structure violation → `structure_validate` — verify PASS
3. Mark each fix as RESOLVED or UNRESOLVED

### Step 4 — Verify Justifications (Constitutional Check)

For each rejected fix with justification:

1. Confirm the justification does not violate non-negotiable rules:
   - Hardcoded secrets — always FAIL regardless of justification
   - Circular dependencies — always FAIL regardless of justification
2. Verify debt file was created via `debt_manage(list)`
3. Mark as DEFERRED (valid) or UNCONSTITUTIONAL (invalid justification)

### Step 5 — Resolve Cleared Debt

Check if any Delta changes also resolve existing debt items:

```
debt_manage(action: "list", projectRoot: <project_root>)
```

For each debt item whose `file_path` is in the Delta:

1. Re-run the relevant MCP tool to check if the rule is now satisfied
2. If satisfied: `debt_manage(action: "resolve", projectRoot: <root>, debtId: <id>)`

### Step 6 — Render Verdict (Sequential — after Steps 3–5)

**PASS conditions** (all must be true):

- All accepted fixes are RESOLVED
- All justifications are constitutionally valid (DEFERRED, not UNCONSTITUTIONAL)
- No new critical violations introduced in the Delta

**FAIL conditions** (any triggers FAIL):

- One or more accepted fixes remain UNRESOLVED
- A justification is UNCONSTITUTIONAL (non-negotiable rule violated)
- New critical violations found in Delta changes

Write `.filid/review/<branch>/re-validate.md` with the verdict.
See `reference.md` for the output template.

### Step 7 — PR Comment (Optional)

Post verdict to PR if GitHub CLI is available:

1. Check: `gh auth status` (Bash)
2. If authenticated: `gh pr comment --body "<verdict summary>"` (Bash)
3. If not authenticated: skip with info message

### Step 8 — Cleanup on PASS

After Step 7, if the verdict is **PASS**:

```
review_manage(action: "cleanup", projectRoot: <project_root>, branchName: <branch>)
```

This deletes the entire `.filid/review/<branch>/` directory (session artifacts,
review report, fix requests, justifications, re-validate report).

**Debt files are NOT affected** — they live in `.filid/debt/` and are managed
separately by `debt_manage`.

If the verdict is **FAIL**, skip cleanup so the developer can inspect the
remaining unresolved items.

## Available MCP Tools

| Tool                 | Action             | Purpose                                                         |
| -------------------- | ------------------ | --------------------------------------------------------------- |
| `review_manage`      | `normalize-branch` | Normalize branch name for review directory path                 |
| `review_manage`      | `cleanup`          | Delete review session directory on PASS                         |
| `ast_analyze`        | `tree-diff`        | Semantic diff of changed files since resolve_commit_sha         |
| `ast_analyze`        | `lcom4`            | Verify LCOM4 < 2 after accepted fix                             |
| `ast_analyze`        | `cyclomatic-complexity` | Verify CC <= 15 after accepted fix                         |
| `test_metrics`       | `check-312`        | Verify 3+12 rule PASS after accepted fix                        |
| `structure_validate` | —                  | Verify structure violation resolved after accepted fix          |
| `debt_manage`        | `list`             | Retrieve existing debt items to check for resolution            |
| `debt_manage`        | `resolve`          | Mark a debt item as resolved when its rule is now satisfied     |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well.

```
/filid:fca-revalidate
```

No parameters. Current branch auto-detected.

## Quick Reference

```
/filid:fca-revalidate    # Re-validate on current branch

Input:    justifications.md (resolve_commit_sha), fix-requests.md, review-report.md
Output:   re-validate.md, PR comment (optional)
Prereq:   /filid:fca-resolve must have completed + fixes applied
Verdict:  PASS | FAIL

Steps:    1 (Load) → 2 (Delta) → [3 + 4 + 5 in parallel] → 6 (Verdict) → 7 (PR) → 8 (Cleanup on PASS)
MCP tools: review_manage(normalize-branch, cleanup), ast_analyze(tree-diff, lcom4, cc),
           test_metrics(check-312), structure_validate, debt_manage(list, resolve)
Cleanup:  PASS → .filid/review/<branch>/ deleted | FAIL → kept for inspection
```
