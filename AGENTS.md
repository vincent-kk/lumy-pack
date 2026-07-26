<!-- FILID:START:filid_fca-policy.md -->
# FCA-AI Rules

**Every module is a fractal. Every boundary is enforced. The graph is a DAG.**

- Modules document themselves (`INTENT.md`) and define contracts (`DETAIL.md`).
- Consumers import through entry points; files inside a module import each other directly.
- Documentation precedes code. `INTENT.md` ≤ 50 lines. Spec files ≤ 15 cases.

Fractal Context Architecture (FCA-AI) is a recursive module organization system for AI-operated codebases. Every independent module is a "fractal node" with documentation, entry point, and boundary rules. The dependency graph MUST be a DAG. External consumers MUST import only from a module's entry point, never its internal files; files within the same module import each other directly.

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

Structural rules the scanner evaluates against every node — enable/disable and set severity in `.filid/config.json`: `{ "rules": { "<rule-id>": { "enabled": true|false } } }` Naming and depth checks are configured the same way as the rules below; acyclicity (the DAG requirement above) is a discipline the scan does not yet verify — trace the edges you touch rather than trusting a green run.

### organ-no-intentmd

**Severity**: error | **Applies to**: organ nodes

- Organ nodes MUST NOT contain INTENT.md.
- If an organ needs independent documentation, reclassify it as `fractal`.

### index-barrel-pattern

**Severity**: warning | **Applies to**: fractal and hybrid nodes with index.ts

- `index.ts` in fractal/hybrid nodes MUST be a pure barrel — named re-export statements only, with no direct function, class, constant, or type declarations. The scan checks this shape; which symbols belong in the public surface is a separate concern.
- Does NOT apply to organ or pure-function nodes.

### module-entry-point

**Severity**: warning | **Applies to**: fractal and hybrid nodes

- Every fractal/hybrid node MUST have an entry point: `index.ts` (barrel) or `main.ts` (executable/CLI).
- A framework-invoked entry file (e.g. Next.js `page.*`/`route.*`) also satisfies the requirement when a framework is detected. Projects MAY register more via `.filid/config.json` `additional-entry-points`.
- External consumers MUST import from the entry point, never from internal files. Files inside the module import their peers directly — the local barrel serves outside consumers, not internal routing. Internal implementation files import concrete internal files directly, not through the local `index.ts`; the local `index.ts` is an external boundary, not a default indirection layer.
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
- `## Structure` SHOULD call out name traps when present (e.g., "entry point is `cli.ts`, NOT `index.ts`") — one line that pre-empts the most expensive misread.
- `## Conventions` SHOULD rank the module's tradeoff priorities when they exist (e.g., "when making tradeoffs, in order: 1. correctness 2. throughput") — a decision rule guides an agent further than any list of actions.
- Section headings (`## Purpose`, `## Structure`, `## Conventions`, `## Boundaries`, `### Always do`, `### Ask first`, `### Never do`, `## Dependencies`) MUST remain in English — machine-readable anchors for the validator.
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

**Test file conventions (15-case rule)**: at most **15 cases** per spec file — the scan gate checks the total only; "~3 basic + ~12 complex" is the recommended shape, not a separately enforced pair. Exceeding 15 signals the spec (or module) should be split. Never delete or omit a needed test to satisfy the cap — coverage outranks the cap; split the spec file instead.

---

## Structure Principles

- **New module** → MUST create INTENT.md (3-tier boundaries) + index.ts (barrel export).
- **Leaf utility dirs** (`components/`, `utils/`, `types/`) → organ: no INTENT.md, keep flat.
- **Shared code** → MUST be placed at the nearest common ancestor (LCA) of its consumers.
- **Sibling imports** → import the sibling's own entry point (`../sibling`), never its internals — and never route through the shared parent's entry point (the parent barrel re-exports you; that path is a cycle).
- **New file in fractal root** → MUST go into an existing organ or new sub-fractal; MUST NOT leave as peer file unless in an allowed category.

---

## Development Workflow

