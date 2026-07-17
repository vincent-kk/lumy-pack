# Test Validity Rules

A passing test is evidence only if it could have failed. These rules define
when a test counts as verification. Distilled from merge-blocking review
contracts in large agent-operated repositories and from execution-based
benchmark methodology (fail-to-pass / pass-to-pass task construction).

**Tradeoff:** These rules add one verification step per test. They bind every
test that lands in a commit; for throwaway spikes, remember only that a test
you never saw fail proves nothing either way.

## 1. Fail First, Then Fix

**A fix's test is valid only if it fails without the fix.**

- Before finishing a bug fix, run its test against the pre-fix code and
  confirm it fails. Use a scoped mechanism — revert the change locally,
  `git stash push -- <changed files>`, or a scratch worktree. Never bare
  `git stash` on a tree holding unrelated work.
- A test that passes both with and without the change verifies nothing.
  It is worse than no test: it certifies the bug as handled.
- The failure must be for the right reason — the bug's symptom, not an
  unrelated setup error, wrong path, or missing import. When the fix adds
  a new symbol, the expected pre-fix failure IS that symbol's absence.
- Refactors invert the contract: existing tests MUST pass unmodified before
  and after. Pin current behavior with added characterization tests BEFORE
  moving code — adding tests is fine; editing existing assertions is not.

Ask yourself: "Have I watched this test fail for the reason the bug exists?"

## 2. Test the Artifact You Changed

**Verification against the wrong build always passes.**

- Confirm the harness exercises your modified code — not a system-installed
  binary, a stale build output, or a cached dependency.
- Report results only from the repository's canonical wrapper commands
  (package scripts, `just`, `make`) — wrappers often carry env vars, build
  steps, and flags the raw tool lacks. Running the raw tool narrowly while
  debugging is fine; a raw-tool pass is never the final evidence.
- If unsure, break your change deliberately once in a unit-scoped check and
  revert the probe immediately — the suite must go red. If it stays green,
  you are not testing what you changed. Skip this probe where the suite has
  real side effects (networks, shared databases, deployments).

Ask yourself: "Is this command exercising the code I just edited, or some other copy of it?"

## 3. Snapshots Are Claims, Not Truth

**A snapshot captured from buggy code certifies the bug.**

- Read snapshot contents before committing them. A regenerated snapshot is
  an assertion you are making, not output you are recording.
- Never regenerate snapshots to turn a suite green without stating, in the
  diff or commit message, why the new output is the correct output.

Ask yourself: "Can I defend every changed line of this snapshot?"

## 4. Skips Must Be Loud

**A silent skip reports PASSED.**

- Use the harness's skip mechanism with a reason string. A bare early
  `return` or a commented-out assertion turns a missing test into a green one.
- A test that cannot run in the current environment is a skip with a
  reason, never a pass.

Ask yourself: "If this test silently stopped testing, would anyone know?"

## 5. Fixes Must Be Load-Bearing

**Every clause of the fix should be required by some test.**

- Delete each load-bearing clause of your fix (mentally, or actually): at
  least one test must break for each. A clause no test requires is either
  untested or unnecessary.
- Apply the same check to defensive code inside module internals: a guard no
  internal path can reach is scope creep wearing a safety vest. Trust-boundary
  validation (public APIs, user input, external data) is exempt — exported
  symbols cannot enumerate their callers.

Ask yourself: "Which test breaks if I remove this line?"

---

**These rules are working if:** your tests fail before your fixes and pass
after, snapshot diffs are explained, skipped tests say why, and deleting
any part of a fix turns something red.
