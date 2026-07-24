# FCA-AI Rules

**Every module is a fractal. Every boundary is enforced. The graph is a DAG.**

- Modules document themselves (`INTENT.md`) and define contracts (`DETAIL.md`).
- Consumers import through entry points; files inside a module import each other directly.
- Documentation precedes code. `INTENT.md` ≤ 50 lines. Spec files ≤ 15 cases.

Fractal Context Architecture (FCA-AI) is a recursive module organization system for AI-operated codebases.
Every independent module is a "fractal node" with documentation, entry point, and boundary rules.
The dependency graph MUST be a DAG. External consumers MUST import only from a module's entry point, never its internal files; files within the same module import each other directly.

---

## Node Types

| Type            | INTENT.md | Children   | Entry point  | Description                                |
| --------------- | --------- | ---------- | ------------ | ------------------------------------------ |
| `fractal`       | required  | allowed    | required     | Independent module with public API         |
| `organ`         | forbidden | files only | not required | Leaf compartment (single concern)          |
| `pure-function` | optional  | none       | not required | Stateless functions, no side effects       |
| `hybrid`        | optional  | allowed    | required     | Transitional node (fractal + organ traits) |

---

## Node Classification Priority

Classification is determined by directory inspection in this strict priority order:

1. **INTENT.md or DETAIL.md present** → `fractal` (preserve existing, skip generation)
2. **Directory name in known organ list** → `organ` (INTENT.md prohibited)
3. **Pattern `__name__`** (double-underscore wrapped) → `organ`
4. **Pattern `.name`** (dot-prefixed) → `organ`
5. **Entry-point file present** (`index.ts`/`.js`/`.mjs`/`.cjs`) in a non-organ, non-infra directory → `fractal`
6. **No fractal children + leaf directory** → `organ`
7. **No observable side effects, stateless** → `pure-function` (non-leaf directories only — leaves are captured by rule 6; purity is scanner-supplied and defaults to side-effectful)
8. **Default** → `fractal` (generate INTENT.md)

**Known organ names** (priority 2):

- **Base** (shared/UI): `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`
- **Test/infra**: `test`, `tests`, `spec`, `specs`, `fixtures`, `e2e`
- **Docs**: `references`

**Pattern-matched organs** (priorities 3–4, not listed by name):

- `__name__` (double-underscore wrapped): e.g. `__tests__`, `__mocks__`, `__fixtures__`.
- `.name` (dot-prefixed): e.g. `.config`, `.hidden`.

Fractal nodes MAY appear inside organ directories; traversal MUST re-classify such subdirectories — they become independent fractal nodes, not children of the organ. `hybrid` is never auto-classified: it is assigned manually during incremental migration.

---

## Structural Rules

Structural rules the scanner evaluates against every node — enable/disable and
set severity in `.filid/config.json`:
`{ "rules": { "<rule-id>": { "enabled": true|false } } }`
Naming and depth checks are configured the same way as the rules below;
acyclicity (the DAG requirement above) is a discipline the scan does not yet
verify — trace the edges you touch rather than trusting a green run.

### organ-no-intentmd

**Severity**: error | **Applies to**: organ nodes

- Organ nodes MUST NOT contain INTENT.md.
- If an organ needs independent documentation, reclassify it as `fractal`.

### index-barrel-pattern

**Severity**: warning | **Applies to**: fractal and hybrid nodes with index.ts

- `index.ts` in fractal/hybrid nodes MUST be a pure barrel — named re-export
  statements only, with no direct function, class, constant, or type
  declarations. The scan checks this shape; which symbols belong in the public
  surface is a separate concern.
- Does NOT apply to organ or pure-function nodes.

### module-entry-point

**Severity**: warning | **Applies to**: fractal and hybrid nodes

- Every fractal/hybrid node MUST have an entry point: `index.ts` (barrel) or `main.ts` (executable/CLI).
- A framework-invoked entry file (e.g. Next.js `page.*`/`route.*`) also satisfies the requirement when a framework is detected. Projects MAY register more via `.filid/config.json` `additional-entry-points`.
- External consumers MUST import from the entry point, never from internal files.
  Files inside the module import their peers directly — the local barrel serves
  outside consumers, not internal routing. Internal implementation files import
  concrete internal files directly, not through the local `index.ts`; the local
  `index.ts` is an external boundary, not a default indirection layer.
- organ and pure-function nodes do NOT require an entry point.

### pure-function-isolation

**Severity**: error | **Applies to**: pure-function nodes

