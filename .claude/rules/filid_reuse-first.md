# Reuse-First Implementation Rules

These rules define how to approach implementation work in a reuse-first codebase.
They work well with FCA, but they can also be used on their own.
They guide code reuse, extension, naming, and file authoring decisions.

---

## Relationship to FCA

- These rules MAY be used standalone or alongside FCA.
- When FCA is present, this document MUST NOT redefine FCA structural rules.
- When FCA is present, node classification, module boundaries, entry points, circular dependency rules, `INTENT.md`, `DETAIL.md`, and public API rules MUST follow FCA.
- If this document conflicts with FCA, FCA takes precedence unless the project explicitly replaces that rule.
- When FCA is not present, treat an independent module as a directory that exposes a clear public entry file (commonly `index.ts` or `main.ts`) and keeps implementation files behind that boundary.
- In standalone use, an independent module is a directory whose public contract is defined by one entry file and whose internal files are not meant to be imported directly by unrelated external directories.
- Even in standalone use, prefer acyclic dependencies, a clear public API, and predictable internal imports.
- This document primarily governs reuse, extension, file responsibility, and naming decisions. It does not replace a project's structural architecture rules.

---

## Solution Selection Priority

Before writing new logic, evaluate solutions in this strict priority order:

1. **Reuse existing shared code**
   - First determine whether the problem can be solved by directly using or composing existing utilities, helpers, modules, components, or installed libraries already present in the codebase.
2. **Safely extend an existing interface**
   - If direct reuse is insufficient, determine whether an existing shared abstraction can be extended without breaking current callers.
   - Safe extension means preserving current behavior and compatibility.
   - Prefer additive changes such as optional parameters, new exports, or wrapper functions.
   - Avoid silent semantic changes to existing APIs.
3. **Follow an existing repository pattern**
   - If no abstraction fits, search the current repository for similar problems and follow the closest proven implementation pattern.
   - Do NOT copy an existing pattern if it conflicts with FCA or this document, or if it is clearly outdated or defective.
4. **Adopt an industry-standard approach**
   - If the repository has no suitable precedent, research the language, framework, or library best practice for the problem.
   - Prefer official documentation, standards, and maintainers' guidance over ad hoc examples.
5. **Write new code**
   - Create a new implementation only when the problem is genuinely domain-specific or when the previous options do not solve it cleanly.

---

## File Authoring Rules

### single-responsibility-file

- Each file SHOULD focus on a single primary responsibility.
- Prefer files with 1-2 core logic functions.
- If a file needs 3 or more independent logic functions, first consider splitting the file or promoting the logic into a smaller submodule.
- In FCA projects, prefer decomposition into an existing organ directory or a new sub-fractal rather than adding new peer files at the fractal root.

### primary-runtime-export

- Prefer one primary runtime export per file.
- Additional runtime exports are allowed only when they are tightly coupled to the same responsibility and separating them would reduce clarity.
- Type-only exports are always allowed.
- When FCA is present, this guideline applies at the file level only and MUST NOT be interpreted as redefining the module's public API boundary.

### local-index-boundary

- In standalone modules, internal implementation files SHOULD NOT use the local `index.ts` as an internal routing layer.
- Prefer importing the concrete internal file that provides the needed behavior when doing so does not conflict with the project's architectural boundary rules.
- When FCA is present, follow FCA import and entry-point rules instead of this guideline.
- The local `index.ts` is typically an external boundary for consumers, not a default internal indirection layer.

---

## Naming Guidance

### collection-directory-naming

- Collection-style directories SHOULD use plural names. In FCA terms, these are usually organ directories.
- Recommended examples: `components/`, `utils/`, `helpers/`, `types/`, `hooks/`, `constants/`.
- Do NOT force plural naming onto domain directories when the singular form is clearer or already established.

### file-naming

- File names SHOULD describe one concrete responsibility and use kebab-case or camelCase according to project conventions.
- **Exception**: Files primarily exporting UI components (e.g., React) MAY use PascalCase if it is the established framework convention.
- If FCA naming enforcement is active, this exception applies only when that enforcement is also disabled or overridden for those files.
- Prefer singular file names for files that represent one primary unit of behavior or one primary type grouping.
- Avoid generic names such as `common.ts`, `misc.ts`, `temp.ts`, or `new.ts` unless the directory itself makes the responsibility explicit.

### test-file-naming

- Source-adjacent unit test files SHOULD match the base name of the primary file they verify.
- Append the standard test suffix (e.g., `.spec.ts` or `.test.ts`) to the target file's name when the test is focused on one file.
- Module, integration, and entry-point tests MAY use broader names when they verify behavior spanning multiple files.

### simple-type-exception

- If a `types/` directory would contain only a very small set of closely related simple types, a single `type.ts` file MAY be used instead of splitting immediately.
- If the type surface grows or starts mixing unrelated concerns, split it into clearer files.

---

## Review Heuristics

- When adding a new file, ask whether an existing abstraction can solve the problem first.
- When extending a shared abstraction, ask whether the change is backward-compatible.
- When copying an existing pattern, ask whether it is still the best current pattern.
- When a file grows in exports or responsibilities, ask whether it should become a smaller submodule or be decomposed into helper, util, or type files.
- In FCA projects, prefer moving that logic into an existing organ directory or introducing a sub-fractal instead of adding new root-level peer files.
- When applying a repository pattern, verify that the pattern still conforms to FCA entry-point and boundary rules before copying it.