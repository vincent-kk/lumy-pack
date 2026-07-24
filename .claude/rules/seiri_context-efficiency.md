# Context Efficiency

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

Context is the scarcest resource in an agent session: performance
degrades as it fills, and every wasted read crowds out instructions
already given.
This rule rests on a property of every session, not of any codebase:
context is finite, and reading spends it.

**Tradeoff:** these rules bias toward fewer, more deliberate reads. When
genuinely disoriented, one broad read beats three wrong guesses.
**Applies when:** you are an agent operating on a repository.

## 1. Generated artifacts are search-only

**Build output is not source. Fix generators, not their output.**

- Generated output (build directories, compiled bundles, coverage
  reports, generated clients): search it to trace a symbol; do not read
  it wholesale; never edit it. An edit there disappears on the next
  build — and a bug found there may already be fixed in its source.
- Installed dependencies and lockfiles are a different class: dependency
  sources and type definitions are canonical references — read them when
  the dependency's contract is the question. Never hand-edit a lockfile;
  change the manifest and regenerate through the package manager.
- When a generated file is wrong, the deliverable is a change to its
  generator or template.

Ask yourself: "Would this file survive a clean build?"

## 2. Capture once, read from the file

**Re-running a command to re-read its output pays twice.**

- Never re-run the same long command just to grep its output
  differently. Capture once to a scratch file outside the repository
  tree, then search and re-read from that file. Repo-root log files
  pollute status and reviews.
- A capture goes stale the moment relevant code changes — re-run after
  edits; judging a post-fix state from a pre-fix capture is
  self-deception. Investigating flaky behavior is the legitimate reason
  for repeated runs.

Ask yourself: "Did I already have this output and throw it away?"

## 3. Re-reads need a reason

**Change, external modification, or genuine doubt — not habit.**

- Do not re-read what has not changed. After compaction or a long
  session, re-reading before an edit is a reason — habit is not.
- Read the range the task needs; a targeted read plus a follow-up beats
  loading whole files by default.
- Before broad exploration, state what you are looking for; stop when
  you find it — after confirming it is the only candidate. A first match
  is not proof of uniqueness.

Ask yourself: "What new fact will this read give me that the last one
didn't?"

---

**This rule is working if:** generated directories never appear in your
edits; long outputs are quoted from capture files; every re-read can
name its reason.
**This rule is wrong for you if:** you have lost orientation — take the
one broad read, reorient, and return to targeted reads.
