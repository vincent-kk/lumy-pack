# Public Contract

> **Precedence**: repository instructions (CLAUDE.md, project rules) >
> repository conventions > this rule > seiri defaults. On conflict, the
> higher source wins and this rule yields.

What a module exports is a promise to every present and future consumer.
This rule rests on a property every codebase with a module system has: a
distinction exists between what is public and what is internal.

**Applies when:** the language or module system in use has an export or
visibility mechanism.

## 1. Export only what has a consumer

**An export with no consumer carries a stated intent — or gets removed.**

- Remove leftover your change added or orphaned; leave a pre-existing one for
  a deliberate cleanup (seiri_reuse-first §3). Usage is tool-checkable;
  intent you must write.

Ask yourself: "Who consumes this — and if no one yet, where did I say so?"

## 2. Name every re-export

**A contract you cannot enumerate is not a contract.**

- Wildcard re-exports hide the surface three ways: a new symbol in an
  internal file silently widens the contract; duplicate names across
  re-exported files drop silently; and text tools lose the symbol list at
  the boundary. Entry points list what they export, by name.

Ask yourself: "Can I read the public surface without resolving a wildcard?"

## 3. Entry points declare, internals implement

**The set of symbols reachable from the entry point IS the public contract;
everything behind it is free to change.**

- An entry point holds re-exports and wiring, not implementation; consumers
  outside the module hold only entry-point symbols.

Ask yourself: "If I renamed every internal file, would any consumer break?"

## 4. Framework-invoked files are entry points too

**A file the framework calls by convention is public surface, even though no
import names it.**

- Routes, pages, handlers, plugin manifests: treat changes to their exported
  shape as contract changes, and label the convention that invokes them
  (seiri_agent-legible §1).

Ask yourself: "What breaks at runtime if I change this export's shape — and
would any import have warned me?"

---

**This rule is working if:** the public surface can be enumerated by reading
entry points; removing an internal symbol breaks no consumer; review diffs
show contract changes as changed lines in an export list.
**This rule is wrong for you if:** the code is a single-file script or
notebook with no module boundary — there is no contract to keep small.
