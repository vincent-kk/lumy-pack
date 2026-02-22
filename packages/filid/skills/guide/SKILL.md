---
name: guide
user_invocable: true
description: Generate a fractal structure guide for a directory — scans the project, queries active rules, and produces a readable guidance document
version: 1.0.0
complexity: low
---

# guide — Fractal Structure Guide

Scan the project's fractal structure and query all active rules to produce a
human-readable guidance document. Helps team members understand filid conventions
and how the current project is classified, so new modules are placed correctly.

> **Detail Reference**: For detailed workflow steps, MCP tool call examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Introducing filid to a team and explaining its rules in project context
- Quickly checking how well the current structure follows fractal principles
- Confirming the category (fractal / organ / pure-function / hybrid) of a directory
- Getting guidance on where to place a new module without causing violations
- Reviewing the current state before running `/filid:restructure` or `/filid:sync`

## Core Workflow

### Phase 1 — Project Scan
Retrieve the full directory tree and node classifications using the `fractal-scan`
MCP tool.
See [reference.md Section 1](./reference.md#section-1--project-scan).

### Phase 2 — Rule Query
Fetch all active rules using `rule-query` (`action: "list"`) to build the rule
reference table included in the guide.
See [reference.md Section 2](./reference.md#section-2--rule-query).

### Phase 3 — Classification Summary
Summarise the node category distribution from the scan results.
Include any existing violations so readers know the current health status.
See [reference.md Section 3](./reference.md#section-3--classification-summary).

### Phase 4 — Guide Document Output
Combine rules, category criteria, the classification summary, and a new-module
checklist into a single guide document.
See [reference.md Section 4](./reference.md#section-4--guide-document-output).

## Available MCP Tools

| Tool | Action | Purpose |
|------|--------|---------|
| `fractal-scan` | — | Retrieve complete project hierarchy and node classifications |
| `rule-query` | `list` | Fetch all active rules |

## Options

```
/filid:guide [path]
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | Current working directory | Root directory to scan and document |

## Quick Reference

```bash
# Guide for current project
/filid:guide

# Guide for a specific sub-directory
/filid:guide src/features

# Category classification criteria
fractal       = Holds state, contains fractal children, or is the default classification
organ         = Leaf directory with no fractal children (structure-based, not name-based)
pure-function = Stateless, no side effects, no I/O
hybrid        = Mix of fractal children and organ-like files
```

Key rules:
- Organ directories must not contain fractal child nodes
- Fractal nodes must have an index.ts barrel export
- main.ts is the primary entry point for a fractal node
- Directory naming convention: kebab-case
