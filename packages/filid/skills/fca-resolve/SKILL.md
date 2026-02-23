---
name: fca-resolve
user_invocable: true
description: Interactive fix request resolution workflow. Parses fix-requests.md from a completed code review, presents items for accept/reject selection, collects developer justifications for rejected items, refines justifications into ADRs, and creates technical debt files for deferred fixes.
version: 1.0.0
complexity: medium
---

# fca-resolve — Fix Request Resolution

Resolve fix requests from a completed code review. Present each item for
developer accept/reject, collect justifications for rejected items, refine
them into ADRs, and create technical debt records.

> **References**: `reference.md` (output templates, justification format).

## When to Use

- After `/filid:fca-review` generates `fix-requests.md`
- To selectively accept or reject fix requests with formal justification
- To create tracked technical debt for deferred fixes

## Core Workflow

### Step 1 — Branch Detection & Review Directory Lookup

1. Detect branch: `git branch --show-current` (Bash)
2. Normalize: `review_manage(action: "normalize-branch", projectRoot: <project_root>, branchName: <branch>)` MCP tool
3. Verify: Read `.filid/review/<normalized>/fix-requests.md`
4. If not found: abort with "No fix requests found. Run /filid:fca-review first."

### Step 2 — Parse Fix Requests

Parse `fix-requests.md` to extract fix items. Each item has:

- Fix ID (e.g., `FIX-001`)
- Title, severity, file path, rule violated
- Recommended action and code patch

### Step 3 — Present Select List

Use `AskUserQuestion` to present each fix item for decision:

```
For each fix item:
  AskUserQuestion(
    question: "FIX-001: <title> (Severity: <severity>)\nPath: <path>\nAction: <recommended action>",
    options: [
      { label: "Accept", description: "Apply recommended fix" },
      { label: "Reject", description: "Reject and provide justification" }
    ]
  )
```

### Step 4 — Process Accepted Items

Delegate all accepted fixes **in parallel** as separate Task subagents
(`filid:code-surgeon`, model: `sonnet`, `run_in_background: true`).

For each accepted fix, spawn one subagent with:
- The target file path
- The recommended action and code patch from `fix-requests.md`
- Instruction to apply the fix directly to the file

Await all subagents before proceeding to Step 5.

### Step 5 — Process Rejected Items

For each rejected fix:

1. **Collect justification**: Use `AskUserQuestion` with free text input
   to collect the developer's reason for rejection.

2. **Refine to ADR**: Transform the raw justification into a structured
   Architecture Decision Record:
   - Context: the original fix request and rule violated
   - Decision: defer the fix with stated rationale
   - Consequences: technical debt created, future impact

3. **Create debt file**: Call `debt_manage(create)` MCP tool:
   ```
   debt_manage(
     action: "create",
     projectRoot: <project_root>,
     debtItem: {
       fractal_path: <fractal path>,
       file_path: <file path>,
       created_at: <ISO date string>,
       review_branch: <branch>,
       original_fix_id: <FIX-ID>,
       severity: <"LOW"|"MEDIUM"|"HIGH"|"CRITICAL">,
       rule_violated: <rule>,
       metric_value: <current value>,
       title: <short title>,
       original_request: <original fix request text>,
       developer_justification: <developer justification>,
       refined_adr: <refined ADR text>
     }
   )
   ```

### Step 6 — Write justifications.md

Capture current commit SHA: `git rev-parse HEAD` (Bash)

Write `.filid/review/<branch>/justifications.md` with frontmatter
containing `resolve_commit_sha` (used by `/filid:fca-revalidate` as
Delta baseline). See `reference.md` for the full output template.

### Step 7 — Offer to Run fca-revalidate

After writing justifications.md, prompt the developer:

```
If there were accepted fixes (already applied to files by Step 4):
  AskUserQuestion(
    question: "Fixes have been applied to the files above. Commit the changes,
               then run /filid:fca-revalidate for the final PASS/FAIL verdict.
               \n\nReady to run fca-revalidate now?",
    options: [
      { label: "Run now",   description: "Invoke /filid:fca-revalidate immediately" },
      { label: "Not yet",   description: "Commit the changes first, then run manually" }
    ]
  )
  → On "Run now": invoke /filid:fca-revalidate
  → On "Not yet": remind the developer with the command to run

If there were NO accepted fixes (all rejected):
  Automatically invoke /filid:fca-revalidate — no pending code changes needed.
```

## Available MCP Tools

| Tool             | Action             | Purpose                                                  |
| ---------------- | ------------------ | -------------------------------------------------------- |
| `review_manage`  | `normalize-branch` | Normalize branch name for review directory path          |
| `debt_manage`    | `create`           | Create a technical debt record for each rejected fix     |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well.

```
/filid:fca-resolve
```

No parameters. Current branch auto-detected.

## Quick Reference

```
/filid:fca-resolve    # Resolve fix requests on current branch

Input:    .filid/review/<branch>/fix-requests.md
Outputs:  justifications.md, .filid/debt/*.md (per rejected item)
Prereq:   /filid:fca-review must have completed
Next:     /filid:fca-revalidate (after applying accepted fixes)

MCP tools: review_manage(normalize-branch), debt_manage(create)
```
