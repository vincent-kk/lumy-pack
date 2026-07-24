# Agent-Legible Code

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

Code is read by agents and newcomers who hold no tribal memory: what a file
does not show, they guess. This rule rests on properties every codebase has:
code lives in files with names and paths, and symbols are defined and
referenced.

**Applies when:** the change is intended to land in version control.

## 1. State the invisible wiring

**When behavior is bound by position, name, or registration — write down
where the binding lives.**

- Name the mechanism in one line at the file's entry (or its module doc):
  `loaded by <mechanism>; <path/name/annotation> determines <what>`.

Ask yourself: "Could a reader with only this file and its imports predict
when this code runs?"

## 2. Give every repeated block a unique anchor

**In repetitive structures, order is not an address.**

- Give each near-identical instance a distinct handle — a name, a key, or an
  adjacent marker unique to it; across copies (source vs generated), state
  which one is canonical.

Ask yourself: "If I asked someone to edit the third block, could they pick
the wrong one?"

## 3. Defuse name traps

**When a name will mislead, fix the name — or post a warning where the
misleading happens.**

- Prefer renaming toward the convention; when that is out of scope, one line
  at the point of confusion: `entry point is <X>, not <Y>`.

Ask yourself: "What would someone reasonably assume from this name — and is
that assumption true?"

## 4. Prefer the direct reference

**When a direct call and an indirect mechanism are equally capable, choose
direct.**

- Indirection the architecture or framework demands is not yours to
  remove — label it (rule 1) and move on.

Ask yourself: "Can a reader follow this reference with plain text search?"

## 5. Keep one unit graspable in one sitting

**A unit should be understandable alone: purpose from its name and head,
dependencies from its imports, effect from its exports.**

- When one file needs several others open at once, split it or localize what
  it depends on.

Ask yourself: "Can I state what this file does without opening a second
file?"

---

**This rule is working if:** edits land on the intended instance on the
first attempt; a new file's run-conditions can be stated from the file
alone; plain text search finds a feature's wiring.
**This rule is wrong for you if:** the indirection you want to remove IS the
framework — label framework conventions and leave them standing.
