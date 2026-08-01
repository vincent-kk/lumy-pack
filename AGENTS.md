<!-- FILID:START:filid_fractal-boundaries.md -->
# Fractal Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. Fractal Context Architecture organizes a codebase as nested independent modules: a fractal owns a contract and a public boundary; an organ is an internal compartment owned by exactly one fractal. This rule rests on properties every codebase has: directories contain files, and files reference one another. Applies when the repository has adopted FCA — module documents or a filid configuration are present. Companions: `filid_module-documents.md` (INTENT/DETAIL contracts), `filid_verification-records.md` (verification roles and caps), `filid_code-placement.md` (where a unit belongs and how it moves).

## 1. Classification comes from files that exist

| Type            | INTENT.md | Children | Entry point  | Meaning                                   |
| --------------- | --------- | -------- | ------------ | ----------------------------------------- |
| `fractal`       | required  | allowed  | required     | Independent module with a public contract |
| `organ`         | forbidden | files (nested dirs classify on their own) | not required | Internal compartment owned by one fractal |
| `pure-function` | optional  | none     | not required | Explicitly isolated effect-free unit      |
| `hybrid`        | optional  | allowed  | required     | Manually assigned transitional node       |

Resolve in this strict order: (1) `INTENT.md` present → fractal; (2) `DETAIL.md` present → fractal — a missing-INTENT signal; (3) double-underscore-wrapped or dot-prefixed infrastructure name → organ; (4) name in the known organ list → organ; (5) a registered adapter reports a **module** index → fractal; (6) a leaf directory with no fractal children → organ; (7) an adapter proves both statelessness and no side effects → pure-function; (8) otherwise → organ.

- Step 5 reads module entries only. Executable, framework and manifest entries — and any `entryPointOverrides` path — feed the entry-point surface, never classification; otherwise markdown-as-implementation (a skill document) would turn a prose directory into a fractal.
- Step 6 precedes purity on purpose: a leaf that never claimed isolation is an organ even when nothing in it has an effect. Step 8 defaults to organ on purpose: a directory that declares neither a document nor an index has never claimed an independent contract.
- Default organ names: `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`, `test`, `tests`, `spec`, `specs`, `fixtures`, `e2e`. Docs-as-code names (`references`, `docs`, `plans`) are deliberately absent — adding one would silently reclassify a real code module of that name. Config extends the list via `structure.additionalOrganNames`.

## 2. Classification describes; it never prescribes

Traversal continues inside organs: a nested directory with its own documents or module index is reclassified as its own fractal. `hybrid` is never auto-assigned, and an unproven purity analysis stays an organ. What a node _should_ be is a rule result, not a classification: an organ consumed from outside its owner's subtree is reported with the consumer paths as evidence, never silently reclassified — which is what lets a non-FCA codebase be adopted.

## 3. A fractal is crossed through its entry point

- Every fractal and hybrid has an adapter-reported module, executable, framework or manifest entry point; organs and pure-function nodes need none.
- A package manifest is an entry point: where the ecosystem declares the package's public surface in its manifest, that declaration IS the boundary. A manifest entry states a surface; it does not classify.
- The public surface is adapter-inspectable: an enumerated surface declares its exports by name, and widening it is a contract change. An opaque or unsupported framework surface keeps its uncertainty instead of passing.
- Sibling fractals import the sibling's entry point — never an internal file, and never a shared parent barrel that re-exports the sibling.
- Inside one fractal, files import concrete internal peers directly, not their own local entry point.

## 4. A fractal root holds documents and entry points, not code

A fractal root contains its documents, adapter-reported entry points, at most one eponymous implementation, and adapter-confirmed framework peers. Any other implementation file belongs in an organ or a child fractal, unless config grants a scoped allowed-peer override.

## 5. Organ access is judged by where the consumer sits

An organ has no entry point, so "route through the entry point" cannot apply to it.

| Consumer                   | Path                            | Verdict                            |
| -------------------------- | ------------------------------- | ---------------------------------- |
| Inside the owner's subtree | organ file, directly            | allowed                            |
| Outside                    | the owner fractal's entry point | allowed — needs a retention reason |
| Outside                    | organ file, directly            | violation — unless exempted        |