Before any implementation that touches a fractal module:

1. Identify all affected fractal modules.
2. Update DETAIL.md with new or changed requirements.
3. Update INTENT.md if the module's public interface or boundaries change.
4. Implement the change.
5. Run `/filid:scan` and clear new findings — `warning` findings count as findings; do not declare compliance while they remain.
<!-- FILID:END:filid_fca-policy.md -->

<!-- SEIRI:START:seiri_agent-legible.md -->
# Agent-Legible Code

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

Code is read by agents and newcomers who hold no tribal memory: what a file does not show, they guess. This rule rests on properties every codebase has: code lives in files with names and paths, and symbols are defined and referenced.

**Applies when:** the change is intended to land in version control.

## 1. State the invisible wiring

**When behavior is bound by position, name, or registration — write down where the binding lives.**

- Name the mechanism in one line at the file's entry (or its module doc): `loaded by <mechanism>; <path/name/annotation> determines <what>`.

Ask yourself: "Could a reader with only this file and its imports predict when this code runs?"

## 2. Give every repeated block a unique anchor

**In repetitive structures, order is not an address.**

- Give each near-identical instance a distinct handle — a name, a key, or an adjacent marker unique to it; across copies (source vs generated), state which one is canonical.

Ask yourself: "If I asked someone to edit the third block, could they pick the wrong one?"

## 3. Defuse name traps

**When a name will mislead, fix the name — or post a warning where the misleading happens.**

- Prefer renaming toward the convention; when that is out of scope, one line at the point of confusion: `entry point is <X>, not <Y>`.

Ask yourself: "What would someone reasonably assume from this name — and is that assumption true?"

## 4. Prefer the direct reference

**When a direct call and an indirect mechanism are equally capable, choose direct.**

- Indirection the architecture or framework demands is not yours to remove — label it (rule 1) and move on.

Ask yourself: "Can a reader follow this reference with plain text search?"

## 5. Keep one unit graspable in one sitting

**A unit should be understandable alone: purpose from its name and head, dependencies from its imports, effect from its exports.**

- When one file needs several others open at once, split it or localize what it depends on.

Ask yourself: "Can I state what this file does without opening a second file?"

---

**This rule is working if:** edits land on the intended instance on the first attempt; a new file's run-conditions can be stated from the file alone; plain text search finds a feature's wiring. **This rule is wrong for you if:** the indirection you want to remove IS the framework — label framework conventions and leave them standing.
<!-- SEIRI:END:seiri_agent-legible.md -->

<!-- SEIRI:START:seiri_public-contract.md -->
# Public Contract

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

What a module exports is a promise to every present and future consumer. This rule rests on a property every codebase with a module system has: a distinction exists between what is public and what is internal.

**Applies when:** the language or module system in use has an export or visibility mechanism.

## 1. Export only what has a consumer

**An export with no consumer carries a stated intent — or gets removed.**

- Remove leftover your change added or orphaned; leave a pre-existing one for a deliberate cleanup (seiri_reuse-first §3). Usage is tool-checkable; intent you must write.

Ask yourself: "Who consumes this — and if no one yet, where did I say so?"

## 2. Name every re-export

**A contract you cannot enumerate is not a contract.**

- Wildcard re-exports hide the surface three ways: a new symbol in an internal file silently widens the contract; duplicate names across re-exported files drop silently; and text tools lose the symbol list at the boundary. Entry points list what they export, by name.

Ask yourself: "Can I read the public surface without resolving a wildcard?"

## 3. Entry points declare, internals implement

**The set of symbols reachable from the entry point IS the public contract; everything behind it is free to change.**

- An entry point holds re-exports and wiring, not implementation; consumers outside the module hold only entry-point symbols.

Ask yourself: "If I renamed every internal file, would any consumer break?"

## 4. Framework-invoked files are entry points too

**A file the framework calls by convention is public surface, even though no import names it.**

- Routes, pages, handlers, plugin manifests: treat changes to their exported shape as contract changes, and label the convention that invokes them (seiri_agent-legible §1).

