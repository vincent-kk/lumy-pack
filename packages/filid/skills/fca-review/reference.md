# code-review — Reference Documentation

Detailed output format templates, MCP tool usage map, and workflow
reference for the multi-persona code review governance pipeline.

## Review Report Format (`review-report.md`)

```markdown
# Code Review Report — <branch name>

**Date**: <ISO 8601>
**Scope**: <branch|pr|commit>
**Base**: <base ref>
**Verdict**: APPROVED | REQUEST_CHANGES | INCONCLUSIVE

## Committee Composition

| Persona               | Election Basis            | Final Position |
| --------------------- | ------------------------- | -------------- |
| Engineering Architect | LCOM4 verification needed | SYNTHESIS      |
| Knowledge Manager     | CLAUDE.md change detected | SYNTHESIS      |
| ...                   | ...                       | ...            |

## Structure Compliance (Phase A)

> Omitted if `--no-structure-check` was used.

| Stage | Name         | Result      | Issues |
|-------|--------------|-------------|--------|
| 1     | Structure    | PASS / FAIL | N      |
| 2     | Documents    | PASS / FAIL | N      |
| 3     | Tests        | PASS / FAIL | N      |
| 4     | Metrics      | PASS / FAIL | N      |
| 5     | Dependencies | PASS / FAIL | N      |
| **Overall** |       | **PASS/FAIL** | **N total** |

Structure violations elevated to committee agenda: <N critical/high items>

## Technical Verification Results

### FCA-AI Structure Verification (diff scope)

| Check                 | Result         | Detail |
| --------------------- | -------------- | ------ |
| Fractal boundary      | PASS/WARN/FAIL | ...    |
| CLAUDE.md compliance  | PASS/WARN/FAIL | ...    |
| 3+12 rule             | PASS/WARN/FAIL | ...    |
| LCOM4                 | PASS/WARN/FAIL | ...    |
| CC                    | PASS/WARN/FAIL | ...    |
| Circular dependencies | PASS/WARN/FAIL | ...    |
| Structure drift       | PASS/WARN/FAIL | ...    |

### Debt Status

| Existing Debts | PR-Related Debts | Total Weight | Bias Level   |
| -------------- | ---------------- | ------------ | ------------ |
| N              | M (weight X)     | Y            | <bias level> |

## Deliberation Log

### Round 1 — PROPOSAL

[details...]

### Round N — CONCLUSION

[final agreement...]

## Final Verdict

**<VERDICT>** — N fix request items generated.
See `fix-requests.md` for details.
```

## Fix Requests Format (`fix-requests.md`)

Structure violations (CRITICAL/HIGH findings from `structure-check.md`) are
included as FIX-XXX items alongside code quality issues. Phase D is responsible
for assigning IDs sequentially across both sources.

````markdown
# Fix Requests — <branch name>

**Generated**: <ISO 8601>
**Total Items**: N (structure: S, code quality: Q)

---

## FIX-001: <title>

- **Severity**: LOW | MEDIUM | HIGH | CRITICAL
- **Source**: structure | code-quality        ← origin of the finding
- **Path**: `<file path>`
- **Rule**: <violated rule>
- **Current**: <current value>
- **Raised by**: <persona name>              ← "Phase A" for structure items
- **Recommended Action**: <description>
- **Code Patch**:
  ```typescript
  // suggested fix (omit if structural — describe action instead)
  ```
````

---

````

## PR Comment Format

When `--scope=pr` and `gh` CLI is authenticated:

