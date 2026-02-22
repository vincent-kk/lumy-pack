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

| Persona | Election Basis | Final Position |
|---------|---------------|----------------|
| Engineering Architect | LCOM4 verification needed | SYNTHESIS |
| Knowledge Manager | CLAUDE.md change detected | SYNTHESIS |
| ... | ... | ... |

## Technical Verification Results

### FCA-AI Structure Verification
| Check | Result | Detail |
|-------|--------|--------|
| Fractal boundary | PASS/WARN/FAIL | ... |
| CLAUDE.md compliance | PASS/WARN/FAIL | ... |
| 3+12 rule | PASS/WARN/FAIL | ... |
| LCOM4 | PASS/WARN/FAIL | ... |
| CC | PASS/WARN/FAIL | ... |
| Circular dependencies | PASS/WARN/FAIL | ... |
| Structure drift | PASS/WARN/FAIL | ... |

### Debt Status
| Existing Debts | PR-Related Debts | Total Weight | Bias Level |
|---|---|---|---|
| N | M (weight X) | Y | <bias level> |

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

```markdown
# Fix Requests — <branch name>

**Generated**: <ISO 8601>
**Total Items**: N

---

## FIX-001: <title>

- **Severity**: LOW | MEDIUM | HIGH | CRITICAL
- **Path**: `<file path>`
- **Rule**: <violated rule>
- **Current**: <current value>
- **Raised by**: <persona name>
- **Recommended Action**: <description>
- **Code Patch**:
  ```typescript
  // suggested fix
  ```

---
```

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
```

## MCP Tool Usage Map by Phase

### Phase A (Analysis Agent, haiku)

| Tool | Action | Purpose |
|------|--------|---------|
| `review-manage` | `normalize-branch` | Branch name → filesystem-safe string |
| `review-manage` | `ensure-dir` | Create `.filid/review/<branch>/` |
| `review-manage` | `elect-committee` | Deterministic committee election |
| `fractal-navigate` | `classify` | Classify changed directories |
| `fractal-scan` | — | Build full fractal tree |

### Phase B (Verification Agent, sonnet)

| Tool | Action | Purpose |
|------|--------|---------|
| `ast-analyze` | `lcom4` | Cohesion verification (split needed?) |
| `ast-analyze` | `cyclomatic-complexity` | Complexity verification |
| `ast-analyze` | `dependency-graph` | Circular dependency check |
| `ast-analyze` | `tree-diff` | Semantic change analysis |
| `test-metrics` | `check-312` | 3+12 rule validation |
| `test-metrics` | `count` | Test case counting |
| `test-metrics` | `decide` | Split/compress/parameterize decision |
| `structure-validate` | — | FCA-AI structure rules |
| `drift-detect` | — | Structure drift detection |
| `doc-compress` | `auto` | Document compression state |
| `rule-query` | `list` | Active rules listing |
| `debt-manage` | `calculate-bias` | Debt bias level determination |

### Phase C (Chairperson, direct)

No MCP tool calls. Reads `session.md` + `verification.md` only.

### Checkpoint (SKILL.md, before phases)

| Tool | Action | Purpose |
|------|--------|---------|
| `review-manage` | `normalize-branch` | Branch normalization |
| `review-manage` | `checkpoint` | Phase state detection |
| `review-manage` | `cleanup` | Delete review dir (--force) |

## Debt Bias Injection

The chairperson injects debt context into Phase C deliberation:

| Bias Level | Committee Behavior | Business Driver Impact |
|------------|-------------------|----------------------|
| LOW_PRESSURE (0-5) | Normal review, debt issuance allowed | CoD claims accepted |
| MODERATE_PRESSURE (6-15) | Strong debt repayment recommendation | CoD claims need quantitative evidence |
| HIGH_PRESSURE (16-30) | Near-prohibition on new debt | CoD claims effectively rejected |
| CRITICAL_PRESSURE (31+) | No PR approval without debt repayment | VETO by default |
