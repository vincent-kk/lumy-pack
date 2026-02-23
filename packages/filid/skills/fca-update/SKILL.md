---
name: fca-update
user_invocable: true
description: Analyze changes in the current branch to update CLAUDE.md/SPEC.md and organize test.ts/spec.ts following FCA-AI principles — skips execution when no changes detected since last run
version: 1.0.0
complexity: high
---

# fca-update — Code-Docs-Tests Synchronization

Analyze files changed in the current branch to:
1. Update CLAUDE.md / SPEC.md to match the implementation (create if missing)
2. Organize and update test.ts / spec.ts following FCA-AI principles

An incremental gate (Stage 0) skips execution when no changes have occurred since the last run.

> **Detail Reference**: See `reference.md` for MCP tool call signatures, output formats, and the severity mapping table.

## When to Use This Skill

- Immediately after writing or modifying code, to sync docs and tests
- Before merging a branch, to verify FCA-AI compliance
- When CLAUDE.md/SPEC.md are out of sync with the implementation
- When test.ts/spec.ts violate the FCA-AI 3+12 rule

## Core Workflow

### Stage 0 — Change Detection (Incremental Gate)

Without `--force`, exits immediately if no changes have occurred since the last run.

1. `cache_manage({ action: "compute-hash", cwd: "<path>" })` → `currentHash`
2. `cache_manage({ action: "get-hash", cwd: "<path>", skillName: "fca-update" })` → `lastHash`
3. `currentHash === lastHash` and no `--force` → output "No changes since last run. Use --force to override." and exit
4. Changes detected → proceed to Stage 1

See [reference.md Section 0](./reference.md#section-0--change-detection).

### Stage 1 — Scan (Branch Diff-Based)

Scan only files changed in this branch for FCA-AI rule violations.

Agent: `qa-reviewer` (haiku)
See [reference.md Section 1](./reference.md#section-1--scan).

### Stage 2 — Sync (Conditional Structure Correction)

Runs only when Stage 1 detects `critical` or `high` severity violations.

Agents: `drift-analyzer` (haiku) → `restructurer` (sonnet)
MCP: `drift_detect`, `lca_resolve`, `structure_validate`
See [reference.md Section 2](./reference.md#section-2--sync).

### Stage 3 — Doc & Test Update

Update CLAUDE.md/SPEC.md and organize test.ts/spec.ts based on changed files.

Agent: `context-manager` (sonnet) — document updates
Agent: `implementer` (sonnet) — test organization
See [reference.md Section 3](./reference.md#section-3--doc--test-update).

### Stage 4 — Finalize

1. `cache_manage({ action: "save-hash", cwd: "<path>", skillName: "fca-update", hash: currentHash })`
2. Output consolidated report
See [reference.md Section 4](./reference.md#section-4--finalize).

## Available MCP Tools

| Tool | Stage | Purpose |
|------|-------|---------|
| `cache_manage` | 0, 4 | Incremental gate: compute and persist project hash |
| `fractal_scan` | 1 | Project structure scan |
| `fractal_navigate` | 1 | Tree traversal and classification |
| `test_metrics` | 1, 3 | 3+12 rule validation |
| `drift_detect` | 2 | Drift detection |
| `lca_resolve` | 2 | Determine correct placement for reclassification |
| `structure_validate` | 2 | Structure validity check |
| `doc_compress` | 3 | Document size check |
| `ast_analyze` | 3 | LCOM4, CC metrics |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "just scan" instead of `--scan-only`).

```
/filid:fca-update [path] [--force] [--scan-only] [--no-sync] [--auto-approve]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | cwd | Target directory |
| `--force` | flag | off | Ignore cache, run full scan |
| `--scan-only` | flag | off | Run Stage 1 only (skip sync/update) |
| `--no-sync` | flag | off | Skip Stage 2 (scan + doc/test update only) |
| `--auto-approve` | flag | off | Skip user approval in sync stage |

## Quick Reference

```bash
# Default run (incremental)
/filid:fca-update

# Target a specific path
/filid:fca-update src/core

# Force full re-run ignoring cache
/filid:fca-update --force

# Scan only (no doc/test modifications)
/filid:fca-update --scan-only

# Doc/test update only (skip structure sync)
/filid:fca-update --no-sync

Stages:   Change Detection → Scan → Sync (conditional) → Doc & Test Update → Finalize
Agents:   qa-reviewer (Stage 1), drift-analyzer+restructurer (Stage 2), context-manager+implementer (Stage 3)
Cache:    ~/.claude/plugins/filid/{cwdHash}/run-fca-update.hash
```

Key rules:

- Without `--force`, exits immediately when no changes detected since last run
- Stage 2 (Sync) runs only when critical/high violations are present
- CLAUDE.md must stay within the 100-line limit
- test.ts/spec.ts must follow the 3+12 rule (max 15 test cases per file)
