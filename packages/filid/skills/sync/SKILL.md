---
name: sync
user_invocable: true
description: Batch-sync code changes to CLAUDE.md/SPEC.md at PR time
version: 1.0.0
complexity: medium
---

# sync — Documentation Sync

Synchronize CLAUDE.md and SPEC.md with accumulated code changes collected
by PostToolUse hooks during development. Execute at PR time to batch-apply
all pending documentation updates in a single, validated pass.

> **Detail Reference**: For detailed workflow steps, MCP tool examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Before opening or merging a PR that includes code changes affecting module structure
- After multi-file refactors that altered exports, dependencies, or directory layout
- When CLAUDE.md or SPEC.md lag behind the current implementation
- When the ChangeQueue contains unprocessed records from development session hooks
- Before running `/filid:review` to ensure documents are up to date for compliance checks

## Core Workflow

### Phase 1 — Change Collection
Drain the ChangeQueue to retrieve all pending change records accumulated
by PostToolUse hooks since the last sync.
See [reference.md Section 1](./reference.md#section-1--change-collection-details).

### Phase 2 — Impact Analysis
Identify affected fractal modules and group changes by module path using
`fractal-navigate(action: "tree")` for boundary verification.
See [reference.md Section 2](./reference.md#section-2--impact-analysis-details).

### Phase 3 — CLAUDE.md Updates
Update structure and dependency sections; apply `doc-compress` when
approaching the 100-line limit.
See [reference.md Section 3](./reference.md#section-3--claudemd-update-rules).

### Phase 4 — SPEC.md Updates
Sync specifications with implementation changes. Restructure content
rather than appending.
See [reference.md Section 4](./reference.md#section-4--specmd-update-rules).

### Phase 5 — Validation
Validate all updated documents against FCA-AI compliance rules.
See [reference.md Section 5](./reference.md#section-5--validation-details).

### Phase 6 — Report
Emit a structured summary of all updates and validation outcomes.
See [reference.md Section 6](./reference.md#section-6--report-and-dry-run-formats).

## Available MCP Tools

| Tool | Action / Parameters | Purpose |
|------|---------------------|---------|
| `doc-compress` | `mode: "auto"` | Compress CLAUDE.md approaching the 100-line limit |
| `fractal-navigate` | `action: "tree"` | Display fractal module tree for boundary verification |

## Options

```
/filid:sync [--dry-run]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dry-run` | flag | off | Preview all planned changes without writing files |

## Quick Reference

```
/filid:sync                 # Sync all accumulated changes (full pipeline)
/filid:sync --dry-run       # Preview changes without writing

Phases:  Collect → Impact → CLAUDE.md → SPEC.md → Validate → Report
Agents:  context-manager (lead), architect (assist)
Limit:   CLAUDE.md ≤ 100 lines (use doc-compress at ≥ 90)
Queue:   ChangeQueue drained by PostToolUse hooks during development
Rule:    Restructure docs — never append-only
```
