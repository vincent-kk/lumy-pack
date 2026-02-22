# guide — Reference Documentation

Detailed workflow, MCP tool call signatures, and output format templates for the
fractal structure guide skill. For the quick-start overview, see [SKILL.md](./SKILL.md).

## Section 1 — Project Scan

Call `fractal-scan` to retrieve the complete directory tree and node classifications.

```
fractal-scan({ path: "<target-path>" })
```

Response fields:
- `nodes`: Array of directory nodes (`path`, `category`, `hasIndex`, `hasMain`, `children`)
- `summary`: Total node count and per-category counts
- `violations`: Currently detected rule violations (may be empty)

Build three working sets from the response:
- **fractal nodes** — `category === "fractal"`
- **organ nodes** — `category === "organ"`
- **pure-function / hybrid nodes** — remaining categories

## Section 2 — Rule Query

Call `rule-query` to retrieve the full list of active rules.

```
rule-query({ action: "list" })
```

Response fields:
- `rules`: Array of rule objects (`id`, `name`, `category`, `severity`, `description`, `examples`)

Rule categories (`RuleCategory`):
- `naming` — Directory and file naming conventions
- `structure` — Node structure and hierarchy rules
- `dependency` — Import/export dependency rules
- `documentation` — Documentation requirements
- `index` — index.ts barrel export rules
- `module` — main.ts entry point rules

## Section 3 — Classification Summary

Build the category distribution table from `summary` in the scan response:

```
categoryTable = {
  fractal:      summary.fractalCount,
  organ:        summary.organCount,
  pureFunction: summary.pureFunctionCount,
  hybrid:       summary.hybridCount,
  total:        summary.totalCount
}
```

If violations are present, sort by severity and include them in the summary section
so readers understand the current health status before the rule list.

## Section 4 — Guide Document Output

### Standard output format

```
## filid Fractal Structure Guide — <target path>

### Project Structure Status
| Category | Nodes | Description |
|----------|-------|-------------|
| fractal | N | Stateful or hierarchical modules |
| organ | N | Shared utility / component directories |
| pure-function | N | Stateless pure-function modules |
| hybrid | N | Mixed fractal + organ modules |
| Total | N | — |

Current violations: N (error: X, warning: Y, info: Z)

### Active Rules

#### naming rules
| Rule ID | Severity | Description |
|---------|----------|-------------|
| HOL-N001 | error | Directories must use kebab-case naming |

#### structure rules
| Rule ID | Severity | Description |
|---------|----------|-------------|
| HOL-S001 | error | Organ directories must not contain fractal children |
| HOL-S002 | warning | Fractal nodes must have an index.ts barrel export |

#### index rules
| Rule ID | Severity | Description |
|---------|----------|-------------|
| HOL-I001 | warning | index.ts must re-export all public symbols |

(Remaining rule categories follow the same format)

### Category Classification Criteria
| Category | Identification Criteria |
|----------|------------------------|
| fractal | Holds state, contains fractal children, or default classification |
| organ | Leaf directory with no fractal children (structure-based auto-classification) |
| pure-function | Stateless, no side effects, no I/O |
| hybrid | Contains both fractal children and organ-like files |

### New Module Checklist
- [ ] Is the directory name kebab-case?
- [ ] If classified as organ, does it have no fractal children?
- [ ] If classified as fractal, does it have an index.ts?
- [ ] If there is a primary feature, does it have a main.ts?
- [ ] Are no fractal children placed under an organ directory?

(If violations exist)
⚠ N violation(s) detected. Run /filid:sync to apply corrections.
```
