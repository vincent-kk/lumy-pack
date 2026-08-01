# Code Placement

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults — the higher source wins. Where a unit sits decides who may reach it: placement is a boundary decision, not a filing decision. This rule rests on properties every codebase has: a unit has a location, and its consumers have locations too. Applies when the repository has adopted FCA and you are adding a unit with more than one consumer, or moving one; prefer the move at a natural seam, not mid-task.

## 1. Shared code sits at the lowest common fractal of its consumers

The consumers' common ancestor is the address; anything higher is a guess. Compute the lowest common fractal of the consumer owners and place the unit under it. A single-consumer internal unit defaults to an organ of that owner — one consumer is not shared code. A unit with an independent public contract becomes a child fractal instead, with its intent, detail and entry-point artifacts.

## 2. An organ cannot be a lowest common ancestor

An organ has no entry point, so it cannot own a shared boundary. When the computed ancestor is an organ, walk up to the nearest enclosing fractal and place the unit there.

## 3. No evidence for a name means a decision is required, not invented

`shared` and `common` are names that can hold anything. When no meaningful organ name is supported by the evidence, the plan sets `requiresDecision: true` and stops for a human — do not invent a grab-bag name to let the plan proceed.

## 4. Planning is read-only; the postcondition demands the exact target

A functionally working but different result is a failed restructure. A plan reports normalized absolute source and target paths, basis, consumers, the computed ancestor, required artifacts, import rewrites and decision reasons; it may write only an ephemeral plan artifact. A precondition checks the snapshot hash immediately before execution. A postcondition checks the exact target, the source's absence, the node type, documents, entry point, import boundary, required rewrites and the acyclic graph. The restructure tool plans and validates; an external actor performs the change.

## 5. The document changes before the code does

Contracts lead; implementations follow. Before implementation that touches a fractal: identify every affected fractal; update each affected DETAIL contract, and INTENT when a public interface or boundary changes; implement the minimum change — for new behavior or a fix, first write a check and watch it fail for the intended reason; run scoped verification and the structural scan (warnings count as findings) and record the result and any deviation from the plan before the next review seam.

---

**This rule is working if:** shared units sit at an ancestor you can derive from their consumers, and DETAIL diffs precede the implementation diffs they describe. **This rule is wrong for you if:** the unit has exactly one consumer and always will — then it belongs beside that consumer, and none of this applies.
