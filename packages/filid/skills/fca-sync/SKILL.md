---
name: fca-sync
user_invocable: true
description: Detect structural drift and correct deviations from fractal principles — supports severity filtering, dry-run, and auto-approve
version: 1.0.0
complexity: high
---

# fca-sync — Structural Drift Synchronization

Detect deviations between the current project structure and fractal principles,
then apply targeted corrections. `drift-analyzer` scans and classifies drift items,
`fractal-architect` reviews the correction plan, and `restructurer` executes the
approved corrections.

> **Detail Reference**: For detailed workflow steps, MCP tool call examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Correcting minor structural drift after a development session
- Automatically detecting and fixing drift in a CI pipeline
- Selectively correcting only `critical` or `high` severity drift items
- Applying small corrections without the full scope of `/filid:fca-restructure`
- Inspecting drift status without making changes (`--dry-run`)

### Integration with fca-update

When invoked via `/filid:fca-update`, this skill runs as Stage 2 only when `critical` or `high`
severity violations are detected in Stage 1. Standalone execution (`/filid:fca-sync`) always
operates independently.

## Core Workflow

### Stage 1 — Scan

`drift-analyzer` scans the full project using `fractal-scan` to establish the
current structural state.
See [reference.md Section 1](./reference.md#section-1--scan).

### Stage 2 — Detect & Classify

`drift-detect` identifies all drift items and classifies them by severity:
`critical`, `high`, `medium`, `low`. The `--severity` option restricts which
items are included in the correction plan.
See [reference.md Section 2](./reference.md#section-2--detect--classify).

### Stage 3 — Plan & Approval

`drift-analyzer` generates the correction plan. `fractal-architect` reviews
reclassification candidates using `lca-resolve`. The plan is presented to the
user for approval unless `--auto-approve` is set.
See [reference.md Section 3](./reference.md#section-3--plan--approval).

### Stage 4 — Correction Execution

`restructurer` executes the approved corrections and `structure-validate` confirms
the result.
See [reference.md Section 4](./reference.md#section-4--correction-execution).

## Available MCP Tools

| Tool                 | Stage | Purpose                                                     |
| -------------------- | ----- | ----------------------------------------------------------- |
| `fractal-scan`       | 1     | Full project structure scan                                 |
| `drift-detect`       | 2     | Identify drift items                                        |
| `lca-resolve`        | 3     | Determine correct placement for reclassification candidates |
| `structure-validate` | 4     | Validate post-correction structure                          |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "critical만 처리해줘" instead of `--severity critical`).

```
/filid:fca-sync [path] [--severity critical|high|medium|low] [--dry-run] [--auto-approve]
```

| Option           | Type                          | Default                   | Description                                               |
| ---------------- | ----------------------------- | ------------------------- | --------------------------------------------------------- |
| `path`           | string                        | Current working directory | Root directory to scan                                    |
| `--severity`     | `critical\|high\|medium\|low` | `low` (all)               | Minimum severity level to correct                         |
| `--dry-run`      | flag                          | off                       | Print detection results and plan without applying changes |
| `--auto-approve` | flag                          | off                       | Skip user approval step                                   |

## Quick Reference

```bash
# Detect and correct all drift
/filid:fca-sync

# Correct critical and high severity only
/filid:fca-sync --severity high

# Inspect drift without making changes
/filid:fca-sync --dry-run

# CI automated correction (critical only)
/filid:fca-sync --severity critical --auto-approve

Stages:   Scan → Detect → Plan → Execute
Agents:   drift-analyzer (Stage 1, 2), fractal-architect (Stage 3 review), restructurer (Stage 4)
Severity: critical > high > medium > low
```

Key rules:

- `--severity high` corrects `critical` and `high` items; `medium` and `low` are reported but skipped
- `--dry-run` never modifies files
- If critical drift is present, correct it before re-running builds or tests
- `--auto-approve` is recommended only in validated CI environments
