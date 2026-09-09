# Public Contract

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. What a module exports is a promise to every present and future consumer. Applies when the language or module system in use has an export or visibility mechanism.

## 1. Export only what has a consumer

An export with no consumer carries a stated intent — or gets removed. Remove leftovers your change added or orphaned; leave a pre-existing one for a deliberate cleanup (`seiri_reuse-first` §3). Usage is tool-checkable; intent you must write.

## 2. Name every re-export

Wildcard re-exports hide the surface three ways: a new symbol in an internal file silently widens the contract; duplicate names across re-exported files drop silently; and text tools lose the symbol list at the boundary. Entry points list what they export, by name.

## 3. Entry points declare, internals implement

The set of symbols reachable from the entry point IS the public contract; everything behind it is free to change. An entry point holds re-exports and wiring, not implementation; consumers outside the module hold only entry-point symbols.

## 4. Framework-invoked files are entry points too

A file the framework calls by convention — routes, pages, handlers, plugin manifests — is public surface even though no import names it. Treat changes to its exported shape as contract changes, and label the convention that invokes it (`seiri_agent-legible` §1).

---

**This rule is working if:** the public surface can be enumerated by reading entry points, and removing an internal symbol breaks no consumer. **This rule is wrong for you if:** the code is a single-file script or notebook with no module boundary — there is no contract to keep small.