Ask yourself: "What breaks at runtime if I change this export's shape — and would any import have warned me?"

---

**This rule is working if:** the public surface can be enumerated by reading entry points; removing an internal symbol breaks no consumer; review diffs show contract changes as changed lines in an export list. **This rule is wrong for you if:** the code is a single-file script or notebook with no module boundary — there is no contract to keep small.
<!-- SEIRI:END:seiri_public-contract.md -->

<!-- SEIRI:START:seiri_test-validity.md -->
---
paths:
  - '*.test.*'
  - '*.spec.*'
  - '*_test.*'
  - '*_spec.*'
  - 'test_*.*'
  - '*Test.*'
  - '*Tests.*'
  - '*Spec.*'
  - 'conftest.py'
  - '__tests__'
  - 'test'
  - 'tests'
  - 'spec'
  - 'specs'
  - 'e2e'
---

# Test Validity

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

A passing test is evidence only if it could have failed. These rules define when a test counts as verification. This rule rests on a property every codebase has: a means of verification exists and can be run.

**Tradeoff:** one extra verification step per test, in exchange for tests that mean something. **Applies when:** the change is intended to land in version control.

## 1. Fail first, then fix

**A fix's test is valid only if it fails without the fix — for the bug's reason.**

- Before finishing a bug fix, run its test against the pre-fix code and watch it fail. Use a scoped mechanism (revert locally, stash only the changed files, or a scratch worktree) — never disturb unrelated work.
- The failure must be the bug's symptom — not a setup error, a wrong path, or a missing import. When the fix introduces a new symbol, the expected pre-fix failure IS that symbol's absence.
- Refactors invert the contract: existing tests MUST pass unmodified before and after. Pin current behavior with added characterization tests BEFORE moving code — adding tests is fine; editing existing assertions is not.

Ask yourself: "Have I watched this test fail for the reason the bug exists?"

## 2. Verify the artifact you changed

**Verification against the wrong build always passes.**

- Use this repository's own designated verification command — the one its instructions or tooling name. Wrappers carry environment, build steps, and flags that raw tools lack; a raw-tool pass is diagnostic, never the final evidence.
- Confirm the harness exercises your modified code — not a stale build, an installed copy, or a cached artifact. If unsure, break your change deliberately once in a unit-scoped check and revert the probe: the run must go red. If it stays green, you are testing some other copy.

Ask yourself: "Is this command exercising the code I just edited?"

## 3. A snapshot is a claim, not a recording

**A snapshot captured from buggy code certifies the bug.**

- A regenerated snapshot is an assertion you are authoring. Read the diff; be able to defend every changed line, or do not commit it.
- Never regenerate snapshots to turn a run green without stating, in the diff or the change description, why the new output is the correct output.

Ask yourself: "Can I defend every changed line of this snapshot?"

## 4. Skips are loud

**A silent skip reports PASSED.**

- A test that cannot run in the current environment is a skip with a reason string, through the harness's own skip mechanism. A bare early return or a commented-out assertion converts a missing test into a green one.

Ask yourself: "If this test silently stopped testing, would anyone know?"

## 5. Every clause of a fix is load-bearing

**For each clause of your fix, some test must break when it is removed.**

- Delete each load-bearing clause (mentally or actually): at least one test must go red for each. A clause no test requires is untested or unnecessary.
- The same check applies to defensive code in module internals: a guard no internal path can reach is scope creep in a safety vest. Trust-boundary validation (public APIs, user input, external data) is exempt — exported symbols cannot enumerate their callers.

Ask yourself: "Which test breaks if I remove this line?"

## 6. Tests are curated, not accumulated

**A suite that only ever grows is drifting toward noise.**

- If this repository declares a per-file or per-suite limit, follow that limit. Otherwise apply the direction only: a test file that keeps growing is a signal to split by behavior or to merge duplicates into a parameterized form.
- Never delete or omit a needed test to satisfy tidiness — coverage outranks curation. Curate by merging and splitting, not by discarding.

