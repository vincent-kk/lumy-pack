---
name: context-query
user_invocable: true
description: Query FCA-AI context — module/rule lookup within 3-Prompt Limit
version: 1.0.0
complexity: simple
---

# context-query — Context Query

Answer a targeted question about the FCA-AI project by navigating the
fractal hierarchy, loading the minimal CLAUDE.md chain, and responding
within a strict 3-Prompt Limit.

> **Detail Reference**: For detailed workflow steps, MCP tool examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Looking up boundary rules for a specific module before making a change
- Identifying which fractal node owns a particular concern or file
- Checking what a CLAUDE.md says without manually reading the tree
- Understanding the context chain between a leaf module and the project root
- Any focused question answerable from CLAUDE.md content alone

## Core Workflow

### Phase 1 — Question Parsing
Identify target module, relevant paths, and query type from the question.
See [reference.md Section 1](./reference.md#section-1--question-parsing).

### Phase 2 — Navigation (Prompt 1)
Locate the target module using `fractal-navigate(action: "tree")`.
See [reference.md Section 2](./reference.md#section-2--navigation-details).

### Phase 3 — Context Loading
Load the CLAUDE.md chain from leaf node to project root.
See [reference.md Section 3](./reference.md#section-3--context-chain-loading).

### Phase 4 — Compression (if needed)
Apply `doc-compress(mode: "auto")` when chain exceeds context limits.
See [reference.md Section 4](./reference.md#section-4--compression-strategy).

### Phase 5 — Response (Prompt 2–3 max)
Generate answer within the 3-Prompt budget.
See [reference.md Section 5](./reference.md#section-5--3-prompt-limit-protocol).

## Available MCP Tools

| Tool | Action | Purpose |
|------|--------|---------|
| `fractal-navigate` | `tree` | Scan project hierarchy to locate the target module |
| `fractal-navigate` | `classify` | Resolve ambiguous module classification |
| `doc-compress` | `auto` | Compress CLAUDE.md chain when it exceeds context limits |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Just ask your question naturally.

```
/filid:context-query <question>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | The question to answer from the FCA-AI context |

## Quick Reference

```bash
# Look up boundary rules for a module
/filid:context-query "What are the boundaries for the payments module?"

# Find module ownership
/filid:context-query "Which fractal node owns retry logic?"

# Check what is forbidden in a module
/filid:context-query "What does the auth CLAUDE.md say we must never do?"

# 3-Prompt Limit
Prompt 1  →  fractal-navigate (locate module)
Prompt 2  →  load/analyse CLAUDE.md chain
Prompt 3  →  final answer (hard limit)

# If answer requires > 3 prompts
→  Report what is known
→  State which files contain the missing information
→  Do not exceed the budget
```
