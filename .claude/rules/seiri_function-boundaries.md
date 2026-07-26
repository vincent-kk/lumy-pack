# Function Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults. On conflict, the higher source wins and this rule yields.

A function is the smallest unit a reader can hold whole — and the cheapest one to get wrong, because the cost lands on its callers. This rule rests on properties every codebase has: functions take inputs and produce outputs, and they live in files with names.

**Tradeoff:** purity moves effects, it does not remove them — a program that touches nothing does nothing. Push effects outward until they sit in one named place, not until every layer needs a wrapper. **Applies when:** you are writing or moving a function.

## 1. Inputs arrive as parameters

**The signature is the full list of what a function can see.**

- Compute from arguments. Module state read at call time, ambient config, the clock, the environment: passed in, not reached for.
- When a dependency genuinely cannot be passed — a framework injects it, a runtime owns it — say so at the function or its file head (seiri_agent-legible §1) instead of reaching through it silently.

Ask yourself: "Given the same arguments, does this return the same thing?"

## 2. Effects live at the edge

**Pure by default; effectful on purpose, in one named place.**

- I/O, module-state writes, mutation of what the caller owns: keep them in functions whose names announce them, called from the outer layer — not sprinkled through the computation they serve.
- Mutating an argument is an unwritten output. Return the new value, or make the mutation the function's stated purpose.
- A function that both computes and persists is two functions and a caller.

Ask yourself: "If this ran twice, what would differ the second time — and does the name warn me?"

## 3. One file, one exported function

**The file name is the export list.**

- Name a function file for the function it exports, and export that one only (seiri_naming §4). A second export earns its place only when the two cannot be read apart.
- At most two unexported helpers may share the file, and only ones a reader takes in at a glance; past that, the helper is its own file (seiri_structure §3).
- At most three types, newly defined here. Derived types — aliases, narrowings, unions over what already exists — stay with their source. Type-only files (`types.ts`, `types/`) are outside this budget.
- These counts are defaults; a budget this repository declares wins.

Ask yourself: "Can I name what this file exports without opening it — and can I find every caller by searching that one name?"

## 4. A helper that moves out moves down

**Extraction is not relocation to the same shelf.**

- Helpers pulled out of a function do not become its flat neighbors: give the function a directory and file them one level under it, in a satellite called `utils/` or `helpers/` while its only claim is "these serve the function above" — named for the topic once the set has one (seiri_naming §3).
- The path states which function is served and which serves. A row of peers states nothing (seiri_structure §2).

Ask yourself: "From the path alone, can I tell the entry point from its helpers?"

---

**This rule is working if:** tests call functions without building a world first; a file's imports stay countable at a glance; the caller of a helper sits one directory up, every time. **This rule is wrong for you if:** the framework owns the unit — components, route handlers, and generated clients follow their framework's shape; apply §1 and §2 inside them and leave the file layout to the convention.
