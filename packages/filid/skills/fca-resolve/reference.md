# resolve-review — Reference Documentation

Output format templates and detailed workflow reference for the
fix request resolution skill.

## justifications.md Format

```markdown
---
resolve_commit_sha: <git rev-parse HEAD result>
resolved_at: <ISO 8601>
branch: <branch name>
total_fixes: <total fix count>
accepted: <accepted count>
rejected: <rejected count>
---

# Justifications — <branch name>

**Date**: <ISO 8601>
**Accepted Fixes**: N / M
**Rejected Fixes**: K

---

## JUST-001: FIX-<ID> Rejection

- **Original Fix**: <fix title and description>
- **Severity**: <severity>
- **Path**: `<file path>`
- **Rule Violated**: <rule>
- **Developer Decision**: REJECTED
- **Developer's Justification**: "<raw justification text>"
- **Refined ADR**: "<structured ADR text>"
- **Debt Created**: `.filid/debt/<debt-file-name>.md`

---
```

## ADR Refinement Guidelines

Transform raw developer justification into structured ADR format:

```
ADR-<date>: <concise decision title>
Context: <original fix request + rule violated + current metric value>
Decision: <what was decided and why>
Consequences: <technical debt created, future impact, estimated resolution>
```

**Refinement rules**:

1. Preserve the developer's core reasoning — do not alter intent
2. Add structural context (rule, metric, fractal path)
3. Include estimated resolution timeframe if mentioned
4. Reference the created debt file ID

## Accepted Fix Output Format

Accepted fixes are applied directly to source files via parallel `code-surgeon`
subagents. After all subagents complete, report results:

```markdown
### FIX-<ID>: <title> — APPLIED

**Path**: `<file path>`
**Change**: <brief description of what was changed>
**Status**: Modified ✓
```

## AskUserQuestion Patterns

### Fix Item Selection

Present each fix with severity context:

```
Question: "FIX-001: spec.ts 3+12 rule violation (HIGH)"
Options:
  - Accept: "Apply the recommended split"
  - Reject: "Defer with justification"
```

### Justification Collection

For rejected items, collect free text:

```
Question: "Why are you rejecting FIX-001? Provide your justification."
Options:
  - (free text input via "Other" option)
```

## MCP Tool Usage

| Tool            | Action             | When                               |
| --------------- | ------------------ | ---------------------------------- |
| `review-manage` | `normalize-branch` | Step 1: branch detection           |
| `debt-manage`   | `create`           | Step 5: for each rejected fix item |

## debt-manage(create) Input Schema

```json
{
  "action": "create",
  "projectRoot": "<project root>",
  "debtItem": {
    "fractalPath": "src/features/auth",
    "filePath": "src/features/auth/validator.ts",
    "reviewBranch": "feature/issue-6",
    "originalFixId": "FIX-002",
    "severity": "HIGH",
    "ruleViolated": "LCOM4 >= 2",
    "metricValue": "LCOM4=3",
    "justification": "Sprint deadline in 2 days...",
    "adr": "ADR-2026-02-22: validator.ts module split deferred..."
  }
}
```
