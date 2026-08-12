# Code Comments

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. A comment is the one thing in a file nothing checks: no compiler reads it, no test goes red when it lies — and it is believed anyway. This rule rests on properties every codebase has: the language provides a form for comments, and a comment sits beside the code it describes. Applies when the change will land in version control.

## 1. A comment states the current spec, never its history

When the code changes, its comment changes in the same edit. No changelog lines, no dated notes, no "previously" or "used to", no commented-out predecessor kept for reference — nothing verifies any of it, so it rots silently and then misleads with the authority of a comment. History that must be kept goes where this repository keeps it (the version-control trail, a changelog, a decision record, a module document) — never the source. Delete the code, delete its comment with it: a comment left behind is a published false statement.

## 2. An inline comment is a last resort — three lines at most, for what the code cannot say

Write code that needs no comment first: a truer name, a smaller function, an extracted constant each beat an explanation (`seiri_naming` §2, `seiri_structure` §3), and what a declaration needs said belongs in its documentation comment (§3), not between the statements. A comment that must sit on the code states only what the code itself cannot — the invariant no type can express, the workaround and its external trigger, the effect that lands elsewhere — and it stays within 3 lines. What the code already shows, no comment repeats: a paraphrase of the next line is a second copy that nothing checks and the next edit orphans (§1). The one summary worth keeping is orientation — a single line framing a block's big picture before the reader descends — never a running commentary on statements they can read themselves.

## 3. A function's documentation comment names its parameters, its result, and its purpose

Write it in the documentation-comment form the language provides — JSDoc, TSDoc, a docstring, rustdoc, Javadoc — and fill every slot that form defines: each parameter, what comes back, and what the function is for. Say what the caller cannot see from the signature — what makes an argument valid, the conditions under which the call fails, the effect it has beyond its return value. Do not restate the signature in prose: a parameter documented as "the id" earned nothing.

## 4. Every declaration the form reaches carries one

Types, enums, fields, members, constants, modules — wherever the language's documentation form applies and its tooling would render the result, the declaration carries a comment that says what it is for and how it is meant to be used. A local inside a body is not one of them: when it needs explaining, a truer name or a split is the fix, not a comment (§2).

## 5. Follow the language's own comment convention; do not invent one

Take the form from the language and the siblings around the file — its documentation comment, its inline comment, its placement relative to the declaration. An inline comment sits at the code it explains, not in a banner that drifts away from it. A note some other convention asks you to leave — invisible wiring, a name-trap warning, an unpassable dependency — is a comment like any other: it takes this form, §2 caps it, and §1 keeps it current.

---

**This rule is working if:** bodies read nearly bare while every declaration the form reaches explains itself, a reader trusts a comment without checking the code against it, and the past tense lives in the history, never in the source. **This rule is wrong for you if:** the language has no documentation-comment convention and the repository has not adopted one — then §1 and §2 still bind, and the rest has no form to follow.