Ask yourself: "Is this file accumulating cases, or organizing them?"

---

**This rule is working if:** your tests fail before your fixes and pass after; snapshot diffs are explained; skipped tests say why; deleting any part of a fix turns something red. **This rule is wrong for you if:** the code is a throwaway spike that will never be committed — then remember only that a test you never saw fail proves nothing either way.
<!-- SEIRI:END:seiri_test-validity.md -->

<!-- SEIRI:START:seiri_reuse-first.md -->
# Reuse First

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

The best code for this repository usually already exists in it. This rule rests on a property every codebase has: a change is a diff, and it answers a request.

**Applies when:** the change is intended to land in version control.

## 1. Search first, compose second, write last

**Evaluate solutions in this strict order:**

1. **Reuse** existing shared code — utilities, helpers, modules already here, or libraries already installed.
2. **Extend safely** — additive only: optional parameters, new exports, wrappers. Preserve current behavior; no silent semantic change to an existing interface.
3. **Mirror the closest proven pattern** in this repository — unless it is clearly outdated or defective; then say so rather than copy it.
4. **Adopt the ecosystem-standard approach** — official documentation and maintainer guidance over ad-hoc examples.
5. **Write new code** — when the problem is genuinely novel here.

Ask yourself: "Does this already exist somewhere I haven't searched?"

## 2. The smallest code that answers the request

**Nothing speculative.**

- Validation at trust boundaries (public APIs, user input, external data) is never speculative — exported symbols cannot enumerate their callers.

Ask yourself: "Would a senior reviewer call this overbuilt?"

## 3. Surgical changes

**Every changed line traces to the request.**

- Remove what YOUR change orphaned; leave pre-existing dead code in place, mentioned, not buried in an unrelated diff.

Ask yourself: "Can I map each changed line back to the request?"

## 4. Work toward a verifiable goal

**Restate the task as something checkable before you start.**

- "Add validation" becomes "these invalid inputs are rejected, shown by a failing-then-passing check"; "fix the bug" becomes "a reproduction exists, then passes".

Ask yourself: "How will I know — mechanically — that I am done?"

## 5. One file, one responsibility

**A file answers for one thing.**

- If naming the file honestly needs "and", it is two files.

Ask yourself: "If this file grows one more export, should it split?"

---

**This rule is working if:** diffs read as direct answers to their requests; new code is hard to tell apart from the code around it; the utility you almost wrote turns out to already exist, found. **This rule is wrong for you if:** you are scaffolding a greenfield repository — there is nothing to reuse yet; apply §2 and §4 and return here once the first patterns exist.
<!-- SEIRI:END:seiri_reuse-first.md -->

<!-- SEIRI:START:seiri_naming.md -->
# Naming

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

Names are the primary index of a codebase: what search finds, what imports show, what readers guess by. This rule rests on properties every codebase has: files and symbols have names, and an existing style is already present — whatever it is.

**Applies when:** the change is intended to land in version control.

## 1. Mirror the siblings

**Before naming anything, read the names around it.**

- Match the case, the grammar (verb-first or noun-first), the suffix, and the singular/plural habits of sibling files and symbols of the same kind. No siblings? The idiomatic form of the language or framework. A migration in progress? The declared target style, not the majority.

Ask yourself: "What style do my neighbors already use?"

## 2. A name states one concrete responsibility

**A reader should predict the content from the name alone.**

- Name by what the unit does or holds, not when it was added or who owns it. An honest name that needs "and" is two units (seiri_reuse-first §5); a vague honest name means a vague responsibility — fix the unit.

Ask yourself: "Reading only this name, what would I expect inside — and is that what's inside?"

## 3. No grab-bags

**Names that can hold anything end up holding everything.**

- Avoid `common`, `misc`, `util2`, `temp`, `new`, `stuff`, `extra` and their kin — they defeat search and accrete unrelated content. Three helpers for date math are `date-math`, not `helpers2`.

Ask yourself: "Could a stranger guess what does NOT belong in this file?"

