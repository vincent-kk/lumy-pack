# Code Comments

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

A comment is the one thing in a file nothing checks: no compiler reads it, no test goes red when it lies — and it is believed anyway. This rule rests on properties every codebase has: the language provides a form for comments, and a comment sits beside the code it describes.

**Tradeoff:** a documentation comment per declaration is lines you must keep true as the code moves, in exchange for a surface readers and the language's own tooling can consume without opening the body. **Applies when:** the change is intended to land in version control.

## 1. A comment states the current spec, never its history

**When the code changes, its comment changes in the same edit.**

- No changelog lines, no dated notes, no "previously" or "used to", no commented-out predecessor kept for reference. Nothing verifies any of it, so it rots silently and then misleads with the authority of a comment.
- History that must be kept goes where this repository keeps it — the version-control trail, a changelog, a decision record, a module document beside the code. Not in the source.
- Change the behavior, rewrite the sentence describing the old one; delete the code, delete its comment with it. A comment left behind is a published false statement.

Ask yourself: "Reading only this comment, would I describe the code as it is today?"

## 2. A function's documentation comment names its parameters, its result, and its purpose

**The signature says what the types are; the comment says what they mean.**

- Write it in the documentation-comment form the language provides, and fill every slot that form defines: each parameter, what comes back, and what the function is for.
- Say what the caller cannot see from the signature: what makes an argument valid, the conditions under which the call fails, the effect it has beyond its return value.
- Do not restate the signature in prose. A parameter documented as "the id" earned nothing; a parameter documented by what makes it acceptable earned its line.

Ask yourself: "Does this comment tell a caller something the signature could not?"

## 3. Every declaration the form reaches carries one

**Documentation comments are not a function-only convention.**

- Types, fields, members, constants, modules — wherever the language's documentation form applies and its tooling would render the result, the declaration carries a comment in that form.
- Say what the declaration is for and how it is meant to be used. A name repeated as a sentence adds a line and no information.
- The scope is the declarations the documentation form reaches. A local inside a body is not one of them — when it needs explaining, a truer name or a split is the fix, not a comment.

Ask yourself: "If a reader met this declaration through generated docs or an editor tooltip, would they know how to use it?"

## 4. Follow the language's own comment convention; do not invent one

**A house format nobody's tooling reads is a private dialect every newcomer has to learn.**

- Take the form from the language and the siblings around the file — its documentation comment, its inline comment, its placement relative to the declaration. This rule fixes no format of its own.
- An inline comment sits at the code it explains, not in a banner that drifts away from it.
- A note some other convention of this repository asks you to leave — where invisible wiring is bound, a warning where a name misleads, a dependency the signature cannot show — is a comment like any other: it takes this form, and §1 keeps it current.

Ask yourself: "Would this comment look native in any other file of this repository?"

---

**This rule is working if:** a reader trusts a comment without checking the body against it; a caller can use a function from its documentation comment alone; the past tense lives in the history, never in the source. **This rule is wrong for you if:** the language has no documentation-comment convention and the repository has not adopted one — then §1 still binds, and the rest has no form to follow.
