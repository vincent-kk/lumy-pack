# Code Placement

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > filid defaults. On conflict, the higher source wins and this rule yields.

Where a unit sits decides who may reach it, which makes placement a boundary decision rather than a filing decision. These rules govern where shared code goes, and what a restructure must prove before and after it runs. This rule rests on properties every codebase has: a unit has a location, and its consumers have locations too.

**Tradeoff:** moving code to its lowest common fractal creates churn today to remove a boundary violation permanently — prefer the move at a natural seam, not mid-task. **Applies when:** you are adding a unit with more than one consumer, or moving one.

## 1. Shared code sits at the lowest common fractal of its consumers

**The consumers' common ancestor is the address; anything higher is a guess.**

- Compute the lowest common fractal of the consumer owners, and place the unit under it.
- A single-consumer internal unit defaults to an organ of that owner — one consumer is not shared code.
- A unit with an independent public contract becomes a child fractal instead, with its intent, detail and entry-point artifacts.

Ask yourself: "Who consumes this — and what is the nearest fractal that contains all of them?"

## 2. An organ cannot be a lowest common ancestor

**An organ has no entry point, so it cannot own a shared boundary.**

- When the computed ancestor is an organ, walk up to the nearest enclosing fractal and place it there.

Ask yourself: "Is the target I picked a fractal, or a compartment inside one?"

## 3. No evidence for a name means a decision is required, not invented

**`shared` and `common` are names that can hold anything.**

- When no meaningful organ name is supported by the evidence, the plan sets `requiresDecision: true` and stops for a human.
- Do not invent a grab-bag name to let the plan proceed.

Ask yourself: "Does the evidence name this group, or am I naming it to get unblocked?"

## 4. Planning is read-only; the postcondition demands the exact target

**A functionally working but different result is a failed restructure.**

- A plan reports normalized absolute source and target paths, basis, consumers, the computed ancestor, required artifacts, import rewrites and decision reasons. It may write only an ephemeral plan artifact.
- A precondition checks the snapshot hash immediately before execution.
- A postcondition checks the exact target, the source's absence, the node type, documents, entry point, import boundary, required rewrites and the acyclic graph.
- A restructure tool plans and validates; an external actor performs the change.

Ask yourself: "If the code works but landed one directory over, does my check catch it?"

## 5. The document changes before the code does

**Contracts lead; implementations follow.**

Before implementation that touches a fractal:

- Identify every affected fractal.
- Update each affected DETAIL contract, and INTENT when a public interface or boundary changes.
- Implement the minimum change; for new behavior or a fix, first write a check and watch it fail for the intended reason.
- Run scoped verification and the structural scan — warnings count as findings — and record the result and any deviation from the plan before the next review seam.

Ask yourself: "Did the contract change before the code, or am I about to write it up afterwards?"

---

**This rule is working if:** shared units sit at an ancestor you can derive from their consumers; restructures land on the exact planned path; DETAIL diffs precede the implementation diffs they describe. **This rule is wrong for you if:** the unit has exactly one consumer and always will — then it belongs beside that consumer, and none of this applies.