## 4. Derived names follow their source

**A file that exists because of another carries that other's base name.**

- Tests, specs, fixtures, and generated companions are named for what they verify or accompany, and rename with their source — a base name that matches nothing is a name trap (seiri_agent-legible §3).

Ask yourself: "From this file's name, can I find the file it serves?"

---

**This rule is working if:** you can locate a feature by guessing its name; new files look native to their directory; a rename never leaves orphaned companions behind. **This rule is wrong for you if:** a generator names these files — then the generator's convention IS the sibling convention; configure the generator, don't fight its output.
<!-- SEIRI:END:seiri_naming.md -->

<!-- SEIRI:START:seiri_structure.md -->
# Structure

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

Structure is the cost model of reading: every hop, level, and cycle is paid by whoever comes next. This rule states directions only — where this repository (or its architecture tooling) declares concrete limits, those limits win. This rule rests on properties every codebase has: files have sizes and paths, and symbols reference one another.

**Tradeoff:** structural moves (splits, extractions) create churn today to reduce reading cost tomorrow; prefer them at natural seams, not mid-task. **Applies when:** the change is intended to land in version control.

## 1. Dependencies form a DAG

**A cycle is two units pretending to be one.**

- When A needs B and B needs A, no reading order exists: extract the shared piece into a third unit, invert one edge behind an interface or event, or merge the two honestly.
- Do not certify acyclicity by tooling you have not run; trace the edges you touched.

Ask yourself: "Can I order these units so every reference points one way?"

## 2. Depth is a toll

**Nest to expose structure, not to file things away.**

- Every directory level is a hop a reader pays on every visit. If this repository declares a depth limit, follow it; otherwise apply the direction: when following one call chain means descending many levels, flatten.
- A directory with one child is a corridor, not a room — collapse it.

Ask yourself: "Does each level of this path tell the reader something?"

## 3. Cohesion splits, complexity compresses

**Two different smells, two different moves.**

- When parts of a unit do not share state or purpose, the unit is several units: split it. If this repository (or its architecture tooling) declares a cohesion measure and threshold, follow those; otherwise split where the seams already show.
- When one unit branches beyond what a reader can simulate, compress: extract steps, replace condition ladders with tables or dispatch, name the phases. If a complexity threshold is declared, follow it; otherwise let "can I simulate this in my head?" be the trigger.

Ask yourself: "Am I looking at two things glued, or one thing tangled?"

## 4. Growth is a signal

**A file that keeps growing is announcing a boundary.**

- If this repository declares a file-size limit, follow it. Otherwise apply the direction: recurring growth in one file means a responsibility wants out — split along the responsibility seam, not at an arbitrary line count.

Ask yourself: "What part of this file keeps attracting changes — and is it the same part I opened it for?"

---

**This rule is working if:** following a call chain rarely reverses direction; finding code takes few hops; splits land at seams reviewers recognize without explanation. **This rule is wrong for you if:** the tree is vendored or generated — a generator owns that structure; change the generator or leave it be (see seiri_context-efficiency §1).
<!-- SEIRI:END:seiri_structure.md -->

<!-- SEIRI:START:seiri_function-boundaries.md -->
# Function Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

A function is the smallest unit a reader can hold whole — and the cheapest one to get wrong, because the cost lands on its callers. This rule rests on properties every codebase has: functions take inputs and produce outputs, and they live in files with names.

**Tradeoff:** purity moves effects, it does not remove them — a program that touches nothing does nothing. Push effects outward until they sit in one named place, not until every layer needs a wrapper. **Applies when:** you are writing or moving a function.

## 1. Inputs arrive as parameters

**The signature is the full list of what a function can see.**

- Compute from arguments. Module state read at call time, ambient config, the clock, the environment: passed in, not reached for.
- When a dependency genuinely cannot be passed — a framework injects it, a runtime owns it — say so at the function or its file head (seiri_agent-legible §1) instead of reaching through it silently.

Ask yourself: "Given the same arguments, does this return the same thing?"

