# init — Reference Documentation

Detailed workflow, templates, and rules for the FCA-AI initialization skill.
For the quick-start guide, see [SKILL.md](./SKILL.md).

## Section 1 — Directory Scan Details

Call `fractal_scan` to retrieve the complete project hierarchy by scanning the filesystem.

```
fractal_scan({ path: "<target-path>" })
```

The response is a `ScanReport` containing:
- `tree.nodes`: Map of path → FractalNode (with `name`, `path`, `type`, `hasClaudeMd`, `hasSpecMd`)
- `tree.root`: root directory path
- `modules`: optional ModuleInfo list (empty unless `includeModuleInfo: true`)

Build an internal working list of all directories from `tree.nodes` for Phase 2 classification.

> **Note**: Do NOT use `fractal_navigate(action: "tree")` for scanning — that tool
> builds a tree only from a pre-supplied `entries` array and does not read the filesystem.

> **Important**: `tree.nodes` in the `fractal_scan` response contains **all**
> directories, including those nested inside organ nodes. In Phase 2, always
> iterate over the full `tree.nodes.values()`. Traversing only `children` from
> `tree.root` will miss fractal nodes that live inside organ boundaries.

## Section 2 — Node Classification Rules

For each directory, call `fractal_navigate` with `action: "classify"`:

```
fractal_navigate({
  action: "classify",
  path: "<directory-path>",
  entries: [/* child entries from tree */]
})
```

Apply the following decision logic in order:

| Condition                               | Node Type     | Action                                  |
| --------------------------------------- | ------------- | --------------------------------------- |
| `hasClaudeMd === true`                  | fractal       | Preserve existing file, skip generation |
| `hasSpecMd === true`                    | fractal       | Preserve existing file, skip generation |
| Directory name in `KNOWN_ORGAN_DIR_NAMES` | organ       | Skip — CLAUDE.md is prohibited          |
| No fractal children + leaf directory    | organ         | Skip — CLAUDE.md is prohibited          |
| No observable side effects, stateless   | pure-function | No CLAUDE.md needed                     |
| Default (none of the above)             | fractal       | Generate CLAUDE.md                      |

`KNOWN_ORGAN_DIR_NAMES` (name-based, always organ regardless of structure):

- **UI/shared**: `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`
- **Test/infra**: `__tests__`, `__mocks__`, `__fixtures__`, `test`, `tests`, `spec`, `specs`, `fixtures`, `e2e`

Pattern-based organ rules (applied before name list, after CLAUDE.md/SPEC.md check):

| Pattern | Example | Classification |
| ------- | ------- | -------------- |
| `__name__` (double-underscore wrapped) | `__tests__`, `__mocks__`, `__custom__` | organ |
| `.name` (dot-prefixed) | `.git`, `.github`, `.vscode`, `.claude` | organ |

> **Important**: Pattern rules apply regardless of directory structure (leaf or
> not). An explicit CLAUDE.md always takes precedence over pattern matching.

### Deep Scan — Fractal Nodes Inside Organ Directories

Organ nodes are never CLAUDE.md targets, but fractal nodes can exist inside
them. Phase 2 must handle this by scanning the full `tree.nodes` map.

**Core rules**:
- Organ node itself → skip CLAUDE.md generation, but continue scanning inside
- Fractal node inside an organ → eligible for CLAUDE.md generation
- Organ node inside an organ → skip CLAUDE.md generation, continue scanning

**Traversal algorithm** (iterate `tree.nodes` directly):

```
for each node in tree.nodes.values():
  if node.type === 'fractal' or 'pure-function':
    → include as a classification target (even if located inside an organ)
  if node.type === 'organ':
    → skip CLAUDE.md generation; sub-nodes are handled by the same loop
```

**Example — three levels of organ nesting**:

```
/app/src (fractal)                                      ← CLAUDE.md target
  /app/src/components (organ)                           ← skip
    /app/src/components/location (fractal, reclassified) ← CLAUDE.md target ✓
      /app/src/components/location/FindLocationModal
        (fractal)                                        ← CLAUDE.md target ✓
```

> `location` is not in `KNOWN_ORGAN_DIR_NAMES` and has a fractal child, so the
> post-correction pass in `scanProject()` automatically reclassifies it as
> fractal and places it in `components.children[]`.

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
