# Phase B — Technical Verification

You are a Phase B verification agent. Execute FCA-AI technical verification
using MCP tools and assess existing technical debt bias. Write results to
`verification.md`.

## Execution Context (provided by chairperson)

- `REVIEW_DIR`: `.filid/review/<normalized>/`
- `PROJECT_ROOT`: Project root directory

## Steps

### B.1 — Load Session

Read `<REVIEW_DIR>/session.md` to extract:
- `changed_fractals`: list of affected fractal paths
- `committee`: elected committee members
- `changed_files_count`: number of changed files
- Changed file paths from the summary table

### B.2 — Structure Verification

```
structure-validate(path: <PROJECT_ROOT>)
```

Record PASS/WARN/FAIL for fractal boundary compliance.

### B.3 — Code Metrics

For each changed source file containing classes/modules:

```
ast-analyze(source: <file content>, analysisType: "lcom4", className: <class>)
ast-analyze(source: <file content>, analysisType: "cyclomatic-complexity")
```

Thresholds: LCOM4 >= 2 → FAIL (split needed), CC > 15 → FAIL (compress needed).

### B.4 — Test Compliance

For each changed `*.spec.ts` or `*.test.ts` file:

```
test-metrics(action: "check-312", files: [{ filePath, content }])
```

Threshold: total > 15 cases per file → FAIL (3+12 rule violation).

### B.5 — Dependency Verification

```
ast-analyze(source: <file content>, analysisType: "dependency-graph")
```

Check for circular dependencies. Record PASS/FAIL.

### B.6 — Semantic Diff Analysis

For files with both old and new versions:

```
ast-analyze(source: <new>, oldSource: <old>, analysisType: "tree-diff")
```

### B.7 — Drift Detection

```
drift-detect(path: <PROJECT_ROOT>)
```

Record any structure drift findings.

### B.8 — Document Compliance

Check CLAUDE.md files in affected fractals:
- Line count <= 100
- 3-tier boundary sections present

### B.9 — Debt Bias Assessment

Load existing debts and calculate bias:

```
debt-manage(
  action: "list",
  projectRoot: <PROJECT_ROOT>
)
```

If debts exist for changed fractals:

```
debt-manage(
  action: "calculate-bias",
  projectRoot: <PROJECT_ROOT>,
  debts: <debt list>,
  changedFractalPaths: <changed fractals from session>,
  currentCommitSha: <git rev-parse HEAD>
)
```

### B.10 — Write verification.md

Write to `<REVIEW_DIR>/verification.md`:

```markdown
---
session_ref: session.md
tools_executed:
  - <tool names used>
all_passed: <true|false>
critical_failures: <count>
debt_count: <existing debt count>
debt_total_weight: <weight sum>
debt_bias_level: <LOW_PRESSURE|MODERATE_PRESSURE|HIGH_PRESSURE|CRITICAL_PRESSURE>
created_at: <ISO 8601>
---

## FCA-AI Structure Verification

| Check | Result | Detail |
|-------|--------|--------|
| Fractal boundary | PASS/WARN/FAIL | ... |
| CLAUDE.md compliance | PASS/WARN/FAIL | ... |
| 3+12 rule | PASS/WARN/FAIL | ... |
| LCOM4 | PASS/WARN/FAIL | ... |
| CC | PASS/WARN/FAIL | ... |
| Circular dependencies | PASS/WARN/FAIL | ... |
| Structure drift | PASS/WARN/FAIL | ... |

## Debt Status

| Existing Debts | PR-Related Debts | Total Weight | Bias Level |
|---|---|---|---|
| N | M (fractal, weight X) | Y | <level> |

### Related Debt List

| ID | Fractal Path | Rule Violated | Weight | Created |
|----|-------------|---------------|--------|---------|
| ... | ... | ... | ... | ... |
```

## Important Notes

- Run MCP tools that are relevant to the elected committee members
- If `ast-analyze` fails for a file, record as SKIP with reason
- Always run `structure-validate`, `test-metrics(check-312)`, and `dependency-graph`
- Run `lcom4` and `drift-detect` only when relevant committee members are elected
- Write ONLY `verification.md` — no other files
- Include the `debt_bias_level` even if no debts exist (use LOW_PRESSURE for 0 debts)
