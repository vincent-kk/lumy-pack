# Rule: documentation

This file covers the documentation conventions enforced by filid's `document-validator.ts`.
These are not standalone rule IDs in the rule engine but are enforced via PreToolUse hooks.

---

## CLAUDE.md Conventions

### 100-Line Limit

Every `CLAUDE.md` file must not exceed **100 lines**.

CLAUDE.md is a working context document, not a design document. It must remain concise enough to be injected into Claude's context window without consuming excessive tokens. When a CLAUDE.md approaches 100 lines, it is a signal that the module has grown too large and should be decomposed into smaller fractal nodes, each with their own CLAUDE.md.

**Enforcement**: The `pre-tool-validator` hook blocks `Write` operations that produce a CLAUDE.md exceeding 100 lines (`continue: false`).

### 3-Tier Boundary Sections

Every `CLAUDE.md` must include the following three sections:

```markdown
## Always do

<!-- Actions that must always be taken in this module -->

## Ask first

<!-- Actions that require discussion before proceeding -->

## Never do

<!-- Actions that are strictly prohibited in this module -->
```

These sections define the behavioral contract for AI agents working within the module. Missing sections trigger a warning (not a block) via the hook.

### CLAUDE.md Template

```markdown
# <Module Name>

## Purpose

Brief description of what this module does and its role in the architecture.

## Structure

| File/Directory | Role |
|---|---|
| `example.ts` | Description |

## Conventions

Key patterns and decisions for this module.

## Always do

- ...

## Ask first

- ...

## Never do

- ...
```

---

## SPEC.md Conventions

### No Append-Only Growth

`SPEC.md` must not grow by appending new content to the end of the existing file.
Each update must restructure the specification to reflect the current state of the module.

Append-only growth indicates the spec has become a changelog or a log of decisions rather than a living specification. A spec that only grows never gets pruned of stale or obsolete requirements.

**Enforcement**: The `pre-tool-validator` hook blocks `Write` operations where the new content is detected as append-only relative to the existing file content (`continue: false`).

### SPEC.md Purpose

SPEC.md is the formal specification document for a fractal module. It defines:
- The module's public API contract
- Acceptance criteria for the current implementation
- Scope boundaries for the `implementer` agent

SPEC.md is read by the `implementer` agent to constrain implementation scope. It must always reflect the current intended behavior, not the historical evolution of decisions.

---

## Test File Conventions

Test files follow the **3+12 rule**:

- Maximum **3 basic test cases** (happy path, primary functionality)
- Maximum **12 complex test cases** (edge cases, error paths, boundary conditions)
- Total maximum: **15 test cases per spec file**

Exceeding 15 cases in a single spec file is a signal that the module under test is doing too much and should be split.

This is enforced by the `test-metrics` MCP tool and reported by `fca-scan`.