## 2. Effects live at the edge

**Pure by default; effectful on purpose, in one named place.**

- I/O, module-state writes, mutation of what the caller owns: keep them in functions whose names announce them, called from the outer layer — not sprinkled through the computation they serve.
- Mutating an argument is an unwritten output. Return the new value, or make the mutation the function's stated purpose.
- A function that both computes and persists is two functions and a caller.

Ask yourself: "If this ran twice, what would differ the second time — and does the name warn me?"

## 3. One file, one exported function

**The file name is the export list.**

- Name a function file for the function it exports, and export that one only (seiri_naming §4). A second export earns its place only when the two cannot be read apart.
- At most two unexported helpers may share the file, and only ones a reader takes in at a glance; past that, the helper is its own file (seiri_structure §3).
- At most three types, newly defined here. Derived types — aliases, narrowings, unions over what already exists — stay with their source. Type-only files (`types.ts`, `types/`) are outside this budget.
- These counts are defaults; a budget this repository declares wins.

Ask yourself: "Can I name what this file exports without opening it — and can I find every caller by searching that one name?"

## 4. A helper that moves out moves down

**Extraction is not relocation to the same shelf.**

- Helpers pulled out of a function do not become its flat neighbors: give the function a directory and file them one level under it, in a satellite called `utils/` or `helpers/` while its only claim is "these serve the function above" — named for the topic once the set has one (seiri_naming §3).
- The path states which function is served and which serves. A row of peers states nothing (seiri_structure §2).

Ask yourself: "From the path alone, can I tell the entry point from its helpers?"

---

**This rule is working if:** tests call functions without building a world first; a file's imports stay countable at a glance; the caller of a helper sits one directory up, every time. **This rule is wrong for you if:** the framework owns the unit — components, route handlers, and generated clients follow their framework's shape; apply §1 and §2 inside them and leave the file layout to the convention.
<!-- SEIRI:END:seiri_function-boundaries.md -->

<!-- SEIRI:START:seiri_context-efficiency.md -->
# Context Efficiency

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

Context is the scarcest resource in an agent session: performance degrades as it fills, and every wasted read crowds out instructions already given. This rule rests on a property of every session, not of any codebase: context is finite, and reading spends it.

**Tradeoff:** these rules bias toward fewer, more deliberate reads. When genuinely disoriented, one broad read beats three wrong guesses. **Applies when:** you are an agent operating on a repository.

## 1. Generated artifacts are search-only

**Build output is not source. Fix generators, not their output.**

- Generated output (build directories, compiled bundles, coverage reports, generated clients): search it to trace a symbol; do not read it wholesale; never edit it. An edit there disappears on the next build — and a bug found there may already be fixed in its source.
- Installed dependencies and lockfiles are a different class: dependency sources and type definitions are canonical references — read them when the dependency's contract is the question. Never hand-edit a lockfile; change the manifest and regenerate through the package manager.
- When a generated file is wrong, the deliverable is a change to its generator or template.

Ask yourself: "Would this file survive a clean build?"

## 2. Capture once, read from the file

**Re-running a command to re-read its output pays twice.**

- Never re-run the same long command just to grep its output differently. Capture once to a scratch file outside the repository tree, then search and re-read from that file. Repo-root log files pollute status and reviews.
- A capture goes stale the moment relevant code changes — re-run after edits; judging a post-fix state from a pre-fix capture is self-deception. Investigating flaky behavior is the legitimate reason for repeated runs.

Ask yourself: "Did I already have this output and throw it away?"

## 3. Re-reads need a reason

**Change, external modification, or genuine doubt — not habit.**

- Do not re-read what has not changed. After compaction or a long session, re-reading before an edit is a reason — habit is not.
- Read the range the task needs; a targeted read plus a follow-up beats loading whole files by default.
- Before broad exploration, state what you are looking for; stop when you find it — after confirming it is the only candidate. A first match is not proof of uniqueness.

Ask yourself: "What new fact will this read give me that the last one didn't?"

