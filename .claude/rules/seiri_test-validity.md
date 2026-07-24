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

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

A passing test is evidence only if it could have failed. These rules
define when a test counts as verification.
This rule rests on a property every codebase has: a means of verification
exists and can be run.

**Tradeoff:** one extra verification step per test, in exchange for tests
that mean something.
**Applies when:** the change is intended to land in version control.

## 1. Fail first, then fix

**A fix's test is valid only if it fails without the fix — for the bug's
reason.**

- Before finishing a bug fix, run its test against the pre-fix code and
  watch it fail. Use a scoped mechanism (revert locally, stash only the
  changed files, or a scratch worktree) — never disturb unrelated work.
- The failure must be the bug's symptom — not a setup error, a wrong
  path, or a missing import. When the fix introduces a new symbol, the
  expected pre-fix failure IS that symbol's absence.
- Refactors invert the contract: existing tests MUST pass unmodified
  before and after. Pin current behavior with added characterization
  tests BEFORE moving code — adding tests is fine; editing existing
  assertions is not.

Ask yourself: "Have I watched this test fail for the reason the bug exists?"

## 2. Verify the artifact you changed

**Verification against the wrong build always passes.**

- Use this repository's own designated verification command — the one its
  instructions or tooling name. Wrappers carry environment, build steps,
  and flags that raw tools lack; a raw-tool pass is diagnostic, never the
  final evidence.
- Confirm the harness exercises your modified code — not a stale build,
  an installed copy, or a cached artifact. If unsure, break your change
  deliberately once in a unit-scoped check and revert the probe: the run
  must go red. If it stays green, you are testing some other copy.

Ask yourself: "Is this command exercising the code I just edited?"

## 3. A snapshot is a claim, not a recording

**A snapshot captured from buggy code certifies the bug.**

- A regenerated snapshot is an assertion you are authoring. Read the
  diff; be able to defend every changed line, or do not commit it.
- Never regenerate snapshots to turn a run green without stating, in the
  diff or the change description, why the new output is the correct output.

Ask yourself: "Can I defend every changed line of this snapshot?"

## 4. Skips are loud

**A silent skip reports PASSED.**

- A test that cannot run in the current environment is a skip with a
  reason string, through the harness's own skip mechanism. A bare early
  return or a commented-out assertion converts a missing test into a
  green one.

Ask yourself: "If this test silently stopped testing, would anyone know?"

## 5. Every clause of a fix is load-bearing

**For each clause of your fix, some test must break when it is removed.**

- Delete each load-bearing clause (mentally or actually): at least one
  test must go red for each. A clause no test requires is untested or
  unnecessary.
- The same check applies to defensive code in module internals: a guard
  no internal path can reach is scope creep in a safety vest.
  Trust-boundary validation (public APIs, user input, external data) is
  exempt — exported symbols cannot enumerate their callers.

Ask yourself: "Which test breaks if I remove this line?"

## 6. Tests are curated, not accumulated

**A suite that only ever grows is drifting toward noise.**

- If this repository declares a per-file or per-suite limit, follow that
  limit. Otherwise apply the direction only: a test file that keeps
  growing is a signal to split by behavior or to merge duplicates into a
  parameterized form.
- Never delete or omit a needed test to satisfy tidiness — coverage
  outranks curation. Curate by merging and splitting, not by discarding.

Ask yourself: "Is this file accumulating cases, or organizing them?"

---

**This rule is working if:** your tests fail before your fixes and pass
after; snapshot diffs are explained; skipped tests say why; deleting any
part of a fix turns something red.
**This rule is wrong for you if:** the code is a throwaway spike that
will never be committed — then remember only that a test you never saw
fail proves nothing either way.
