---
name: scan
user_invocable: true
description: Scan for FCA-AI rule violations and generate report, --fix for auto-remediation
version: 1.0.0
complexity: medium
---

# scan — FCA-AI Rule Scanner

Scan the project for FCA-AI rule violations across CLAUDE.md documents,
organ directory boundaries, and test file structure. Produces a prioritised
violation report and, with `--fix`, applies automatic remediation.

> **Detail Reference**: For detailed workflow steps, MCP tool examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Auditing the project before opening a pull request
- Checking for regressions after a large-scale refactor
- Verifying that `/filid:init` produced a fully compliant structure
- Running a periodic governance health check
- Preparing a baseline report before `/filid:structure-review` or `/filid:promote`

## Core Workflow

### Phase 1 — Tree Construction

Build the project hierarchy using `fractal-navigate(action: "tree")` and
partition into fractal nodes, organ nodes, and spec files.
See [reference.md Section 1](./reference.md#section-1--tree-construction).

### Phase 2 — CLAUDE.md Validation

Check line count (≤100) and 3-tier boundary sections for every CLAUDE.md.
See [reference.md Section 2](./reference.md#section-2--claudemd-validation).

### Phase 3 — Organ Directory Validation

Verify no organ directory contains a CLAUDE.md file.
See [reference.md Section 3](./reference.md#section-3--organ-directory-validation).

### Phase 4 — Test File Validation (3+12 Rule)

Validate all `*.spec.ts` files against the 15-case limit using `test-metrics`.
See [reference.md Section 4](./reference.md#section-4--test-file-validation-312-rule).

### Phase 5 — Report Generation

Emit a structured violation report; with `--fix`, apply auto-remediations
and re-validate.
See [reference.md Section 5](./reference.md#section-5--report-formats).

## Available MCP Tools

| Tool               | Action      | Purpose                                   |
| ------------------ | ----------- | ----------------------------------------- |
| `fractal-navigate` | `tree`      | Build complete project hierarchy for scan |
| `test-metrics`     | `check-312` | Validate 3+12 rule across all spec files  |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "고칠 수 있는 건 고쳐줘" instead of `--fix`).

```
/filid:scan [path] [--fix]
```

| Parameter | Type   | Default                   | Description                                 |
| --------- | ------ | ------------------------- | ------------------------------------------- |
| `path`    | string | Current working directory | Root directory to scan                      |
| `--fix`   | flag   | off                       | Apply automatic remediations where possible |

## Quick Reference

```bash
# Scan current project (report only)
/filid:scan

# Scan a specific sub-directory
/filid:scan src/payments

# Scan and auto-fix eligible violations
/filid:scan --fix

# Thresholds
CLAUDE_MD_LINE_LIMIT = 100 lines
TEST_THRESHOLD       = 15 test cases per spec file
ORGAN_DIR_NAMES      = components | utils | types | hooks | helpers
                       | lib | styles | assets | constants
```
