# Structure

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

Structure is the cost model of reading: every hop, level, and cycle is
paid by whoever comes next. This rule states directions only — where this
repository (or its architecture tooling) declares concrete limits, those
limits win.
This rule rests on properties every codebase has: files have sizes and
paths, and symbols reference one another.

**Tradeoff:** structural moves (splits, extractions) create churn today
to reduce reading cost tomorrow; prefer them at natural seams, not
mid-task.
**Applies when:** the change is intended to land in version control.

## 1. Dependencies form a DAG

**A cycle is two units pretending to be one.**

- When A needs B and B needs A, no reading order exists: extract the
  shared piece into a third unit, invert one edge behind an interface or
  event, or merge the two honestly.
- Do not certify acyclicity by tooling you have not run; trace the edges
  you touched.

Ask yourself: "Can I order these units so every reference points one way?"

## 2. Depth is a toll

**Nest to expose structure, not to file things away.**

- Every directory level is a hop a reader pays on every visit. If this
  repository declares a depth limit, follow it; otherwise apply the
  direction: when following one call chain means descending many levels,
  flatten.
- A directory with one child is a corridor, not a room — collapse it.

Ask yourself: "Does each level of this path tell the reader something?"

## 3. Cohesion splits, complexity compresses

**Two different smells, two different moves.**

- When parts of a unit do not share state or purpose, the unit is several
  units: split it. If this repository (or its architecture tooling)
  declares a cohesion measure and threshold, follow those; otherwise
  split where the seams already show.
- When one unit branches beyond what a reader can simulate, compress:
  extract steps, replace condition ladders with tables or dispatch,
  name the phases. If a complexity threshold is declared, follow it;
  otherwise let "can I simulate this in my head?" be the trigger.

Ask yourself: "Am I looking at two things glued, or one thing tangled?"

## 4. Growth is a signal

**A file that keeps growing is announcing a boundary.**

- If this repository declares a file-size limit, follow it. Otherwise
  apply the direction: recurring growth in one file means a
  responsibility wants out — split along the responsibility seam, not at
  an arbitrary line count.

Ask yourself: "What part of this file keeps attracting changes — and is
it the same part I opened it for?"

---

**This rule is working if:** following a call chain rarely reverses
direction; finding code takes few hops; splits land at seams reviewers
recognize without explanation.
**This rule is wrong for you if:** the tree is vendored or generated —
a generator owns that structure; change the generator or leave it be
(see seiri_context-efficiency §1).
