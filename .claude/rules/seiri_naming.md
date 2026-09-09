# Naming

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. Names are the primary index of a codebase: what search finds, what imports show, what readers guess by. Applies when the change will land in version control.

## 1. Mirror the siblings

Read the names around the new unit first — case, grammar (verb-first or noun-first), suffix, singular/plural — and match them. No siblings? The idiomatic form of the language or framework. A migration in progress? The declared target style, not the majority.

## 2. A name states one concrete responsibility

A reader predicts the content from the name alone: what the unit does or holds, never when it was added or who owns it. An honest name that needs "and" is two units; a vague honest name means a vague responsibility — fix the unit.

## 3. No grab-bags

Avoid `common`, `misc`, `util2`, `temp`, `new`, `stuff`, `extra` and their kin — they defeat search and accrete unrelated content. Three helpers for date math are `date-math`, not `helpers2`.

## 4. Derived names follow their source

Tests, specs, fixtures, and generated companions are named for what they verify or accompany, and rename with their source — a base name that matches nothing is a name trap (`seiri_agent-legible` §3).

---

**This rule is working if:** you can locate a feature by guessing its name, and new files look native to their directory. **This rule is wrong for you if:** a generator names these files — the generator's convention IS the sibling convention; configure the generator, don't fight its output.
