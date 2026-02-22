# structure-review — Reference Documentation

Detailed stage logic, MCP tool examples, and report format for the
6-stage PR verification pipeline. For the quick-start guide, see
[SKILL.md](./SKILL.md).

## Section 1 — Structure Verification Details

```
fractal-navigate(action: "tree", root: cwd)
// Inspect every directory in the module tree

checks:
  - Every fractal dir has CLAUDE.md
  - No organ dir has CLAUDE.md
  - fractal-navigate(classify, dir) matches actual directory role
```

Outcome: `PASS` if all boundaries are clean; `FAIL` with list of
misclassified paths.

## Section 2 — Document Compliance Details

```
for each CLAUDE.md in scope:
  - lineCount <= 100                     // hard limit
  - contains 3-tier boundary sections    // required headings
  - doc-compress(mode: "check")          // size warning at >= 90 lines

for each SPEC.md in scope:
  - no append-only patterns detected     // no raw appended blocks
  - document-code synchronization status // content reflects current code
```

Outcome: `PASS` if all documents comply; `FAIL` listing each
non-compliant file and violation.

## Section 3 — Test Compliance Details

```
test-metrics(action: "check-312", files: allSpecTs)
// Returns per-file: { basic: number, complex: number, total: number, pass: boolean }

checks:
  - total <= 15 per spec.ts file         // TEST_THRESHOLD = 15
  - basic <= 3 per spec.ts file
  - complex <= 12 per spec.ts file
  - coverage assessment for changed modules
```

Outcome: `PASS` if all spec.ts files satisfy the 3+12 rule; `FAIL` with
per-file breakdown showing excess cases.

## Section 4 — Metric Analysis Details

```
ast-analyze(action: "lcom4", files: changedSourceFiles)
// LCOM4 >= 2 → recommend module split

ast-analyze(action: "cyclomatic-complexity", files: changedSourceFiles)
// CC > 15 → recommend function compression or decomposition

test-metrics(action: "decide", metrics: { lcom4, cc })
// decision: ok | split | compress | parameterize
```

Thresholds:

- `LCOM4_SPLIT_THRESHOLD = 2` — modules with LCOM4 ≥ 2 need splitting
- `CC_THRESHOLD = 15` — functions with CC > 15 need decomposition

Outcome: `PASS` if all metrics within thresholds; `FAIL` with per-file
values and recommended actions.

## Section 5 — Dependency Verification Details

```
ast-analyze(action: "dependency-graph", root: cwd)
// Returns: DAG of module import relationships

detectCycles(dag)
// Returns: cycle paths if any exist

verifyTopologicalSort(dag)
// Must succeed for a valid acyclic dependency graph
```

```
fractal-navigate(action: "tree")
// Cross-reference with fractal structure to validate dependency directions
```

Outcome: `PASS` if DAG is acyclic and topological sort succeeds; `FAIL`
with each cycle path listed.

## Section 6 — Summary Report Format

```
┌─────────────────────────────────────────────┐
│ Stage 1 — Structure      PASS               │
│ Stage 2 — Documents      FAIL               │
│ Stage 3 — Tests          PASS               │
│ Stage 4 — Metrics        FAIL               │
│ Stage 5 — Dependencies   PASS               │
├─────────────────────────────────────────────┤
│ VERDICT: FAIL (2 stages failed)             │
└─────────────────────────────────────────────┘

Issues by severity:
  CRITICAL (0)
  HIGH (1):   src/core/CLAUDE.md — 103 lines, exceeds 100-line limit
  MEDIUM (1): src/parser/index.ts — LCOM4=3, recommend split
  LOW (0)

Recommendations:
  1. Run /filid:sync to auto-compress src/core/CLAUDE.md
  2. Split src/parser/index.ts into focused sub-modules
```

## MCP Tool Examples

**fractal-navigate classify:**

```
fractal-navigate(action: "classify", dir: "packages/filid/src/parser")
// Returns: { type: "fractal" | "organ", hasClaude: boolean }
```

**ast-analyze lcom4:**

```
ast-analyze(action: "lcom4", files: ["src/core/index.ts", "src/parser/index.ts"])
// Returns: [{ file: "src/core/index.ts", lcom4: 1 }, { file: "src/parser/index.ts", lcom4: 3 }]
```

## MCP Tool Reference

| Tool               | Action / Parameters                      | Stage | Purpose                                      |
| ------------------ | ---------------------------------------- | ----- | -------------------------------------------- |
| `fractal-navigate` | `action: "tree"`                         | 1, 5  | Retrieve module tree; verify classifications |
| `fractal-navigate` | `action: "classify", dir`                | 1     | Classify a specific directory                |
| `doc-compress`     | `mode: "check"`                          | 2     | Check document size                          |
| `test-metrics`     | `action: "check-312", files`             | 3     | Validate 3+12 rule per spec.ts               |
| `test-metrics`     | `action: "decide", metrics`              | 4     | Generate split/compress recommendation       |
| `ast-analyze`      | `action: "lcom4", files`                 | 4     | Compute LCOM4 cohesion metric                |
| `ast-analyze`      | `action: "cyclomatic-complexity", files` | 4     | Compute cyclomatic complexity                |
| `ast-analyze`      | `action: "dependency-graph", root`       | 5     | Build full import dependency DAG             |
