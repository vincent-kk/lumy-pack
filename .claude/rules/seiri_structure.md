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