```markdown
## Code Review Governance — <Verdict>

**Committee**: <persona list>
**Complexity**: <LOW|MEDIUM|HIGH>

### Summary
- Technical checks: N/M passed
- Fix requests: K items
- Debt bias: <bias level>

> Full report: `.filid/review/<branch>/review-report.md`
````

## MCP Tool Usage Map by Phase

### Phase A (Structure Agent, sonnet) — diff scope only

| Tool                 | Action / Parameters              | Stage | Purpose                                          |
| -------------------- | -------------------------------- | ----- | ------------------------------------------------ |
| `fractal_navigate`   | `action: "classify"`             | 1     | Classify changed dirs for boundary check         |
| `structure_validate` | `path: <changed dir>`            | 1     | Fractal/organ boundary validation (diff only)    |
| `doc_compress`       | `mode: "auto"`                   | 2     | CLAUDE.md line count (changed CLAUDE.md only)    |
| `test_metrics`       | `action: "check-312"`            | 3     | 3+12 rule on changed spec.ts files only          |
| `ast_analyze`        | `analysisType: "lcom4"`          | 4     | Module cohesion on changed source files          |
| `ast_analyze`        | `analysisType: "cyclomatic-complexity"` | 4 | Complexity on changed source files          |
| `test_metrics`       | `action: "decide"`               | 4     | Split/compress recommendation                    |
| `ast_analyze`        | `analysisType: "dependency-graph"` | 5  | DAG + cycle detection on changed files           |

### Phase B (Analysis Agent, haiku)

| Tool               | Action             | Purpose                              |
| ------------------ | ------------------ | ------------------------------------ |
| `review_manage`    | `normalize-branch` | Branch name → filesystem-safe string |
| `review_manage`    | `ensure-dir`       | Create `.filid/review/<branch>/`     |
| `review_manage`    | `elect-committee`  | Deterministic committee election     |
| `fractal_navigate` | `classify`         | Classify changed directories         |
| `fractal_scan`     | —                  | Build full fractal tree              |

### Phase C (Verification Agent, sonnet)

| Tool                 | Action                  | Purpose                               |
| -------------------- | ----------------------- | ------------------------------------- |
| `ast_analyze`        | `lcom4`                 | Cohesion verification (split needed?) |
| `ast_analyze`        | `cyclomatic-complexity` | Complexity verification               |
| `ast_analyze`        | `dependency-graph`      | Circular dependency check             |
| `ast_analyze`        | `tree-diff`             | Semantic change analysis              |
| `test_metrics`       | `check-312`             | 3+12 rule validation                  |
| `test_metrics`       | `count`                 | Test case counting                    |
| `test_metrics`       | `decide`                | Split/compress/parameterize decision  |
| `structure_validate` | —                       | FCA-AI structure rules                |
| `drift_detect`       | —                       | Structure drift detection             |
| `doc_compress`       | `auto`                  | Document compression state            |
| `rule_query`         | `list`                  | Active rules listing                  |
| `debt_manage`        | `calculate-bias`        | Debt bias level determination         |

### Phase D (Chairperson, direct)

No MCP tool calls. Reads `session.md` + `verification.md` + `structure-check.md` only.

### Checkpoint (SKILL.md, before phases)

| Tool            | Action             | Purpose                     |
| --------------- | ------------------ | --------------------------- |
| `review_manage` | `normalize-branch` | Branch normalization        |
| `review_manage` | `checkpoint`       | Phase state detection       |
| `review_manage` | `cleanup`          | Delete review dir (--force) |

**Checkpoint resume order** (based on files present in `REVIEW_DIR`):

| Files present                                          | Resume from |
| ------------------------------------------------------ | ----------- |
| None                                                   | Phase A     |
| `structure-check.md` only                             | Phase B     |
| `session.md` (no `verification.md`)                   | Phase C     |
| `session.md` + `verification.md`                      | Phase D     |
| `session.md` + `verification.md` + `review-report.md` | Complete    |

When `--no-structure-check` is active, Phase A is skipped and resume starts
from Phase B even when no checkpoint files exist.

## Debt Bias Injection

The chairperson injects debt context into Phase D deliberation:

| Bias Level               | Committee Behavior                    | Business Driver Impact                |
| ------------------------ | ------------------------------------- | ------------------------------------- |
| LOW_PRESSURE (0-5)       | Normal review, debt issuance allowed  | CoD claims accepted                   |
| MODERATE_PRESSURE (6-15) | Strong debt repayment recommendation  | CoD claims need quantitative evidence |
| HIGH_PRESSURE (16-30)    | Near-prohibition on new debt          | CoD claims effectively rejected       |
| CRITICAL_PRESSURE (31+)  | No PR approval without debt repayment | VETO by default                       |
