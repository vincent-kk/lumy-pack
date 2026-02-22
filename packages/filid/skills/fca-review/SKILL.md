---
name: fca-review
user_invocable: true
description: Multi-persona consensus-based code review governance. Delegates analysis (Phase A) and verification (Phase B) to subagents, then executes political consensus (Phase C) directly as chairperson using a state machine with up to 5 deliberation rounds.
version: 1.0.0
complexity: complex
---

# fca-review — AI Code Review Governance

Execute the multi-persona consensus-based code review governance pipeline.
The chairperson delegates Phase A (analysis) and Phase B (verification) to
subagents, then directly conducts Phase C (political consensus) using elected
committee personas and a state machine.

> **References**: `state-machine.md` (deliberation rules), `reference.md`
> (output templates, MCP tool map), `personas/*.md` (loaded in Phase C only).

## When to Use

- Before merging PRs requiring multi-perspective governance review
- When changes span multiple fractals or modify interfaces
- To generate structured fix requests with severity ratings and code patches
- When technical debt may influence review strictness

## Core Workflow

### Step 1 — Branch Detection & Checkpoint Resume

1. Detect branch: `git branch --show-current` (Bash)
2. Normalize: `review-manage(normalize-branch)` MCP tool
3. Check checkpoint: `review-manage(checkpoint)` MCP tool
4. Resume logic:
   - No checkpoint files → Phase A (unless `--no-structure-check`, then Phase B)
   - `structure-check.md` only → Phase B
   - `session.md` only → Phase C
   - `session.md` + `verification.md` → Phase D
   - All complete (`review-report.md` exists) → "Review complete"

If `--force`: call `review-manage(cleanup)` first, then restart from Phase A.

### Step 2 — Phase A + B: Parallel Delegation

> Phase A and Phase B are independent and run **in parallel** as separate Task
> subagents. Phase A is skipped when `--no-structure-check` is set; in that
> case only Phase B runs.

**Phase A: Structure Pre-Check** (`general-purpose`, model: `sonnet`,
`run_in_background: true`)

Subagent reads and executes `phases/phase-a-structure.md`.
Resolve path via `${CLAUDE_PLUGIN_ROOT}/skills/fca-review/phases/`.
Fallback: `Glob(**/skills/fca-review/phases/phase-a-structure.md)`.
Provide context: review dir, project root, base ref, branch name.
Output: `.filid/review/<branch>/structure-check.md`

Phase A scans only **files changed in this diff** across 5 structural stages
and records PASS/FAIL per stage plus a `critical_count` of CRITICAL+HIGH findings.
These findings flow into Phase D (fix items).

**Phase B: Analysis & Committee Election** (`general-purpose`, model: `haiku`,
`run_in_background: true`)

Subagent reads and executes `phases/phase-b-analysis.md`.
Resolve path via `${CLAUDE_PLUGIN_ROOT}/skills/fca-review/phases/`.
Fallback: `Glob(**/skills/fca-review/phases/phase-b-analysis.md)`.
Provide context: branch name, normalized name, review dir, base ref, scope,
project root. Output: `.filid/review/<branch>/session.md`

**Await both** background agents before proceeding. If `--no-structure-check`,
only await Phase B.

### Step 3 — Phase C: Technical Verification (Delegated)

Delegate to Task subagent (`general-purpose`, model: `sonnet`).
Subagent reads and executes `phases/phase-c-verification.md`.

Resolve path via `${CLAUDE_PLUGIN_ROOT}/skills/fca-review/phases/`.
Fallback: `Glob(**/skills/fca-review/phases/phase-c-verification.md)`.

Provide context: review dir, project root.
Input: `session.md`. Output: `.filid/review/<branch>/verification.md`

### Step 4 — Phase D: Political Consensus (Direct Execution)

The chairperson executes Phase D directly:

1. **Load inputs**: Read `session.md` + `verification.md`
2. **Load structure context**: Read `structure-check.md` if present
3. **Load personas**: Read only elected committee personas from `personas/*.md`
4. **Load state machine**: Read `state-machine.md` for transition rules
5. **Execute deliberation**: Run state machine (PROPOSAL → DEBATE → CONCLUSION)
   - Structure violations from `structure-check.md` are tabled as agenda items
     alongside code quality issues from `verification.md`
6. **Load output format**: Read `reference.md` for report templates
7. **Write outputs**:
   - `.filid/review/<branch>/review-report.md` — full review report (includes
     Structure Compliance section from Phase A)
   - `.filid/review/<branch>/fix-requests.md` — actionable fix items (includes
     CRITICAL/HIGH structure violations as FIX-XXX items)

### Step 5 — PR Comment (Optional)

When `--scope=pr`: check `gh auth status` (Bash), if authenticated post
`gh pr comment --body "<summary>"` (Bash), otherwise skip with info message.

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "review this PR" instead of `--scope=pr`).

```
/filid:fca-review [--scope=branch|pr|commit] [--base=<ref>] [--force] [--verbose] [--no-structure-check]
```

| Option                  | Default  | Description                                        |
| ----------------------- | -------- | -------------------------------------------------- |
| `--scope`               | `branch` | Review scope (branch, pr, commit)                  |
| `--base`                | auto     | Comparison base ref                                |
| `--force`               | off      | Delete existing review, restart from Phase A       |
| `--verbose`             | off      | Show detailed deliberation process                 |
| `--no-structure-check`  | off      | Skip Phase A (faster; omits structure compliance)  |

## Quick Reference

```
/filid:fca-review                           # Full review (Phase A + B + C + D)
/filid:fca-review --scope=pr                # Review + post PR comment
/filid:fca-review --force                   # Force restart from Phase A
/filid:fca-review --no-structure-check      # Skip Phase A structure pre-check (faster)
/filid:fca-review --base=main --verbose     # Verbose review against main

Phases:   A (Structure/sonnet) ┐
          B (Analysis/haiku)  ┘→ C (Verification/sonnet) → D (Consensus/direct)
          [A + B run in parallel]
Outputs:  structure-check.md, review-report.md, fix-requests.md
Resume:   Automatic via checkpoint detection
Personas: 2-6 elected based on complexity (LOW/MEDIUM/HIGH) + structure violations
Rounds:   Max 5 deliberation rounds in state machine
Verdict:  APPROVED | REQUEST_CHANGES | INCONCLUSIVE
```
