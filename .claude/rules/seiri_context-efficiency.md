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
