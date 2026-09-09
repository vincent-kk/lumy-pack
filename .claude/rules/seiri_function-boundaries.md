# Function Boundaries

> **Precedence**: repository instructions (CLAUDE.md, project rules) > repository conventions > this rule > seiri defaults — the higher source wins. A function is the smallest unit a reader can hold whole — and the cheapest one to get wrong, because the cost lands on its callers. Applies when you are writing or moving a function. Purity moves effects, it does not remove them: push effects outward until they sit in one named place, not until every layer needs a wrapper.

## 1. Inputs arrive as parameters

The signature is the full list of what a function can see. Compute from arguments; module state read at call time, ambient config, the clock, and the environment are passed in, not reached for. When a dependency genuinely cannot be passed — a framework injects it, a runtime owns it — say so at the function or its file head (`seiri_agent-legible` §1) instead of reaching through it silently.

## 2. Effects live at the edge

Pure by default; effectful on purpose, in one named place. I/O, module-state writes, and mutation of what the caller owns stay in functions whose names announce them, called from the outer layer — not sprinkled through the computation they serve. Mutating an argument is an unwritten output: return the new value, or make the mutation the function's stated purpose. A function that both computes and persists is two functions and a caller.

## 3. One file, one exported function

Name a function file for the function it exports, and export that one only (`seiri_naming` §2); a second export earns its place only when the two cannot be read apart. At most two unexported helpers may share the file, and each helper's implementation body must be 8 lines or fewer; its declaration or signature and enclosing braces do not count. A longer helper is its own file (`seiri_structure` §3). At most three types, newly defined here; derived types — aliases, narrowings, unions over what already exists — stay with their source, and type-only files are outside this budget. These counts are defaults; a budget this repository declares wins.

## 4. A helper that moves out moves down

Extraction is not relocation to the same shelf. Helpers pulled out of a function do not become its flat neighbors: give the function a directory and file them one level under it — `utils/` or `helpers/` while their only claim is "these serve the function above", renamed for the topic once the set has one (`seiri_naming` §3). The path states which function is served and which serves.

---

**This rule is working if:** tests call functions without building a world first, and the caller of a helper sits one directory up, every time. **This rule is wrong for you if:** the framework owns the unit — components, route handlers, and generated clients follow their framework's shape; apply §1 and §2 inside them and leave the file layout to the convention.
