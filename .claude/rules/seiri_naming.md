# Naming

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

Names are the primary index of a codebase: what search finds, what imports
show, what readers guess by. This rule rests on properties every codebase
has: files and symbols have names, and an existing style is already
present — whatever it is.

**Applies when:** the change is intended to land in version control.

## 1. Mirror the siblings

**Before naming anything, read the names around it.**

- Match the case, the grammar (verb-first or noun-first), the suffix, and
  the singular/plural habits of sibling files and symbols of the same kind.
  No siblings? The idiomatic form of the language or framework. A migration
  in progress? The declared target style, not the majority.

Ask yourself: "What style do my neighbors already use?"

## 2. A name states one concrete responsibility

**A reader should predict the content from the name alone.**

- Name by what the unit does or holds, not when it was added or who owns it.
  An honest name that needs "and" is two units (seiri_reuse-first §5); a
  vague honest name means a vague responsibility — fix the unit.

Ask yourself: "Reading only this name, what would I expect inside — and is
that what's inside?"

## 3. No grab-bags

**Names that can hold anything end up holding everything.**

- Avoid `common`, `misc`, `util2`, `temp`, `new`, `stuff`, `extra` and their
  kin — they defeat search and accrete unrelated content. Three helpers for
  date math are `date-math`, not `helpers2`.

Ask yourself: "Could a stranger guess what does NOT belong in this file?"

## 4. Derived names follow their source

**A file that exists because of another carries that other's base name.**

- Tests, specs, fixtures, and generated companions are named for what they
  verify or accompany, and rename with their source — a base name that
  matches nothing is a name trap (seiri_agent-legible §3).

Ask yourself: "From this file's name, can I find the file it serves?"

---

**This rule is working if:** you can locate a feature by guessing its name;
new files look native to their directory; a rename never leaves orphaned
companions behind.
**This rule is wrong for you if:** a generator names these files — then the
generator's convention IS the sibling convention; configure the generator,
don't fight its output.