- `pure-function` nodes MUST NOT import from `fractal` or `hybrid` modules.
- Pure functions have no side effects, no I/O, no stateful module dependencies.
- Fix: move into the fractal module as organ, pass dependencies as arguments, or reclassify as organ/fractal.

### zero-peer-file

**Severity**: warning | **Applies to**: fractal and hybrid nodes

- Fractal roots MUST NOT contain standalone peer files outside the allowed categories:
  - **Static allowed**: `index.ts`, `index.js`, `index.tsx`, `index.mjs`, `index.cjs`, `main.ts`, `main.js`, `INTENT.md`, `DETAIL.md`
  - **Eponymous file** (max 1): file whose base name matches the directory name (e.g., `auth/auth.ts`)
  - **Framework reserved**: auto-detected from `package.json` dependencies (Next.js, Remix, Nuxt, SvelteKit) at scan time
- Fix: promote peer file to a subdirectory, or add to `.filid/config.json` `additional-allowed`.

---

## Documentation Constraints

### INTENT.md

- Hard limit: **50 lines**. Exceeding 50 lines is blocked by the pre-tool-use hook.
- MUST include 3-tier boundary sections:
  - `### Always do` — actions that must always be taken in this module
  - `### Ask first` — actions requiring discussion before proceeding
  - `### Never do` — actions strictly prohibited in this module
- Approaching 50 lines signals the module MUST be decomposed into smaller fractal nodes.
- MUST NOT increase the limit; restructure the module instead.
- `## Structure` SHOULD call out name traps when present (e.g., "entry point is
  `cli.ts`, NOT `index.ts`") — one line that pre-empts the most expensive misread.
- `## Conventions` SHOULD rank the module's tradeoff priorities when they exist
  (e.g., "when making tradeoffs, in order: 1. correctness 2. throughput") —
  a decision rule guides an agent further than any list of actions.
- Section headings (`## Purpose`, `## Structure`, `## Conventions`, `## Boundaries`,
  `### Always do`, `### Ask first`, `### Never do`, `## Dependencies`) MUST remain in English — machine-readable anchors for the validator.
- Descriptive content MUST follow the language specified by `[filid:lang]`; default to English if absent.

### DETAIL.md

- MUST NOT grow append-only. Each update MUST restructure to reflect current state.
- Defines public API contract, acceptance criteria, and scope boundaries.
- MUST reflect current intended behavior, not historical evolution.
- Update DETAIL.md **before** code changes. Update INTENT.md when boundaries change.
- Section headings (`## Requirements`, `## API Contracts`, `## Last Updated`) MUST remain in English — machine-readable anchors for the validator.
- Descriptive content MUST follow the language specified by `[filid:lang]`; default to English if absent.

---

## Quality Thresholds

| Metric                   | Threshold                                | Action                      |
| ------------------------ | ---------------------------------------- | --------------------------- |
| LCOM4 (Lack of Cohesion) | >= 2                                     | Split into separate modules |
| Cyclomatic Complexity    | > 15                                     | Compress or abstract        |
| File size                | > 500 lines (advisory; no code constant) | Consider splitting          |

Metrics are computed by `/filid:scan` — do not estimate them by inspection.

**Test file conventions (15-case rule)**: at most **15 cases** per spec file — the scan
gate checks the total only; "~3 basic + ~12 complex" is the recommended shape, not a
separately enforced pair. Exceeding 15 signals the spec (or module) should be split.
Never delete or omit a needed test to satisfy the cap — coverage outranks the cap;
split the spec file instead.

---

## Structure Principles

- **New module** → MUST create INTENT.md (3-tier boundaries) + index.ts (barrel export).
- **Leaf utility dirs** (`components/`, `utils/`, `types/`) → organ: no INTENT.md, keep flat.
- **Shared code** → MUST be placed at the nearest common ancestor (LCA) of its consumers.
- **Sibling imports** → import the sibling's own entry point (`../sibling`), never its
  internals — and never route through the shared parent's entry point (the parent barrel
  re-exports you; that path is a cycle).
- **New file in fractal root** → MUST go into an existing organ or new sub-fractal; MUST NOT leave as peer file unless in an allowed category.

---

## Development Workflow

Before any implementation that touches a fractal module:

1. Identify all affected fractal modules.
2. Update DETAIL.md with new or changed requirements.
3. Update INTENT.md if the module's public interface or boundaries change.
4. Implement the change.
5. Run `/filid:scan` and clear new findings — `warning` findings count as findings;
   do not declare compliance while they remain.
