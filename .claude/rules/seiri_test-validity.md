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

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. A passing test is evidence only if it could have failed. Applies when the change will land in version control.

## 1. A test proves a change only by failing without it

Before finishing a fix, run its test against the pre-fix code and watch it fail for the bug's own reason — not a setup error, a wrong path, or a missing import; when the fix introduces a new symbol, the expected pre-fix failure is that symbol's absence. Use a scoped mechanism (revert locally, stash only the changed files, or a scratch worktree) — never disturb unrelated work. Refactors invert the contract: existing tests pass unmodified before and after; pin current behavior with added characterization tests before moving code — editing existing assertions is not pinning. The step-by-step procedure lives in `/seiri:implement` and `/seiri:trace-cause`.

## 2. Verify the artifact you changed, with the repository's own command

A raw-tool pass is diagnostic; the final evidence comes from this repository's designated verification, whose wrappers carry the environment, build steps and flags raw tools lack. If unsure the harness exercises your modified code rather than a stale build or an installed copy, break your change deliberately once in a unit-scoped check, watch the run go red, and revert the probe — a run that stays green is testing some other copy.

## 3. Snapshots and skips are claims you author

A snapshot captured from buggy code certifies the bug. A regenerated snapshot is an assertion: read the diff, defend every changed line, and never regenerate to turn a run green without stating why the new output is the correct output. A test that cannot run in this environment skips through the harness's own mechanism with a reason string — a bare early return or a commented-out assertion converts a missing test into a green one.

## 4. Every clause of a fix is load-bearing

For each clause, some test breaks when it is removed; a clause no test requires is untested or unnecessary. The same check applies to defensive code in module internals — a guard no internal path can reach is scope creep in a safety vest. Trust-boundary validation (public APIs, user input, external data) is exempt: exported symbols cannot enumerate their callers.

## 5. Tests are curated, not accumulated

A per-file or per-suite limit this repository declares wins. Otherwise a growing test file splits by behavior or merges duplicates into a parameterized form — and never drops a needed test for tidiness; coverage outranks curation.

---

**This rule is working if:** your tests fail before your fixes and pass after; snapshot diffs are explained; skipped tests say why. **This rule is wrong for you if:** the code is a throwaway spike that will never be committed — then remember only that a test you never saw fail proves nothing either way.
