---
name: init
user_invocable: true
description: Initialize FCA-AI project — directory classification, CLAUDE.md/SPEC.md generation
version: 1.0.0
complexity: medium
---

# init — FCA-AI Initialization

Initialize the FCA-AI fractal context architecture in a project. Scans the
directory tree, classifies every directory by node type, generates missing
CLAUDE.md files for fractal nodes, and produces a validation report.

> **Detail Reference**: For detailed workflow steps, MCP tool examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Starting a new project that will follow FCA-AI conventions
- Onboarding an existing codebase into the fractal context system
- Regenerating CLAUDE.md files after a large-scale refactor removed them
- Creating SPEC.md scaffolds for modules that lack formal specifications
- Auditing which directories are correctly classified before running `/filid:scan`

## Core Workflow

### Phase 1 — Directory Scan
Retrieve the complete project hierarchy using `fractal-navigate(action: "tree")`.
Build a working list of all directories for classification.
See [reference.md Section 1](./reference.md#section-1--directory-scan-details).

### Phase 2 — Node Classification
Classify each directory as fractal, organ, or pure-function using
`fractal-navigate(action: "classify")` and priority-ordered decision rules.
See [reference.md Section 2](./reference.md#section-2--node-classification-rules).

### Phase 3 — CLAUDE.md Generation
Generate CLAUDE.md (≤100 lines, 3-tier boundaries) for each fractal directory
that lacks one. Organ directories are skipped.
See [reference.md Section 3](./reference.md#section-3--claudemd-generation-template).

### Phase 4 — SPEC.md Scaffolding
Create SPEC.md scaffolds for fractal modules with public APIs that lack
formal specifications.
See [reference.md Section 4](./reference.md#section-4--specmd-scaffolding).

### Phase 5 — Validation and Report
Validate all generated files against FCA-AI rules and emit a summary report.
See [reference.md Section 5](./reference.md#section-5--validation-and-report-format).

## Available MCP Tools

| Tool | Action | Purpose |
|------|--------|---------|
| `fractal-navigate` | `tree` | Retrieve complete project directory hierarchy |
| `fractal-navigate` | `classify` | Classify a single directory as fractal / organ / pure-function |

## Options

```
/filid:init [path]
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | Current working directory | Root directory to initialize |

## Quick Reference

```bash
# Initialize current project
/filid:init

# Initialize a specific sub-directory
/filid:init src/payments

# Constants
ORGAN_DIR_NAMES   = components | utils | types | hooks | helpers
                    | lib | styles | assets | constants
CLAUDE_MD_LIMIT   = 100 lines
3-TIER SECTIONS   = "Always do" | "Ask first" | "Never do"
```

Key rules:
- Organ directories must never receive a CLAUDE.md
- CLAUDE.md must not exceed 100 lines
- All three boundary sections are required in every CLAUDE.md
- Existing CLAUDE.md files are preserved, never overwritten