- Inside the owner's subtree a nested fractal may import an organ's concrete files directly — that is the shape lowest-common-fractal placement produces.
- A unit with external consumers naturally belongs at _their_ lowest common fractal, so staying put is a deliberate choice that carries a reason. A direct import from outside is sometimes correct — the standing case is a build whose target the entry point cannot represent — but it is declared, not assumed. Both declarations live in the owning fractal's `DETAIL.md` (entry shape in `filid_module-documents.md`). An organ consumed from outside with neither declaration has an external boundary: the finding names both resolutions — promote it to a fractal, or move it to its consumers' lowest common fractal — and cites the consumer paths.
- The same declaration covers a fractal's internals: a consumer barred from the entry point by something the boundary cannot represent declares the exemption rather than widening the contract. Undeclared, it stays a violation.
- **A verification file is not judged by this rule at all, and its references do not close a cycle.** Checking an internal unit means reaching it; the alternative exports internals for tests alone. Which files are verification comes from the adapter, not from a filename pattern.

## 6. The graph is acyclic and depth is a toll

- Dependency edges point from consumers to entry points and form a DAG; a reported cycle carries its source files and resolved dependency evidence.
- A node stays within the configured structural depth, measured from the scanned project root over classified nodes.
- A pure-function node depends on no fractal or hybrid; where isolation cannot be proven, reclassify the node or pass its dependencies in as inputs.
- Where evidence is missing the answer is `indeterminate` — and `indeterminate` and `unsupported` are never converted to a pass.

---

**This rule is working if:** a directory's type can be predicted from its files before any tool runs, and every organ used from outside carries a declaration that says why. **This rule is wrong for you if:** the repository has not adopted FCA — then a scan names the fractals that are missing, and nothing here binds until you decide to add them.
<!-- FILID:END:filid_fractal-boundaries.md -->

<!-- FILID:START:filid_module-documents.md -->
---
paths:
  - 'INTENT.md'
  - 'DETAIL.md'
---

# Module Documents

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. INTENT records the boundary; DETAIL records the current contract and, when a change is worth remembering, the history behind it. This rule rests on a property every FCA project has: a module's contract is written down in a file next to the code it governs. Applies when you are creating or editing an `INTENT.md` or a `DETAIL.md`.

## 1. INTENT records the boundary; DETAIL records the contract

Two documents, two jobs — neither substitutes for the other. The section headings `Purpose`, `Structure`, `Conventions`, `Boundaries`, `Always do`, `Ask first`, `Never do` and `Dependencies` in INTENT, and `Requirements`, `API Contracts`, `Acceptance Criteria` and `Last Updated` in DETAIL, stay in English; descriptive content follows `[filid:lang]`, defaulting to English. INTENT records only this fractal's own purpose, ownership and boundaries — never a copy of an ancestor's — and updates only when the public boundary or contract changes. When a directory's conventional name misleads, say so in `Structure`.

## 2. INTENT is at most 50 lines and names its three boundaries

A boundary document that needs scrolling is not a boundary document. `INTENT.md` is at most 50 lines and contains `Always do`, `Ask first` and `Never do` sections — a boundary with no "never" has not been decided yet.

## 3. An organ has no INTENT

Independent documentation is a claim to an independent contract. An organ does not contain `INTENT.md`, and does not use INTENT as local documentation. If a directory genuinely needs its own boundary document, that is the signal to reclassify it as a fractal — with an entry point — not to add the file where it stands.

## 4. DETAIL's contract sections are current state, not an append-only ledger

Restructure the contract sections to the currently intended behavior on every update; a superseded clause is removed, not left standing beside its replacement. Update DETAIL before the code it describes. Acceptance groups carry stable IDs, unique within that document. `DETAIL.md` is the sole acceptance-criteria ledger; a legacy `.filid/criteria.md` is reported as such — never auto-deleted, never silently migrated.

## 5. History has one address, and the contract is not it

INTENT carries no history — no changelog, no dated notes; a retired boundary leaves by deletion, not by annotation. The code carries none either. `## History` in DETAIL is the one place the past is written down: optional, below the contract sections and above `## Last Updated`, entries newest first, recording the decision and the reason it was taken or reversed — the diff itself is version control's job. An entry that no longer informs a present decision is dropped, not archived deeper. A history entry accompanies the contract change that produced it; an edit that only appends an entry is the append-only pattern §4 rejects.

