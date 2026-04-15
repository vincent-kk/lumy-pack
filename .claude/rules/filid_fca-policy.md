# FCA-AI Rules

Fractal Context Architecture (FCA-AI) is a recursive module organization system for AI-operated codebases.
Every independent module is a "fractal node" with documentation, entry point, and boundary rules.
The dependency graph MUST be a DAG. Consumers MUST import only from entry points, never internal files.

---

## Node Types

| Type | INTENT.md | Children | Entry point | Description |
|---|---|---|---|---|
| `fractal` | required | allowed | required | Independent module with public API |
| `organ` | forbidden | none | not required | Leaf compartment (single concern) |
| `pure-function` | optional | none | not required | Stateless functions, no side effects |
| `hybrid` | optional | allowed | required | Transitional node (fractal + organ traits) |

---

## Node Classification Priority

Classification is determined by directory inspection in this strict priority order:

1. **INTENT.md or DETAIL.md present** → `fractal` (preserve existing, skip generation)
2. **Directory name in known organ list** → `organ` (INTENT.md prohibited)
3. **Pattern `__name__`** (double-underscore wrapped) → `organ`
4. **Pattern `.name`** (dot-prefixed) → `organ`
5. **No fractal children + leaf directory** → `organ`
6. **No observable side effects, stateless** → `pure-function`
7. **Default** → `fractal` (generate INTENT.md)

**Known organ names**: `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`, `__tests__`, `__mocks__`, `__fixtures__`, `test`, `tests`, `spec`, `specs`, `fixtures`, `e2e`

Fractal nodes CAN exist inside organ directories. The scanner MUST traverse into organs and
re-classify any subdirectory that does not match organ rules.

---

## Structural Rules

8 built-in rules evaluated against every node. Configure in `.filid/config.json`:
`{ "rules": { "<rule-id>": { "enabled": true|false } } }`

### naming-convention

**Severity**: warning | **Applies to**: all nodes

- Names MUST follow kebab-case (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`, preferred) or camelCase (`/^[a-z][a-zA-Z0-9]*$/`).
- PascalCase, SCREAMING_SNAKE_CASE, and spaces are violations.
- Exempt: `INTENT.md`, `DETAIL.md`, `README.md`.
- Disable in `.filid/config.json` if your project requires PascalCase (e.g., React components).

### organ-no-intentmd

**Severity**: error | **Applies to**: organ nodes

- Organ nodes MUST NOT contain INTENT.md.
- If an organ needs independent documentation, reclassify it as `fractal`.

### index-barrel-pattern

**Severity**: warning | **Applies to**: fractal and hybrid nodes with index.ts

- `index.ts` in fractal/hybrid nodes MUST be a pure barrel — re-export statements only.
- MUST NOT contain direct function, class, constant, or type declarations.

```typescript
// ALLOWED (pure barrel):
export { myFunction } from './my-function.js';
export type { MyType } from './types.js';

// VIOLATION (direct declaration):
export function myFunction() { return 42; }
export const MY_CONSTANT = 'value';
```

- Does NOT apply to organ or pure-function nodes.

### module-entry-point

**Severity**: warning | **Applies to**: fractal and hybrid nodes

- Every fractal/hybrid node MUST have an entry point: `index.ts` (barrel) or `main.ts` (executable/CLI).
- Only symbols exported from the entry point are the module's public contract.
- Consumers MUST import from the entry point, never from internal files.
- organ and pure-function nodes do NOT require an entry point.

### max-depth

**Severity**: error | **Default maxDepth**: 10

- Fractal tree depth MUST NOT exceed `maxDepth`.
- Fix: flatten structure, extract deeply nested modules to top-level, or increase `maxDepth` in
  `.filid/config.json` only when genuinely justified.

### circular-dependency

**Severity**: error | **Applies to**: all modules

- The dependency graph MUST be a DAG. Circular dependencies are prohibited.
- Detected at project-analyzer level (`detectCycles()`), not per-node evaluation.
- Fix: extract shared logic to a new node, invert dependency via interface/event, or merge tightly coupled modules.

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
- Section headings (`## Purpose`, `## Structure`, `## Conventions`, `## Boundaries`,
  `### Always do`, `### Ask first`, `### Never do`, `## Dependencies`) MUST remain in English
  — they are machine-readable anchors for the validator.
  All descriptive content MUST follow the language specified by the `[filid:lang]` tag
  (configured in `.filid/config.json`). If no tag is present, follow the system's language setting; default to English.

### DETAIL.md

- MUST NOT grow append-only. Each update MUST restructure to reflect current state.
- Defines public API contract, acceptance criteria, and scope boundaries.
- MUST reflect current intended behavior, not historical evolution.
- Update DETAIL.md **before** code changes. Update INTENT.md when boundaries change.
- Section headings (`## Requirements`, `## API Contracts`, `## Last Updated`) MUST remain in English.
  All descriptive content MUST follow the language specified by the `[filid:lang]` tag
  (configured in `.filid/config.json`). If no tag is present, follow the system's language setting; default to English.

---

## Quality Thresholds

| Metric | Threshold | Action |
|---|---|---|
| LCOM4 (Lack of Cohesion) | >= 2 | Split into separate modules |
| Cyclomatic Complexity | > 15 | Compress or abstract |
| File size | > 500 lines | Consider splitting |

**Test file conventions (3+12 rule)**: max **3 basic** (happy path) + **12 complex** (edge cases) = **15 total** per spec file. Exceeding 15 signals the module should be split.

---

## Structure Principles

- **New module** → MUST create INTENT.md (3-tier boundaries) + index.ts (barrel export).
- **Leaf utility dirs** (`components/`, `utils/`, `types/`) → organ: no INTENT.md, keep flat.
- **Shared code** → MUST be placed at the nearest common ancestor (LCA) of its consumers.
- **No direct sibling imports** → MUST route through the parent module's public entry point.
- **New file in fractal root** → MUST go into an existing organ or new sub-fractal; MUST NOT leave as peer file unless in an allowed category.

---

## Development Workflow

Before any implementation that touches a fractal module:

1. Identify all affected fractal modules.
2. Update DETAIL.md with new or changed requirements.
3. Update INTENT.md if the module's public interface or boundaries change.
4. Implement the change.
5. Run `/filid:filid-scan` to confirm no new violations.

Use `/filid:filid-sync` for structural drift, `/filid:filid-setup` for project initialization, `/filid:filid-review` for architectural review.
