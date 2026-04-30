# Reuse-First Implementation Rules

Behavioral guidelines for what to write, when to extend, and when to reuse.
Standalone document — does not depend on other rule files.

**Tradeoff:** These guidelines bias toward existing code over fresh code.
For prototypes or exploratory spikes, use judgment.

## 1. Reuse Before You Write

**Search first. Compose second. Write last.**

Before writing new logic, evaluate solutions in this strict priority order:

1. **Reuse existing shared code** — utilities, helpers, modules, components,
   installed libraries already in the codebase. Direct use or composition
   first.
2. **Safely extend an existing interface** — additive only (optional params,
   new exports, wrappers). Preserve current behavior. No silent semantic
   changes to existing APIs.
3. **Follow an existing repository pattern** — find the closest proven
   implementation and mirror it. Skip the pattern if it's clearly outdated
   or defective.
4. **Adopt an industry-standard approach** — official docs, standards,
   maintainer guidance. Prefer over ad hoc examples.
5. **Write new code** — only when the problem is genuinely domain-specific
   or no precedent fits cleanly.

Ask yourself: "Does this already exist somewhere I haven't searched?"

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?"

## 3. Surgical Changes

**Touch only what you must. Match existing style.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes orphaned.
  Don't remove pre-existing dead code unless asked.

Test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

Strong success criteria let you loop independently. Weak criteria
("make it work") require constant clarification.

## 5. One File, One Responsibility

**One primary export per file. Split before files grow lumpy.**

- Each file focuses on one primary responsibility — prefer 1-2 core
  functions per file.
- Three or more independent functions → split the file or promote logic
  into a smaller submodule.
- One primary runtime export per file. Additional runtime exports only
  when tightly coupled to the same responsibility. Type-only exports are
  always allowed.
- Internal implementation files should import concrete internal files
  directly, not route through the local `index.ts`. The local `index.ts`
  is an external boundary, not a default indirection layer.
- Avoid generic names: `common.ts`, `misc.ts`, `temp.ts`, `new.ts`.

Ask yourself: "If this file grows another export, should it split?"

## 6. Names Mirror Siblings

**Match neighbors first, industry standards second.**

- File names describe one concrete responsibility.
- camelCase by default; kebab-case or PascalCase per domain (React UI
  files typically PascalCase).
- Mirror the style of sibling files in the same directory. No siblings?
  Use the language/framework's industry-standard form.
- Source-adjacent unit tests match the base name of what they verify
  (e.g., `auth.ts` → `auth.spec.ts` or `auth.test.ts`).
- Collection-style directories use plural names (`components/`, `utils/`,
  `helpers/`, `types/`, `hooks/`, `constants/`). Don't force plural onto
  domain directories where singular is clearer.
- A small set of closely related types may live in a single `type.ts`.
  Split when the type surface grows or mixes unrelated concerns.

Ask yourself: "What naming style do my neighbors already use?"
