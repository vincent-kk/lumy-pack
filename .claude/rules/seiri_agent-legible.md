# Agent-Legible Code

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Code is read by agents and newcomers with no tribal memory: what a file does not show, they guess. Applies when the change will land in version control.

## 1. State the invisible wiring

When behavior is bound by position, name, or registration, name the mechanism in one line at the file's entry (or its module doc): `loaded by <mechanism>; <path/name/annotation> determines <what>`.

## 2. Give every repeated block a unique anchor

In repetitive structures, order is not an address. Give each near-identical instance a distinct handle — a name, a key, or an adjacent marker unique to it; across copies (source vs generated), state which one is canonical.

## 3. Defuse name traps

When a name will mislead, rename toward the convention; when that is out of scope, post one line at the point of confusion: `entry point is <X>, not <Y>`.

## 4. Prefer the direct reference

When a direct call and an indirect mechanism are equally capable, choose direct — a reader should be able to follow the reference with plain text search. Indirection the architecture or framework demands is not yours to remove: label it (§1) and move on.

---

**This rule is working if:** edits land on the intended instance on the first attempt, and plain text search finds a feature's wiring. **This rule is wrong for you if:** the indirection you want to remove IS the framework — label it and leave it standing.