---

**This rule is working if:** generated directories never appear in your edits; long outputs are quoted from capture files; every re-read can name its reason. **This rule is wrong for you if:** you have lost orientation — take the one broad read, reorient, and return to targeted reads.
<!-- SEIRI:END:seiri_context-efficiency.md -->

<!-- SEIRI:START:seiri_cognitive-discipline.md -->
# Cognitive Discipline

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

Behavioral guardrails against rationalization in long agent sessions. This rule rests on a property of every session, not of any codebase: a claim about code can be checked against the code and its oracles — text you generate is not evidence.

**Tradeoff:** verification over speed. For a trivial task you may scale a check down — but only out loud: name the check you are skipping and why. A silent skip is the failure mode this rule exists to block. **Applies when:** you are an agent operating on a repository.

## 1. Evidence over confidence

**Don't claim. Verify — with this repository's own oracles — then cite.**

- A claim without observable evidence is a prediction. Observable means tool output, test results, file contents — not your reasoning about them.
- Each quality attribute needs its own evidence: a linter pass is not a build; one test is not the suite; a path recalled from memory is a guess until a tool confirms it exists.

Ask yourself: "What observable output backs this sentence?"

## 2. Causes, not symptoms

**Fix where it started, not where it surfaced.**

- Where an error appears and where it lives are usually different places. "I see the problem, let me fix it" almost always means you see the symptom.
- Repeated failure of the same approach indicts the approach. When each fix reveals a new problem elsewhere, stop patching and question the underlying assumption.

Ask yourself: "Am I patching where it broke, or where it started?"

## 3. Read before you adapt

**Skimming a pattern produces a misapplied pattern.**

- Fully read what you copy or adapt. Navigation may stay targeted; comprehension of what you reuse may not.
- Simple tasks bypass the scrutiny complex ones attract — which is exactly how simple tasks break things. "Too simple to check" is a rationalization, not an assessment.

Ask yourself: "Have I read the whole reference, or am I pattern-matching its shape?"

## 4. The letter is the spirit

**"While I'm at it" is scope creep. Sunk cost is not value.**

- When a rule or request names a concrete action, the concrete action is required — "I followed the spirit" is how the letter gets skipped.
- The requested scope is the entire scope; propose extras separately.
- Work already done has no claim on being kept. When the approach is wrong, discard it — adaptation inherits the defect.

Ask yourself: "Is this in scope, or am I justifying creep?"

## 5. Honest over agreeable

**Disagree with reasoning; say "I don't know" instead of guessing.**

- Reflexive agreement is not analysis. Restate the requirement, ask, or push back with grounds.
- Shipping work you are unsure of without disclosure is deception by omission. Disclosed uncertainty plus a check that would catch the failure is the acceptable form of proceeding.

Ask yourself: "Am I agreeing because it's correct, or because it's expected?"

## Rationalizations

| Excuse                            | Reality                                                  |
| --------------------------------- | -------------------------------------------------------- |
| "Should work now"                 | Run the verification.                                    |
| "I'm confident"                   | Confidence is not evidence.                              |
| "Too simple to test"              | Simple changes break builds too.                         |
| "The linter passed"               | The linter is not the build, the build is not the suite. |
| "I already did this manually"     | Unrecorded checks cannot be re-run or cited.             |
| "Just this once"                  | This once is every time under pressure.                  |
| "I followed the spirit"           | The letter IS the spirit.                                |
| "Deleting X hours feels wasteful" | Keeping unverified work is the waste.                    |

## Red flags — stop and verify

Saying "probably / should / seems to" about your own change · declaring success without fresh output · a fix touching the same symptom a second time · wanting the task to be over.

---

**This rule is working if:** claims cite tool output; pushback comes with reasoning; fixes do not reappear in new places; skipped checks are skipped out loud. **This rule is wrong for you if:** never — but its checks scale down out loud for trivial work; what never scales down is saying so.
<!-- SEIRI:END:seiri_cognitive-discipline.md -->
