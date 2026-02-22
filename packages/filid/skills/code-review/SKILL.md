---
name: code-review
user_invocable: true
description: Multi-persona consensus-based code review governance. Delegates analysis (Phase A) and verification (Phase B) to subagents, then executes political consensus (Phase C) directly as chairperson using a state machine with up to 5 deliberation rounds.
version: 1.0.0
complexity: complex
---

# code-review — AI Code Review Governance

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
4. Resume: No `session.md` → Phase A | `session.md` exists → Phase B |
   `verification.md` too → Phase C | All exist → "Review complete"

If `--force`: call `review-manage(cleanup)` first, then start Phase A.

### Step 2 — Phase A: Analysis & Committee Election (Delegated)

Delegate to Task subagent (`general-purpose`, model: `haiku`).
Subagent reads and executes `phases/phase-a-analysis.md`.

Resolve phase file path via `${CLAUDE_PLUGIN_ROOT}/skills/code-review/phases/`.
Fallback: `Glob(**/skills/code-review/phases/phase-a-analysis.md)`.

Provide context: branch name, normalized name, review dir, base ref, scope,
project root. Output: `.filid/review/<branch>/session.md`

### Step 3 — Phase B: Technical Verification (Delegated)

Delegate to Task subagent (`general-purpose`, model: `sonnet`).
Subagent reads and executes `phases/phase-b-verification.md`.

Resolve path via `${CLAUDE_PLUGIN_ROOT}/skills/code-review/phases/`.
Fallback: `Glob(**/skills/code-review/phases/phase-b-verification.md)`.

Provide context: review dir, project root.
Input: `session.md`. Output: `.filid/review/<branch>/verification.md`

### Step 4 — Phase C: Political Consensus (Direct Execution)

The chairperson executes Phase C directly:

1. **Load inputs**: Read `session.md` + `verification.md`
2. **Load personas**: Read only elected committee personas from `personas/*.md`
3. **Load state machine**: Read `state-machine.md` for transition rules
4. **Execute deliberation**: Run state machine (PROPOSAL → DEBATE → CONCLUSION)
5. **Load output format**: Read `reference.md` for report templates
6. **Write outputs**:
   - `.filid/review/<branch>/review-report.md` — full review report
   - `.filid/review/<branch>/fix-requests.md` — actionable fix items

### Step 5 — PR Comment (Optional)

When `--scope=pr`: check `gh auth status` (Bash), if authenticated post
`gh pr comment --body "<summary>"` (Bash), otherwise skip with info message.

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "review this PR" instead of `--scope=pr`).

```
/filid:code-review [--scope=branch|pr|commit] [--base=<ref>] [--force] [--verbose]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--scope` | `branch` | Review scope (branch, pr, commit) |
| `--base` | auto | Comparison base ref |
| `--force` | off | Delete existing review, restart from Phase A |
| `--verbose` | off | Show detailed deliberation process |

## Quick Reference

```
/filid:code-review                        # Full review on current branch
/filid:code-review --scope=pr             # Review + post PR comment
/filid:code-review --force                # Force restart from Phase A
/filid:code-review --base=main --verbose  # Verbose review against main

Phases:   A (Analysis/haiku) → B (Verification/sonnet) → C (Consensus/direct)
Outputs:  review-report.md, fix-requests.md
Resume:   Automatic via checkpoint detection
Personas: 2-6 elected based on complexity (LOW/MEDIUM/HIGH)
Rounds:   Max 5 deliberation rounds in state machine
Verdict:  APPROVED | REQUEST_CHANGES | INCONCLUSIVE
```
