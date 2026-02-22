---
name: promote
user_invocable: true
description: Promote stable test.ts files to 3+12 rule-compliant spec.ts
version: 1.0.0
complexity: medium
---

# promote — Test Promotion

Promote stable `test.ts` files to parameterized `spec.ts` files satisfying the
FCA-AI 3+12 rule (max 3 basic + 12 complex = 15 total). Executes discovery,
eligibility, analysis, generation, validation, and migration in one pass.

> **Detail Reference**: For detailed workflow steps, MCP tool examples,
> and output format templates, read the `reference.md` file in this
> skill's directory (same location as this SKILL.md).

## When to Use This Skill

- When `test.ts` files have been stable for 90+ days with no recent failures
- Before a release to consolidate ad-hoc tests into structured specs
- After a feature stabilizes and its test patterns become predictable
- When duplicate test cases can be consolidated via parameterization
- To bring a module into full FCA-AI compliance

## Core Workflow

### Phase 1 — Discovery

Locate all `test.ts` files and analyze metrics via `test-metrics(action: "count")`.
See [reference.md Section 1](./reference.md#section-1--discovery-details).

### Phase 2 — Eligibility Check

Apply stability threshold (default 90 days) and failure history filter.
See [reference.md Section 2](./reference.md#section-2--eligibility-rules).

### Phase 3 — Pattern Analysis

Categorize tests as basic/complex, identify duplicates and parameterizable patterns.
See [reference.md Section 3](./reference.md#section-3--pattern-analysis).

### Phase 4 — Spec Generation

Build parameterized `spec.ts` enforcing the 3+12 rule (≤15 total cases).
See [reference.md Section 4](./reference.md#section-4--spec-generation-312-rule).

### Phase 5 — Validation

Verify generated specs pass `test-metrics(action: "check-312")` before writing.
See [reference.md Section 5](./reference.md#section-5--validation-and-migration).

### Phase 6 — Migration

Write validated `spec.ts`, remove original `test.ts`, and emit report.
See [reference.md Section 5](./reference.md#section-5--validation-and-migration).

## Available MCP Tools

| Tool           | Action      | Purpose                                                  |
| -------------- | ----------- | -------------------------------------------------------- |
| `test-metrics` | `count`     | Analyze test case counts, stability, and failure history |
| `test-metrics` | `check-312` | Validate generated spec.ts against 3+12 rule             |

## Options

> Options are LLM-interpreted hints, not strict CLI flags. Natural language works equally well (e.g., "60일 기준으로 해줘" instead of `--days=60`).

```
/filid:promote [path] [--days=90]
```

| Option     | Type    | Default                   | Description                                  |
| ---------- | ------- | ------------------------- | -------------------------------------------- |
| `path`     | string  | current working directory | Target directory to scan for `test.ts` files |
| `--days=N` | integer | 90                        | Minimum stability period in days             |

## Quick Reference

```
/filid:promote                         # Scan cwd, 90-day threshold
/filid:promote [path]                  # Scan specific directory
/filid:promote --days=N                # Custom stability threshold
/filid:promote [path] --days=N         # Both options combined

Phases:   Discovery → Eligibility → Analysis → Generation → Validate → Migrate
Agents:   qa-reviewer (analysis), implementer (execution)
Constants:
  DEFAULT_STABILITY_DAYS = 90
  TEST_THRESHOLD         = 15  (max cases per spec.ts)
  basic  <= 3
  complex <= 12
Rule:   Write spec.ts only after check-312 passes; delete test.ts after write succeeds
```
