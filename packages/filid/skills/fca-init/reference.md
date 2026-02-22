# init — Reference Documentation

Detailed workflow, templates, and rules for the FCA-AI initialization skill.
For the quick-start guide, see [SKILL.md](./SKILL.md).

## Section 1 — Directory Scan Details

Call `fractal-navigate` with `action: "tree"` to retrieve the complete project hierarchy.

```
fractal-navigate({ action: "tree", path: "<target-path>", entries: [] })
```

The response contains every directory and file with the fields:
`name`, `path`, `type` (file | directory), `hasClaudeMd`, `hasSpecMd`.

Build an internal working list of all directories for Phase 2 classification.

## Section 2 — Node Classification Rules

For each directory, call `fractal-navigate` with `action: "classify"`:

```
fractal-navigate({
  action: "classify",
  path: "<directory-path>",
  entries: [/* child entries from tree */]
})
```

Apply the following decision logic in order:

| Condition                             | Node Type     | Action                                  |
| ------------------------------------- | ------------- | --------------------------------------- |
| `hasClaudeMd === true`                | fractal       | Preserve existing file, skip generation |
| Directory name in `ORGAN_DIR_NAMES`   | organ         | Skip — CLAUDE.md is prohibited          |
| No observable side effects, stateless | pure-function | No CLAUDE.md needed                     |
| Default (none of the above)           | fractal       | Generate CLAUDE.md                      |

`ORGAN_DIR_NAMES` = `components`, `utils`, `types`, `hooks`, `helpers`,
`lib`, `styles`, `assets`, `constants`

## Section 3 — CLAUDE.md Generation Template

For each directory classified as fractal that does not yet have a CLAUDE.md,
generate one using the context-manager agent.

CLAUDE.md structure (hard limit: 100 lines):

```markdown
# <Module Name>

## Purpose

<1–2 sentence description of what this module does>

## Structure

<key files and sub-directories with one-line descriptions>

## Conventions

<language, patterns, naming rules specific to this module>

## Boundaries

### Always do

- <rule 1>
- <rule 2>

### Ask first

- <action that requires user confirmation before proceeding>

### Never do

- <prohibited action 1>
- <prohibited action 2>

## Dependencies

<list of modules this directory depends on>
```

Enforce: file must not exceed 100 lines. If generation would exceed the
limit, summarize the most important conventions and boundary rules.

## Section 4 — SPEC.md Scaffolding

For fractal modules that expose a public API and lack a SPEC.md, generate
a scaffold:

```markdown
# <Module Name> Specification

## Requirements

- <functional requirement>

## API Contracts

- <function signature and expected behaviour>

## Last Updated

<ISO date>
```

Only create SPEC.md when the module clearly has an API surface worth
specifying. Do not create SPEC.md for leaf utility directories.

## Section 5 — Validation and Report Format

After all files are written, validate the resulting structure:

- Each fractal node's CLAUDE.md passes `validateClaudeMd()` (≤ 100 lines,
  3-tier boundary sections present)
- No organ directory contains a CLAUDE.md
- All SPEC.md files pass `validateSpecMd()`

Print a summary report:

```
FCA-AI Init Report
==================
Directories scanned : <n>
Fractal nodes       : <n>
Organ nodes         : <n>
Pure-function nodes : <n>
CLAUDE.md created   : <n>
SPEC.md created     : <n>
Warnings            : <list or "none">
```
