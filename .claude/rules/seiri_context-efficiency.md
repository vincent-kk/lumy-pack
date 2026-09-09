# Context Efficiency

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Context is the scarcest resource in an agent session: performance degrades as it fills, and every wasted read crowds out instructions already given. These rules bias toward fewer, deliberate reads — when genuinely disoriented, one broad read beats three wrong guesses.

## 1. Generated artifacts are search-only

Build output is not source: search it to trace a symbol, never read it wholesale, never edit it — an edit there disappears on the next build, and the deliverable for a wrong generated file is a change to its generator or template. Dependency sources and type definitions are canonical references; a lockfile is never hand-edited — change the manifest and regenerate through the package manager.

## 2. Capture once, re-read with a reason

Re-running a command to re-read its output pays twice: capture long output once to a scratch file outside the repository tree and search that file — then re-run after edits, because judging a post-fix state from a pre-fix capture is self-deception. A re-read of source needs a reason (change, external modification, genuine doubt) and a targeted range; before broad exploration, state what you are looking for, and stop once the match is confirmed to be the only candidate. Investigating flaky behavior is the legitimate reason for repeated runs.

---

**This rule is working if:** generated directories never appear in your edits, and every re-read can name its reason. **This rule is wrong for you if:** you have lost orientation — take the one broad read, reorient, and return to targeted reads.
