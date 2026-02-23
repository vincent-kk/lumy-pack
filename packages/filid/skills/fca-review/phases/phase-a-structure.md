# Phase A — Diff-Scope Structure Check

You are a Phase A structure check agent. Execute the 5-stage FCA-AI structure
verification pipeline scoped to **files changed in this PR/branch diff only**,
then write the results to `structure-check.md`. This output is consumed by
Phase B (committee election bias) and Phase D (structure violations as
fix-request agenda items).

## Execution Context (provided by chairperson)

- `REVIEW_DIR`: `.filid/review/<normalized>/`
- `PROJECT_ROOT`: Project root directory
- `BASE_REF`: Comparison base reference (e.g., `main`, `origin/main`)
- `BRANCH`: Current branch name

---

## Steps

### A.0 — Collect Changed Files

```bash
git diff <BASE_REF>..HEAD --name-only
```

Then scan the full project hierarchy (required for `fractal_navigate` entries in A.1):

```
fractal_scan(path: <PROJECT_ROOT>)
// Returns: ScanReport { tree: { nodes: Map<path, FractalNode>, root: string }, ... }
```

Store `tree.nodes` as `SCAN_NODES` for use in A.1 classify calls.

Build two lists:
- `CHANGED_FILES`: all modified/added source files (`.ts`, `.tsx`, `.js`)
- `CHANGED_DIRS`: unique parent directories of changed files
- `CHANGED_SPEC_FILES`: changed `*.spec.ts` / `*.test.ts` files
- `CHANGED_CLAUDE_MDS`: changed `CLAUDE.md` files
- `CHANGED_SPEC_MDS`: changed `SPEC.md` files

All subsequent stages operate on these lists only.
If a list is empty for a given stage, record the stage as `SKIP`.

### A.1 — Stage 1: Fractal/Organ Boundary Verification

For each directory in `CHANGED_DIRS`:

```
fractal_navigate(action: "classify", path: <directory>, entries: SCAN_NODES)
structure_validate(path: <directory>)
```

Checks:
- If a changed directory is a fractal node → must have a CLAUDE.md
- If a changed directory is an organ node → must NOT have a CLAUDE.md
- `fractal_navigate(classify)` result must match the directory's actual role

Severity mapping:
- Organ directory has CLAUDE.md → HIGH
- Fractal directory missing CLAUDE.md → MEDIUM
- Category mismatch → HIGH

### A.2 — Stage 2: Document Compliance

For each file in `CHANGED_CLAUDE_MDS`:
- Line count must be <= 100
- Must contain all three tier sections: "Always do", "Ask first", "Never do"
- If line count >= 90: record as LOW severity warning (approaching limit; `doc_compress` recommended)

For each file in `CHANGED_SPEC_MDS`:
- Check for append-only patterns (duplicate section headings from prior iterations)

Skip this stage if both lists are empty.

Severity mapping:
- Line count > 100 → HIGH
- Missing tier section → MEDIUM
- SPEC.md append-only → MEDIUM

### A.3 — Stage 3: Test Compliance (3+12 Rule)

```
test_metrics(action: "check-312", files: CHANGED_SPEC_FILES)
```

Threshold: total test cases per spec.ts file <= 15 (TEST_THRESHOLD = 15).
Also check: basic cases <= 3, complex cases <= 12.

Skip this stage if `CHANGED_SPEC_FILES` is empty.

Severity mapping:
- Total cases > 15 → HIGH
- Distribution violation (too many basic) → MEDIUM

### A.4 — Stage 4: Code Metrics (LCOM4 and CC)

For each file in `CHANGED_FILES` (skip index.ts, *.d.ts, *.spec.ts):

```
ast_analyze(source: <file content>, analysisType: "lcom4", className: <class>)
ast_analyze(source: <file content>, analysisType: "cyclomatic-complexity")
test_metrics(action: "decide", decisionInput: { testCount, lcom4, cyclomaticComplexity })
```

Thresholds:
- LCOM4 >= 2 → recommend split (LCOM4_SPLIT_THRESHOLD = 2)
- CC > 15 → recommend compress/abstract (CC_THRESHOLD = 15)

Skip this stage if `CHANGED_FILES` is empty.

Severity mapping:
- LCOM4 >= 2 on a module with 5+ exports → HIGH
- LCOM4 >= 2 on smaller module → MEDIUM
- CC > 15 → MEDIUM

### A.5 — Stage 5: Dependency Verification (DAG)

For each file in `CHANGED_FILES`:

```
ast_analyze(source: <file content>, analysisType: "dependency-graph")
```

Checks:
- Circular dependencies introduced by the changed files (CRITICAL)
- Changed files importing from sibling fractals without a shared organ (HIGH)

Skip this stage if `CHANGED_FILES` is empty.

Severity mapping:
- Circular dependency detected → CRITICAL
- Cross-fractal boundary violation → HIGH

---

## Output: structure-check.md

Write the following to `<REVIEW_DIR>/structure-check.md`:

```markdown
---
scope: diff           # diff | full  (always "diff" in fca-review)
stage_results:
  structure: PASS|FAIL|SKIP
  documents: PASS|FAIL|SKIP
  tests: PASS|FAIL|SKIP
  metrics: PASS|FAIL|SKIP
  dependencies: PASS|FAIL|SKIP
overall: PASS|FAIL
critical_count: <total CRITICAL + HIGH issue count>
created_at: <ISO 8601>
---

## Structure Check — Stage Results (diff scope)

| Stage | Name         | Result        | Issues |
|-------|--------------|---------------|--------|
| 1     | Structure    | PASS / FAIL   | N      |
| 2     | Documents    | PASS / FAIL   | N      |
| 3     | Tests        | PASS / FAIL   | N      |
| 4     | Metrics      | PASS / FAIL   | N      |
| 5     | Dependencies | PASS / FAIL   | N      |
| **Overall** |       | **PASS/FAIL** | **N total** |

## Findings

### Critical / High
| Sev | Stage | Path | Rule | Current Value | Recommended Fix |
|-----|-------|------|------|---------------|-----------------|
| ...  | ...   | ...  | ...  | ...           | ...             |

### Medium / Low
| Sev | Stage | Path | Rule | Current Value | Recommended Fix |
|-----|-------|------|------|---------------|-----------------|
| ...  | ...   | ...  | ...  | ...           | ...             |
```

---

## Important Notes

- Scope is **diff only** — check changed files and their parent directories
- Write **only** `structure-check.md` — no other files
- If an MCP tool is unavailable, record the stage as `SKIP` with reason
- Stages with empty input lists are recorded as `SKIP` (not FAIL)
- `critical_count` in frontmatter = count of CRITICAL + HIGH findings only
- Phase B will use `critical_count` to bias committee election
- Phase D will convert CRITICAL/HIGH findings into FIX-XXX items in `fix-requests.md`
