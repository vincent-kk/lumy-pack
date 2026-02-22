---
name: structure-review
user_invocable: true
description: 6-stage FCA-AI PR verification — structure, docs, tests, metrics, dependencies
version: 1.0.0
complexity: complex
---

# structure-review — 6-Stage PR Verification

Execute the FCA-AI 6-stage PR verification pipeline. Validate structure,
documents, tests, metrics, and dependencies, then emit a consolidated verdict.

> **Detail Reference**: For detailed workflow steps, MCP tool examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- Before merging any PR that modifies FCA-AI module structure or documents
- After adding new directories to confirm correct fractal/organ classification
- When a CLAUDE.md or SPEC.md has been manually edited and needs compliance verification
- To confirm test files satisfy the 3+12 rule (≤15 cases per spec.ts)
- To detect circular dependencies introduced by refactoring
- For targeted checks on a single stage (`--stage=N`)

## Core Workflow

### Stage 1 — Structure Verification

Validate directory classifications respect FCA-AI fractal/organ boundaries.
See [reference.md Section 1](./reference.md#section-1--structure-verification-details).

### Stage 2 — Document Compliance

Verify CLAUDE.md (≤100 lines, 3-tier sections) and SPEC.md (no append-only).
See [reference.md Section 2](./reference.md#section-2--document-compliance-details).

### Stage 3 — Test Compliance

Validate `*.spec.ts` files against the 3+12 rule (≤15 cases) via `test-metrics`.
See [reference.md Section 3](./reference.md#section-3--test-compliance-details).

### Stage 4 — Metric Analysis

Measure LCOM4 (split at ≥2) and CC (compress at >15) via `ast-analyze`.
See [reference.md Section 4](./reference.md#section-4--metric-analysis-details).

### Stage 5 — Dependency Verification

Build the dependency DAG and verify acyclicity via `ast-analyze`.
See [reference.md Section 5](./reference.md#section-5--dependency-verification-details).

### Stage 6 — Summary Report

Aggregate all stage results into a structured pass/fail verdict.
See [reference.md Section 6](./reference.md#section-6--summary-report-format).

## Available MCP Tools

| Tool               | Stage | Purpose                                          |
| ------------------ | ----- | ------------------------------------------------ |
| `fractal-navigate` | 1, 5  | Module tree and directory classification         |
| `doc-compress`     | 2     | Document size checking                           |
| `test-metrics`     | 3, 4  | 3+12 rule validation and decision recommendation |
| `ast-analyze`      | 4, 5  | LCOM4, CC metrics, dependency DAG                |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "3단계만 해줘" instead of `--stage=3`).

```
/filid:structure-review [--stage=1-6] [--verbose]
```

| Option      | Type          | Default | Description                                  |
| ----------- | ------------- | ------- | -------------------------------------------- |
| `--stage=N` | integer (1–6) | all     | Run only the specified stage                 |
| `--verbose` | flag          | off     | Include per-file detail in each stage report |

## Quick Reference

```
/filid:structure-review                    # Run full 6-stage pipeline
/filid:structure-review --stage=1          # Structure only
/filid:structure-review --stage=3          # Test rule check only
/filid:structure-review --verbose          # Per-file detail in all stages

Stages:   Structure → Documents → Tests → Metrics → Dependencies → Summary
Agents:   qa-reviewer (lead), fractal-architect (assist — stages 1, 5)
Thresholds:
  CLAUDE_MD_LINE_LIMIT = 100
  TEST_THRESHOLD       = 15  (max cases per spec.ts)
  CC_THRESHOLD         = 15  (max cyclomatic complexity)
  LCOM4_SPLIT          = 2   (split when LCOM4 >= 2)
Verdict:  PASS only when all selected stages pass
```
