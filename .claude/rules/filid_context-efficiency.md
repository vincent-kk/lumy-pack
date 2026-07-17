# Context Efficiency Rules

Context is the scarcest resource in an agent session: performance degrades
as it fills, and every wasted read crowds out instructions already given.
These rules keep file reads and command output proportional to the task.

**Tradeoff:** These rules bias toward fewer, more deliberate reads. When
genuinely disoriented, one broad read beats three wrong guesses.

## 1. Generated Artifacts Are Search-Only

**Build output is not source. Fix generators, not their output.**

- Build output (`dist/`, `build/`, `out/`, `coverage/`, `.next/`, generated
  clients): search to trace a symbol, do not read wholesale, never edit.
- Installed dependencies and lockfiles are a different class. `node_modules/`
  sources and type definitions are canonical references — read them when a
  dependency contract is the question. Never hand-edit a lockfile; change
  the manifest and regenerate through the package manager.
- Stale build output read as source is a classic wrong-file edit: the
  "bug" you found may already be fixed upstream, and an edit made there
  disappears on the next build.
- When a generated file is wrong, the deliverable is a change to its
  generator or source template.

Ask yourself: "Would this file survive a clean build?"

## 2. Capture Once, Read From the File

**Re-running a command to re-read its output pays twice.**

- Never re-run the same test suite or long command with different grep
  filters. Capture the output to a file once, then search and re-read
  from that file.
- Long or repeated diagnostics (build logs, dev-server output) belong in
  a file you can `grep` and `tail` — not in scrollback that is gone by
  the next step.
- A capture goes stale the moment relevant code changes — re-run after
  edits; judging a post-fix state from a pre-fix capture is self-deception.
  Flaky-test investigation is a legitimate reason for repeated runs.
- Write captures to a scratch/temp location, never the repository tree —
  repo-root log files pollute `git status` and violate structure rules.

Ask yourself: "Did I already have this output and throw it away?"

## 3. Do Not Re-Read the Unchanged

**Re-reads are driven by change or doubt, not habit.**

- Do not re-read a file section without a reason: an intervening code
  change, an external modification, or genuine doubt about your recall.
  After context compaction or a long session, re-reading before an edit
  is correct, not waste.
- Read the part of the file the task needs; a targeted range read plus a
  follow-up beats loading whole files by default.
- Before a broad exploration, state what you are looking for; stop when
  you find it — after confirming it is the only candidate. A first grep
  hit is not proof of uniqueness.

Ask yourself: "What new fact will this read give me that the last one didn't?"

---

**These rules are working if:** generated directories never appear in your
edits, long outputs are captured to files and quoted from them, and every
re-read can name its reason.
