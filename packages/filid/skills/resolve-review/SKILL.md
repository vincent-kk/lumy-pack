---
name: resolve-review
user_invocable: true
description: Interactive fix request resolution workflow. Parses fix-requests.md from a completed code review, presents items for accept/reject selection, collects developer justifications for rejected items, refines justifications into ADRs, and creates technical debt files for deferred fixes.
version: 1.0.0
complexity: medium
---

# resolve-review — Fix Request Resolution

Resolve fix requests from a completed code review. Present each item for
developer accept/reject, collect justifications for rejected items, refine
them into ADRs, and create technical debt records.

> **References**: `reference.md` (output templates, justification format).

## When to Use

- After `/filid:code-review` generates `fix-requests.md`
- To selectively accept or reject fix requests with formal justification
- To create tracked technical debt for deferred fixes

## Core Workflow

### Step 1 — Branch Detection & Review Directory Lookup

1. Detect branch: `git branch --show-current` (Bash)
2. Normalize: `review-manage(normalize-branch)` MCP tool
3. Verify: Read `.filid/review/<normalized>/fix-requests.md`
4. If not found: abort with "No fix requests found. Run /filid:code-review first."

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

For each accepted fix:
- Output the recommended code patch with file path
- Provide guidance: "Apply the patch above to <path>, then commit."

### Step 5 — Process Rejected Items

For each rejected fix:

1. **Collect justification**: Use `AskUserQuestion` with free text input
   to collect the developer's reason for rejection.

2. **Refine to ADR**: Transform the raw justification into a structured
   Architecture Decision Record:
   - Context: the original fix request and rule violated
   - Decision: defer the fix with stated rationale
   - Consequences: technical debt created, future impact

3. **Create debt file**: Call `debt-manage(create)` MCP tool:
   ```
   debt-manage(
     action: "create",
     projectRoot: <project_root>,
     debtItem: {
       fractalPath: <fractal path>,
       filePath: <file path>,
       reviewBranch: <branch>,
       originalFixId: <FIX-ID>,
       severity: <severity>,
       ruleViolated: <rule>,
       metricValue: <current value>,
       justification: <developer justification>,
       adr: <refined ADR text>
     }
   )
   ```

### Step 6 — Write justifications.md

Capture current commit SHA: `git rev-parse HEAD` (Bash)

Write `.filid/review/<branch>/justifications.md` with frontmatter
containing `resolve_commit_sha` (used by `/filid:re-validate` as
Delta baseline). See `reference.md` for the full output template.

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well.

```
/filid:resolve-review
```

No parameters. Current branch auto-detected.

## Quick Reference

```
/filid:resolve-review    # Resolve fix requests on current branch

Input:    .filid/review/<branch>/fix-requests.md
Outputs:  justifications.md, .filid/debt/*.md (per rejected item)
Prereq:   /filid:code-review must have completed
Next:     /filid:re-validate (after applying accepted fixes)

MCP tools: review-manage(normalize-branch), debt-manage(create)
```
