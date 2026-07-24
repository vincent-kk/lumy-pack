# Reuse First

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

The best code for this repository usually already exists in it. This rule
rests on a property every codebase has: a change is a diff, and it answers a
request.

**Applies when:** the change is intended to land in version control.

## 1. Search first, compose second, write last

**Evaluate solutions in this strict order:**

1. **Reuse** existing shared code — utilities, helpers, modules already
   here, or libraries already installed.
2. **Extend safely** — additive only: optional parameters, new exports,
   wrappers. Preserve current behavior; no silent semantic change to an
   existing interface.
3. **Mirror the closest proven pattern** in this repository — unless it is
   clearly outdated or defective; then say so rather than copy it.
4. **Adopt the ecosystem-standard approach** — official documentation and
   maintainer guidance over ad-hoc examples.
5. **Write new code** — when the problem is genuinely novel here.

Ask yourself: "Does this already exist somewhere I haven't searched?"

## 2. The smallest code that answers the request

**Nothing speculative.**

- Validation at trust boundaries (public APIs, user input, external data) is
  never speculative — exported symbols cannot enumerate their callers.

Ask yourself: "Would a senior reviewer call this overbuilt?"

## 3. Surgical changes

**Every changed line traces to the request.**

- Remove what YOUR change orphaned; leave pre-existing dead code in place,
  mentioned, not buried in an unrelated diff.

Ask yourself: "Can I map each changed line back to the request?"

## 4. Work toward a verifiable goal

**Restate the task as something checkable before you start.**

- "Add validation" becomes "these invalid inputs are rejected, shown by a
  failing-then-passing check"; "fix the bug" becomes "a reproduction exists,
  then passes".

Ask yourself: "How will I know — mechanically — that I am done?"

## 5. One file, one responsibility

**A file answers for one thing.**

- If naming the file honestly needs "and", it is two files.

Ask yourself: "If this file grows one more export, should it split?"

---

**This rule is working if:** diffs read as direct answers to their requests;
new code is hard to tell apart from the code around it; the utility you
almost wrote turns out to already exist, found.
**This rule is wrong for you if:** you are scaffolding a greenfield
repository — there is nothing to reuse yet; apply §2 and §4 and return here
once the first patterns exist.