## 6. An exemption without a reason is a disabled rule in costume

`Reason` is the load-bearing field. `Boundary Exemptions` is conditional — present only when this fractal actually grants one (`## Organ Exemptions` is the same syntax under this section's former name and is still read); a fractal that needs one and has no `DETAIL.md` adds the document for this purpose. The target is an organ path or a path inside this fractal — a path names itself and everything under it. Write the target path, each consumer and the direct-import verdict inside a code span: a markdown formatter reads a bare `__tests__` as emphasis and silently corrupts the heading; the span survives the formatter, and the parser strips it before comparing. An entry uses the acceptance-group shape, so one parser reads both:

```md
## Boundary Exemptions

### `<target path>` — <short title>

- **Consumers**: <paths or globs, or `entry-point` when access is through the barrel>
- **Direct import**: `allowed` | `not allowed`
- **Reason**: <why the barrel cannot serve these consumers, or why the unit has not
  moved to its consumers' lowest common fractal>
```

A missing or empty `Reason` is an unmet contract, not a granted exemption.

---

**This rule is working if:** every fractal's boundary fits on one screen, and the only past tense in the tree sits under a `## History` heading. **This rule is wrong for you if:** the directory is an organ, or a part of the tree that has not adopted FCA — then it has no contract of its own to document, and adding one is the wrong move.
<!-- FILID:END:filid_module-documents.md -->

<!-- FILID:START:filid_verification-records.md -->
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

# Verification Records

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. A verification file serves one of two roles: a spec-document is the current executable contract; a test-record is QA, regression and incident history. This rule rests on a property every codebase has: verification files exist, and their cases can be counted. Applies when you are creating or editing a verification file.

## 1. Verification files hold roles, not ranks

The adapter assigns the role from the file's content, independent of its filename. Test-records are never promoted into spec-documents — a record of what once broke is not a statement of what must hold.

## 2. A spec-document holds 15 cases; a test-record holds 32 per file

The cap is per file, and it caps cases — not coverage. Project-wide test-record file and case totals are unlimited: nothing here limits how much you verify.

## 3. What cannot be counted is indeterminate, never a pass

A normal case, a skip or a todo counts as one. Statically enumerable parameter rows count by row, and a case inside a static parameterized suite multiplies by that suite's row count. A property declaration counts as one, regardless of how many trials it generates. Dynamic tables, unknown wrappers and ambiguous aliases are `indeterminate` — and `indeterminate` and `unsupported` are never converted to a pass.

## 4. Never remove coverage to meet a cap

Curate by splitting and merging, never by discarding: split test-records by behavior or by incident; organize spec-documents by non-overlapping acceptance groups. Deleting a case to get under a cap trades real verification for a green number.

## 5. Multiple spec-documents bind to distinct acceptance groups

Splitting a file must not split a contract. Sibling spec-documents must not declare overlapping contract group sets, and one acceptance group is never split across files to evade the cap. When a fractal has more than one spec-document, it has a DETAIL document, and each spec-document declares at least one existing DETAIL acceptance group through the adapter-recognized `filid:contract <group-id>` marker.

---

**This rule is working if:** every verification file's role is obvious from its content, and case counts are derivable without running anything. **This rule is wrong for you if:** the file is a throwaway probe that will never land in version control — then no cap applies, because there is no contract to keep.
<!-- FILID:END:filid_verification-records.md -->

<!-- FILID:START:filid_code-placement.md -->
# Code Placement

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. Where a unit sits decides who may reach it: placement is a boundary decision, not a filing decision. This rule rests on properties every codebase has: a unit has a location, and its consumers have locations too. Applies when the repository has adopted FCA and you are adding a unit with more than one consumer, or moving one; prefer the move at a natural seam, not mid-task.

## 1. Shared code sits at the lowest common fractal of its consumers

The consumers' common ancestor is the address; anything higher is a guess. Compute the lowest common fractal of the consumer owners and place the unit under it. A single-consumer internal unit defaults to an organ of that owner — one consumer is not shared code. A unit with an independent public contract becomes a child fractal instead, with its intent, detail and entry-point artifacts.

## 2. An organ cannot be a lowest common ancestor

An organ has no entry point, so it cannot own a shared boundary. When the computed ancestor is an organ, walk up to the nearest enclosing fractal and place the unit there.

## 3. No evidence for a name means a decision is required, not invented

`shared` and `common` are names that can hold anything. When no meaningful organ name is supported by the evidence, the plan sets `requiresDecision: true` and stops for a human — do not invent a grab-bag name to let the plan proceed.

## 4. Planning is read-only; the postcondition demands the exact target

A functionally working but different result is a failed restructure. A plan reports normalized absolute source and target paths, basis, consumers, the computed ancestor, required artifacts, import rewrites and decision reasons; it may write only an ephemeral plan artifact. A precondition checks the snapshot hash immediately before execution. A postcondition checks the exact target, the source's absence, the node type, documents, entry point, import boundary, required rewrites and the acyclic graph. The restructure tool plans and validates; an external actor performs the change.

## 5. The document changes before the code does

Contracts lead; implementations follow. Before implementation that touches a fractal: identify every affected fractal; update each affected DETAIL contract, and INTENT when a public interface or boundary changes; implement the minimum change — for new behavior or a fix, first write a check and watch it fail for the intended reason; run scoped verification and the structural scan (warnings count as findings) and record the result and any deviation from the plan before the next review seam.

---

**This rule is working if:** shared units sit at an ancestor you can derive from their consumers, and DETAIL diffs precede the implementation diffs they describe. **This rule is wrong for you if:** the unit has exactly one consumer and always will — then it belongs beside that consumer, and none of this applies.
<!-- FILID:END:filid_code-placement.md -->

<!-- SEIRI:START:seiri_agent-legible.md -->
# Agent-Legible Code

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Code is read by agents and newcomers with no tribal memory: what a file does not show, they guess. This rule rests on properties every codebase has: code lives in files with names and paths, and symbols are defined and referenced. Applies when the change will land in version control.

## 1. State the invisible wiring

When behavior is bound by position, name, or registration, name the mechanism in one line at the file's entry (or its module doc): `loaded by <mechanism>; <path/name/annotation> determines <what>`.

## 2. Give every repeated block a unique anchor

In repetitive structures, order is not an address. Give each near-identical instance a distinct handle — a name, a key, or an adjacent marker unique to it; across copies (source vs generated), state which one is canonical.

## 3. Defuse name traps

When a name will mislead, rename toward the convention; when that is out of scope, post one line at the point of confusion: `entry point is <X>, not <Y>`.

## 4. Prefer the direct reference

When a direct call and an indirect mechanism are equally capable, choose direct — a reader should be able to follow the reference with plain text search. Indirection the architecture or framework demands is not yours to remove: label it (§1) and move on.

## 5. Keep one unit graspable in one sitting

A unit should be understandable alone: purpose from its name and head, dependencies from its imports, effect from its exports. When one file needs several others open at once, split it or localize what it depends on.

---

**This rule is working if:** edits land on the intended instance on the first attempt, and plain text search finds a feature's wiring. **This rule is wrong for you if:** the indirection you want to remove IS the framework — label it and leave it standing.
<!-- SEIRI:END:seiri_agent-legible.md -->

<!-- SEIRI:START:seiri_public-contract.md -->
# Public Contract

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. What a module exports is a promise to every present and future consumer. This rule rests on a property every codebase with a module system has: a distinction exists between what is public and what is internal. Applies when the language or module system in use has an export or visibility mechanism.

## 1. Export only what has a consumer

An export with no consumer carries a stated intent — or gets removed. Remove leftovers your change added or orphaned; leave a pre-existing one for a deliberate cleanup (`seiri_reuse-first` §3). Usage is tool-checkable; intent you must write.

## 2. Name every re-export

Wildcard re-exports hide the surface three ways: a new symbol in an internal file silently widens the contract; duplicate names across re-exported files drop silently; and text tools lose the symbol list at the boundary. Entry points list what they export, by name.

## 3. Entry points declare, internals implement

The set of symbols reachable from the entry point IS the public contract; everything behind it is free to change. An entry point holds re-exports and wiring, not implementation; consumers outside the module hold only entry-point symbols.

## 4. Framework-invoked files are entry points too

A file the framework calls by convention — routes, pages, handlers, plugin manifests — is public surface even though no import names it. Treat changes to its exported shape as contract changes, and label the convention that invokes it (`seiri_agent-legible` §1).

---

**This rule is working if:** the public surface can be enumerated by reading entry points, and removing an internal symbol breaks no consumer. **This rule is wrong for you if:** the code is a single-file script or notebook with no module boundary — there is no contract to keep small.
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

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. A passing test is evidence only if it could have failed. This rule rests on a property every codebase has: a means of verification exists and can be run. Applies when the change will land in version control.

## 1. Fail first, then fix

A fix's test is valid only if it fails without the fix — for the bug's reason. Before finishing a bug fix, run its test against the pre-fix code and watch it fail; the failure must be the bug's symptom, not a setup error, a wrong path, or a missing import. Use a scoped mechanism (revert locally, stash only the changed files, or a scratch worktree) — never disturb unrelated work. When the fix introduces a new symbol, the expected pre-fix failure IS that symbol's absence.

Refactors invert the contract: existing tests MUST pass unmodified before and after. Pin current behavior with added characterization tests BEFORE moving code — adding tests is fine; editing existing assertions is not.

## 2. Verify the artifact you changed

Verification against the wrong build always passes. Use this repository's own designated verification command — wrappers carry environment, build steps, and flags that raw tools lack; a raw-tool pass is diagnostic, never the final evidence. Confirm the harness exercises your modified code, not a stale build, an installed copy, or a cached artifact: if unsure, break your change deliberately once in a unit-scoped check and revert the probe — the run must go red. If it stays green, you are testing some other copy.

## 3. A snapshot is a claim, not a recording

A snapshot captured from buggy code certifies the bug. A regenerated snapshot is an assertion you are authoring: read the diff and be able to defend every changed line, and never regenerate snapshots to turn a run green without stating why the new output is the correct output.

## 4. Skips are loud

A silent skip reports PASSED. A test that cannot run in the current environment is a skip with a reason string, through the harness's own skip mechanism — a bare early return or a commented-out assertion converts a missing test into a green one.

## 5. Every clause of a fix is load-bearing

For each clause of your fix, some test must break when it is removed; a clause no test requires is untested or unnecessary. The same check applies to defensive code in module internals — a guard no internal path can reach is scope creep in a safety vest. Trust-boundary validation (public APIs, user input, external data) is exempt: exported symbols cannot enumerate their callers.

## 6. Tests are curated, not accumulated

A per-file or per-suite limit this repository declares wins. Otherwise: a test file that keeps growing is a signal to split by behavior or to merge duplicates into a parameterized form. Never delete or omit a needed test to satisfy tidiness — coverage outranks curation.

---

**This rule is working if:** your tests fail before your fixes and pass after; snapshot diffs are explained; skipped tests say why. **This rule is wrong for you if:** the code is a throwaway spike that will never be committed — then remember only that a test you never saw fail proves nothing either way.
<!-- SEIRI:END:seiri_test-validity.md -->

<!-- SEIRI:START:seiri_reuse-first.md -->
# Reuse First

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. The best code for this repository usually already exists in it. This rule rests on a property every codebase has: a change is a diff, and it answers a request. Applies when the change will land in version control.

## 1. Search first, compose second, write last

Evaluate solutions in this strict order:

1. **Reuse** existing shared code — utilities, helpers, modules already here, or libraries already installed.
2. **Extend safely** — additive only: optional parameters, new exports, wrappers. Preserve current behavior; no silent semantic change to an existing interface.
3. **Mirror the closest proven pattern** in this repository — unless it is clearly outdated or defective; then say so rather than copy it.
4. **Adopt the ecosystem-standard approach** — official documentation and maintainer guidance over ad-hoc examples.
5. **Write new code** — when the problem is genuinely novel here.

Ask yourself: "Does this already exist somewhere I haven't searched?"

## 2. The smallest code that answers the request

Nothing speculative. Validation at trust boundaries (public APIs, user input, external data) is never speculative — exported symbols cannot enumerate their callers.

## 3. Surgical changes

Every changed line traces to the request. Remove what YOUR change orphaned; leave pre-existing dead code in place, mentioned, not buried in an unrelated diff.

## 4. Work toward a verifiable goal

Restate the task as something checkable before you start: "add validation" becomes "these invalid inputs are rejected, shown by a failing-then-passing check"; "fix the bug" becomes "a reproduction exists, then passes".

## 5. One file, one responsibility

A file answers for one thing. If naming it honestly needs "and", it is two files.

---

**This rule is working if:** diffs read as direct answers to their requests, and the utility you almost wrote turns out to already exist, found. **This rule is wrong for you if:** you are scaffolding a greenfield repository — there is nothing to reuse yet; apply §2 and §4 and return here once the first patterns exist.
<!-- SEIRI:END:seiri_reuse-first.md -->

<!-- SEIRI:START:seiri_naming.md -->
# Naming

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Names are the primary index of a codebase: what search finds, what imports show, what readers guess by. This rule rests on properties every codebase has: files and symbols have names, and an existing style is already present — whatever it is. Applies when the change will land in version control.

## 1. Mirror the siblings

Before naming anything, read the names around it: match the case, the grammar (verb-first or noun-first), the suffix, and the singular/plural habits of sibling files and symbols of the same kind. No siblings? The idiomatic form of the language or framework. A migration in progress? The declared target style, not the majority.

## 2. A name states one concrete responsibility

A reader should predict the content from the name alone. Name by what the unit does or holds, not when it was added or who owns it. An honest name that needs "and" is two units (`seiri_reuse-first` §5); a vague honest name means a vague responsibility — fix the unit.

## 3. No grab-bags

Avoid `common`, `misc`, `util2`, `temp`, `new`, `stuff`, `extra` and their kin — they defeat search and accrete unrelated content. Three helpers for date math are `date-math`, not `helpers2`.

## 4. Derived names follow their source

Tests, specs, fixtures, and generated companions are named for what they verify or accompany, and rename with their source — a base name that matches nothing is a name trap (`seiri_agent-legible` §3).

---

**This rule is working if:** you can locate a feature by guessing its name, and new files look native to their directory. **This rule is wrong for you if:** a generator names these files — the generator's convention IS the sibling convention; configure the generator, don't fight its output.
<!-- SEIRI:END:seiri_naming.md -->

<!-- SEIRI:START:seiri_structure.md -->
# Structure

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Structure is the cost model of reading: every hop, level, and cycle is paid by whoever comes next. Directions only — where this repository or its architecture tooling declares concrete limits, those limits win. This rule rests on properties every codebase has: files have sizes and paths, and symbols reference one another. Applies when the change will land in version control; prefer structural moves at natural seams, not mid-task.

## 1. Dependencies form a DAG

A cycle is two units pretending to be one. When A needs B and B needs A, no reading order exists: extract the shared piece into a third unit, invert one edge behind an interface or event, or merge the two honestly. Do not certify acyclicity by tooling you have not run — trace the edges you touched.

## 2. Depth is a toll

Nest to expose structure, not to file things away. When following one call chain means descending many levels, flatten. A directory with one child is a corridor, not a room — collapse it.

## 3. Cohesion splits, complexity compresses

Two different smells, two different moves. When parts of a unit do not share state or purpose, the unit is several units — split where the seams already show. When one unit branches beyond what a reader can simulate in their head, compress: extract steps, replace condition ladders with tables or dispatch, name the phases.

## 4. Growth is a signal

Recurring growth in one file means a responsibility wants out — split along the responsibility seam, not at an arbitrary line count.

---

**This rule is working if:** following a call chain rarely reverses direction, and splits land at seams reviewers recognize without explanation. **This rule is wrong for you if:** the tree is vendored or generated — a generator owns that structure; change the generator or leave it be (`seiri_context-efficiency` §1).
<!-- SEIRI:END:seiri_structure.md -->

<!-- SEIRI:START:seiri_function-boundaries.md -->
# Function Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. A function is the smallest unit a reader can hold whole — and the cheapest one to get wrong, because the cost lands on its callers. This rule rests on properties every codebase has: functions take inputs and produce outputs, and they live in files with names. Applies when you are writing or moving a function. Purity moves effects, it does not remove them: push effects outward until they sit in one named place, not until every layer needs a wrapper.

## 1. Inputs arrive as parameters

The signature is the full list of what a function can see. Compute from arguments; module state read at call time, ambient config, the clock, and the environment are passed in, not reached for. When a dependency genuinely cannot be passed — a framework injects it, a runtime owns it — say so at the function or its file head (`seiri_agent-legible` §1) instead of reaching through it silently.

## 2. Effects live at the edge

Pure by default; effectful on purpose, in one named place. I/O, module-state writes, and mutation of what the caller owns stay in functions whose names announce them, called from the outer layer — not sprinkled through the computation they serve. Mutating an argument is an unwritten output: return the new value, or make the mutation the function's stated purpose. A function that both computes and persists is two functions and a caller.

## 3. One file, one exported function

Name a function file for the function it exports, and export that one only (`seiri_naming` §2); a second export earns its place only when the two cannot be read apart. At most two unexported helpers may share the file, and each helper's implementation body must be 8 lines or fewer; its declaration or signature and enclosing braces do not count. A longer helper is its own file (`seiri_structure` §3). At most three types, newly defined here; derived types — aliases, narrowings, unions over what already exists — stay with their source, and type-only files are outside this budget. These counts are defaults; a budget this repository declares wins.

## 4. A helper that moves out moves down

Extraction is not relocation to the same shelf. Helpers pulled out of a function do not become its flat neighbors: give the function a directory and file them one level under it — `utils/` or `helpers/` while their only claim is "these serve the function above", renamed for the topic once the set has one (`seiri_naming` §3). The path states which function is served and which serves.

---

**This rule is working if:** tests call functions without building a world first, and the caller of a helper sits one directory up, every time. **This rule is wrong for you if:** the framework owns the unit — components, route handlers, and generated clients follow their framework's shape; apply §1 and §2 inside them and leave the file layout to the convention.
<!-- SEIRI:END:seiri_function-boundaries.md -->

<!-- SEIRI:START:seiri_context-efficiency.md -->
# Context Efficiency

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Context is the scarcest resource in an agent session: performance degrades as it fills, and every wasted read crowds out instructions already given. This rule rests on a property of every session, not of any codebase: context is finite, and reading spends it. These rules bias toward fewer, deliberate reads — when genuinely disoriented, one broad read beats three wrong guesses.

## 1. Generated artifacts are search-only

Build output is not source: search it to trace a symbol, do not read it wholesale, never edit it — an edit there disappears on the next build, and a bug found there may already be fixed in its source. When a generated file is wrong, the deliverable is a change to its generator or template. Installed dependencies and lockfiles are a different class: dependency sources and type definitions are canonical references; never hand-edit a lockfile — change the manifest and regenerate through the package manager.

## 2. Capture once, read from the file

Re-running a command to re-read its output pays twice. Capture long output once to a scratch file outside the repository tree, then search and re-read from that file — repo-root log files pollute status and reviews. A capture goes stale the moment relevant code changes: re-run after edits; judging a post-fix state from a pre-fix capture is self-deception. Investigating flaky behavior is the legitimate reason for repeated runs.

## 3. Re-reads need a reason

Change, external modification, or genuine doubt — not habit. Read the range the task needs; a targeted read plus a follow-up beats loading whole files by default. Before broad exploration, state what you are looking for; stop when you find it — after confirming it is the only candidate, since a first match is not proof of uniqueness.

---

**This rule is working if:** generated directories never appear in your edits, and every re-read can name its reason. **This rule is wrong for you if:** you have lost orientation — take the one broad read, reorient, and return to targeted reads.
<!-- SEIRI:END:seiri_context-efficiency.md -->

<!-- SEIRI:START:seiri_cognitive-discipline.md -->
# Cognitive Discipline

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Behavioral guardrails against rationalization in long agent sessions. This rule rests on a property of every session, not of any codebase: a claim about code can be checked against the code and its oracles — text you generate is not evidence. Verification outranks speed: for a trivial task a check may scale down, but only out loud — name the check you are skipping and why. A silent skip is the failure mode this rule exists to block.

## 1. Evidence over confidence

Don't claim. Verify — with this repository's own oracles — then cite. A claim without observable evidence (tool output, test results, file contents — not your reasoning about them) is a prediction. Each quality attribute needs its own evidence: a linter pass is not a build; one test is not the suite; a path recalled from memory is a guess until a tool confirms it exists.

## 2. Causes, not symptoms

Fix where it started, not where it surfaced — the two are usually different places, and "I see the problem, let me fix it" almost always means you see the symptom. Repeated failure of the same approach indicts the approach: when each fix reveals a new problem elsewhere, stop patching and question the underlying assumption.

## 3. Read before you adapt

Fully read what you copy or adapt — skimming a pattern produces a misapplied pattern. Navigation may stay targeted; comprehension of what you reuse may not. "Too simple to check" is a rationalization, not an assessment — simple tasks bypass scrutiny, which is exactly how simple tasks break things.

## 4. The letter is the spirit

When a rule or request names a concrete action, the concrete action is required — "I followed the spirit" is how the letter gets skipped. The requested scope is the entire scope; propose extras separately. Work already done has no claim on being kept: when the approach is wrong, discard it — adaptation inherits the defect.

## 5. Honest over agreeable

Disagree with reasoning; say "I don't know" instead of guessing. Reflexive agreement is not analysis. Shipping work you are unsure of without disclosure is deception by omission — disclosed uncertainty plus a check that would catch the failure is the acceptable form of proceeding.

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

**Red flags — stop and verify:** "probably / should / seems to" about your own change · declaring success without fresh output · a fix touching the same symptom a second time · wanting the task to be over.

---

**This rule is working if:** claims cite tool output, and fixes do not reappear in new places. **This rule is wrong for you if:** never — but its checks scale down out loud for trivial work; what never scales down is saying so.
<!-- SEIRI:END:seiri_cognitive-discipline.md -->

<!-- SEIRI:START:seiri_code-comments.md -->
# Code Comments

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. A comment is the one thing in a file nothing checks: no compiler reads it, no test goes red when it lies — and it is believed anyway. This rule rests on properties every codebase has: the language provides a form for comments, and a comment sits beside the code it describes. Applies when the change will land in version control.

## 1. A comment states the current spec, never its history

When the code changes, its comment changes in the same edit. No changelog lines, no dated notes, no "previously" or "used to", no commented-out predecessor kept for reference — nothing verifies any of it, so it rots silently and then misleads with the authority of a comment. History that must be kept goes where this repository keeps it (the version-control trail, a changelog, a decision record, a module document) — never the source. Delete the code, delete its comment with it: a comment left behind is a published false statement.

## 2. A function's documentation comment names its parameters, its result, and its purpose

Write it in the documentation-comment form the language provides, and fill every slot that form defines: each parameter, what comes back, and what the function is for. Say what the caller cannot see from the signature — what makes an argument valid, the conditions under which the call fails, the effect it has beyond its return value. Do not restate the signature in prose: a parameter documented as "the id" earned nothing.

## 3. Every declaration the form reaches carries one

Types, fields, members, constants, modules — wherever the language's documentation form applies and its tooling would render the result, the declaration carries a comment that says what it is for and how it is meant to be used. A local inside a body is not one of them: when it needs explaining, a truer name or a split is the fix, not a comment.

## 4. Follow the language's own comment convention; do not invent one

Take the form from the language and the siblings around the file — its documentation comment, its inline comment, its placement relative to the declaration. An inline comment sits at the code it explains, not in a banner that drifts away from it. A note some other convention asks you to leave — invisible wiring, a name-trap warning, an unpassable dependency — is a comment like any other: it takes this form, and §1 keeps it current.

---

**This rule is working if:** a reader trusts a comment without checking the body against it, and the past tense lives in the history, never in the source. **This rule is wrong for you if:** the language has no documentation-comment convention and the repository has not adopted one — then §1 still binds, and the rest has no form to follow.
<!-- SEIRI:END:seiri_code-comments.md -->
