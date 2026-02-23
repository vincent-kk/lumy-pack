# scan — Reference Documentation

Detailed workflow, severity definitions, and report formats for the FCA-AI
rule scanner. For the quick-start guide, see [SKILL.md](./SKILL.md).

## Section 1 — Tree Construction

Call `fractal_scan` to build the complete hierarchy by scanning the filesystem.

```
fractal_scan({ path: "<target-path>" })
```

The response is a `ScanReport` with `tree.nodes` (Map of path → FractalNode).
Partition into three working sets:

- **fractal nodes** — nodes with `hasClaudeMd: true` or `type: "fractal"`
- **organ nodes** — nodes with `type: "organ"` or names matching `ORGAN_DIR_NAMES`
- **spec files** — files matching `*.spec.ts` pattern

## Section 2 — CLAUDE.md Validation

For every fractal node that has a CLAUDE.md, perform two checks:

**Check 2a — Line count**

Read the CLAUDE.md content and count lines.

| Condition         | Severity | Violation ID           |
| ----------------- | -------- | ---------------------- |
| `lineCount > 100` | high     | `CLAUDE_MD_LINE_LIMIT` |

**Check 2b — 3-tier boundary sections**

Verify that all three required headings are present:

- `### Always do`
- `### Ask first`
- `### Never do`

| Condition           | Severity | Violation ID                   |
| ------------------- | -------- | ------------------------------ |
| Any section missing | high     | `CLAUDE_MD_MISSING_BOUNDARIES` |

## Section 3 — Organ Directory Validation

For every directory whose name matches `ORGAN_DIR_NAMES`, check that no
CLAUDE.md is present inside it.

| Condition                     | Severity | Violation ID              | Auto-fixable |
| ----------------------------- | -------- | ------------------------- | ------------ |
| CLAUDE.md exists in organ dir | critical | `ORGAN_CLAUDE_MD_PRESENT` | Yes (delete) |

`ORGAN_DIR_NAMES` = `components`, `utils`, `types`, `hooks`, `helpers`,
`lib`, `styles`, `assets`, `constants`

## Section 4 — Test File Validation (3+12 Rule)

Collect all spec files and call `test_metrics` with `action: "check-312"`.

```
test_metrics({
  action: "check-312",
  files: [{ filePath: "<path>", content: "<source>" }, ...]
})
```

The 3+12 rule: each `*.spec.ts` file must have at most **15 test cases**
total, with a recommended distribution of 3 basic + 12 complex.

| Condition                     | Severity | Violation ID        |
| ----------------------------- | -------- | ------------------- |
| `total > 15` in any spec file | high     | `TEST_312_EXCEEDED` |

Note: `*.test.ts` files are excluded from this check.

## Section 5 — Report Formats

### Without `--fix` — report only

```
FCA-AI Scan Report
==================
Target        : <path>
Checks run    : <n>
Total violations: <n>

CRITICAL (<n>)
  [ORGAN_CLAUDE_MD_PRESENT] src/utils/CLAUDE.md
    Organ directories must not contain CLAUDE.md.
    Remediation: delete the file or reclassify the directory.

  [CLAUDE_MD_LINE_LIMIT] src/payments/CLAUDE.md — 117 lines (limit: 100)
    Remediation: compress or split the document.

HIGH (<n>)
  [TEST_312_EXCEEDED] src/payments/payment.spec.ts — 18 tests (limit: 15)
    Remediation: split into multiple spec files or parameterise cases.

MEDIUM (<n>)
  ...

Auto-fixable  : <n> of <total>
Run with --fix to apply automatic remediations.
```

### With `--fix` — apply remediations then re-validate

| Violation                      | Auto-fix Action                               |
| ------------------------------ | --------------------------------------------- |
| `ORGAN_CLAUDE_MD_PRESENT`      | Delete the CLAUDE.md from the organ directory |
| `CLAUDE_MD_MISSING_BOUNDARIES` | Append skeleton boundary sections to the file |

Violations that require human judgement (line limit, test count) are
flagged but not auto-fixed. After fixes, re-run Phases 2–4 and append
a fix summary:

```
Auto-fix Summary
----------------
Fixed   : <n>
Skipped : <n> (require manual remediation)
```

## Violation Quick Lookup

| ID                             | Severity | Auto-fix |
| ------------------------------ | -------- | -------- |
| `CLAUDE_MD_LINE_LIMIT`         | high     | No       |
| `CLAUDE_MD_MISSING_BOUNDARIES` | high     | Yes      |
| `ORGAN_CLAUDE_MD_PRESENT`      | critical | Yes      |
| `TEST_312_EXCEEDED`            | high     | No       |
