---
name: review
description: "Run 6-stage PR verification pipeline"
---

# /review — PR Review Pipeline

Execute the FCA-AI 6-stage PR verification process.

## What This Skill Does

1. **Stage 1 — Structure**: Verify fractal/organ boundaries are respected
2. **Stage 2 — Documents**: Check CLAUDE.md/SPEC.md compliance (100-line limit, no append-only)
3. **Stage 3 — Tests**: Validate 3+12 rule, check test coverage
4. **Stage 4 — Metrics**: Analyze LCOM4 and cyclomatic complexity
5. **Stage 5 — Dependencies**: Verify no circular dependencies in the DAG
6. **Stage 6 — Summary**: Generate pass/fail report with actionable findings

## Usage

```
/review [--stage=1-6] [--verbose]
```

- `--stage`: Run a specific stage only (default: all stages).
- `--verbose`: Include detailed analysis in the report.

## Steps

1. Use `fractal-navigate` tool to validate directory classifications
2. Use `test-metrics` tool for test analysis and decision recommendations
3. Use `doc-compress` tool to check document sizes
4. Aggregate findings into a structured review report
5. Return pass/fail status with per-stage results
