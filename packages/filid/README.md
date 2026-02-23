# @lumy-pack/filid

A Claude Code plugin that automatically manages project structure and documentation.

As codebases grow, AI agents lose context, documentation drifts from code, and directory structures lose consistency. filid solves this through automated rule enforcement based on **Fractal Context Architecture (FCA-AI)**.

---

## Installation

### Via Marketplace (Recommended)

```bash
# 1. Add the repository to your marketplace
claude plugin marketplace add https://github.com/vincent-kk/lumy-pack

# 2. Install the plugin
claude plugin install filid
```

All components (Skills, MCP, Agents, Hooks) register automatically. No manual configuration needed.

### For Development (Local Setup)

```bash
# From monorepo root
yarn install

# Build the plugin
cd packages/filid
yarn build          # TypeScript compile + bundling

# Load in Claude Code
claude --plugin-dir ./packages/filid
```

Building produces two outputs:

- `bridge/mcp-server.cjs` — MCP server (14 analysis tools)
- `bridge/*.mjs` — 6 hook scripts (automatic rule enforcement)

---

## How to Use

filid skills are **LLM prompts**, not CLI commands. You invoke them in Claude Code as natural language conversations. Flags like `--fix` are hints the LLM understands, but plain language works just as well.

### Initialize a Project

```
/filid:fca-init
/filid:fca-init ./packages/my-app
```

Scans directories and generates `CLAUDE.md` boundary documents for each module. Utility directories like `components/`, `utils/` (organs) are automatically skipped.

### Find and Fix Violations

```
/filid:fca-scan
/filid:fca-scan src/core 쪽만 봐줘
/filid:fca-scan 고칠 수 있는 건 고쳐줘
```

Detects CLAUDE.md exceeding 100 lines, missing boundary sections, CLAUDE.md in organ directories, etc.

### Sync Documentation After Code Changes

```
/filid:fca-sync
/filid:fca-sync 바뀌는 것만 미리 보여줘
/filid:fca-sync critical 이상만 처리해줘
```

Detects structural drift and updates the affected CLAUDE.md/SPEC.md files. Uses `drift-detect` MCP tool internally.

### Full Project Structure Check

```
/filid:fca-structure-review
/filid:fca-structure-review 3단계만 실행해줘
```

Scans the **entire project** across 6 stages: boundary check → document validation → dependency analysis → test metrics → complexity assessment → final verdict.

> Use for periodic structural health checks or before/after large refactors. Running this on every PR is expensive — use `fca-review` instead.

### AI Code Review (per PR)

The most powerful feature. A multi-persona consensus committee reviews only the **files changed in this PR**.

```
# Review current branch
/filid:fca-review

# Review a specific PR
/filid:fca-review https://github.com/owner/repo/pull/123

# Force restart (discard previous review)
/filid:fca-review 처음부터 다시 해줘

# After review — handle fix requests
/filid:fca-resolve

# After fixes — final verdict
/filid:fca-revalidate
```

**Flow:**

1. **`/filid:fca-review`** — Structure check (diff) → committee election → technical verification → consensus → review report
2. **`/filid:fca-resolve`** — Accept or reject each fix request (with justification for rejections)
3. **`/filid:fca-revalidate`** — Final PASS/FAIL verdict after fixes

Outputs go to `.filid/review/<branch>/`, technical debt to `.filid/debt/`.

> **`fca-structure-review` vs `fca-review` at a glance:**
>
> - `fca-structure-review` — full project scan (periodic health check)
> - `fca-review` — changed files only + multi-persona review (use on every PR)

### Learn About FCA-AI

```
/filid:fca-guide
/filid:fca-guide fractal 구조에 대해 알려줘
/filid:fca-context-query organ 디렉토리에서 뭘 할 수 있어?
```

### Improve Module Structure

```
/filid:fca-restructure ./src/core
/filid:fca-promote
```

---

## What Runs Automatically

With the plugin active, these hooks fire **without user intervention**:

| When                   | What                                  | Why                                                              |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Writing/editing a file | Checks CLAUDE.md 100-line limit       | Prevents document bloat                                          |
| Writing/editing a file | Blocks CLAUDE.md in organ directories | Prevents unnecessary docs in utility folders                     |
| Sub-agent starting     | Injects role restrictions             | Prevents agents from overstepping (e.g., architect editing code) |
| User submits a prompt  | Injects FCA-AI rule context           | Ensures agents are aware of rules while working                  |

When a block occurs, a message explaining the reason is displayed. No action needed.

---

## Skills Reference

| Skill                         | Scope             | What it does                                               |
| ----------------------------- | ----------------- | ---------------------------------------------------------- |
| `/filid:fca-init`             | —                 | Initialize FCA-AI in a project                             |
| `/filid:fca-scan`             | Full project      | Detect rule violations (with optional auto-fix)            |
| `/filid:fca-sync`             | Full project      | Sync documentation with code changes                       |
| `/filid:fca-structure-review` | **Full project**  | 6-stage structural health check — periodic or pre-refactor |
| `/filid:fca-promote`          | —                 | Promote stable tests to spec                               |
| `/filid:fca-context-query`    | —                 | Q&A about project structure                                |
| `/filid:fca-guide`            | —                 | FCA-AI guidance on any topic                               |
| `/filid:fca-restructure`      | —                 | Module refactoring guide with migration steps              |
| `/filid:fca-review`           | **Changed files** | Multi-persona governance code review — use on every PR     |
| `/filid:fca-resolve`          | —                 | Resolve fix requests from a review                         |
| `/filid:fca-revalidate`       | —                 | Post-fix re-validation (PASS/FAIL)                         |

---

## Key Rules

Core rules enforced by filid:

| Rule                       | Threshold                                            | Enforcement         |
| -------------------------- | ---------------------------------------------------- | ------------------- |
| CLAUDE.md line limit       | 100 lines max                                        | Hook (auto-block)   |
| 3-tier boundary sections   | "Always do" / "Ask first" / "Never do" required      | Hook (warning)      |
| Organ directory protection | No CLAUDE.md in `components`, `utils`, `types`, etc. | Hook (auto-block)   |
| Test density               | Max 15 per spec.ts (3 core + 12 edge)                | MCP analysis        |
| Module cohesion            | LCOM4 >= 2 triggers split recommendation             | MCP + decision tree |
| Circular dependencies      | Acyclic graph (DAG) required                         | Core validation     |

---

## Development

```bash
yarn dev            # TypeScript watch mode
yarn test           # Vitest watch
yarn test:run       # Single run
yarn typecheck      # Type checking only
yarn build          # tsc + node build-plugin.mjs
```

### Tech Stack

TypeScript 5.7 (+ Compiler API), @modelcontextprotocol/sdk, fast-glob, esbuild, Vitest, Zod

---

## Documentation

For technical details, see the [`.metadata/`](./.metadata/) directory:

| Document                                             | Content                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| [ARCHITECTURE](./.metadata/01-ARCHITECTURE.md)       | Design philosophy, 4-layer architecture, ADRs                  |
| [BLUEPRINT](./.metadata/02-BLUEPRINT.md)             | Technical blueprint for 30+ modules                            |
| [LIFECYCLE](./.metadata/03-LIFECYCLE.md)             | Skill workflows, agent collaboration, hook timeline            |
| [USAGE](./.metadata/04-USAGE.md)                     | Config file structure, MCP/Hook JSON examples, troubleshooting |
| [COST-ANALYSIS](./.metadata/05-COST-ANALYSIS.md)     | Hook overhead, bundle size, context token costs                |
| [HOW-IT-WORKS](./.metadata/06-HOW-IT-WORKS.md)       | AST engine, decision tree, MCP routing                         |
| [RULES-REFERENCE](./.metadata/07-RULES-REFERENCE.md) | Full rule catalog with constants and thresholds                |
| [API-SURFACE](./.metadata/08-API-SURFACE.md)         | Public API reference (33 functions + 30 types)                 |

[Korean documentation (README-ko_kr.md)](./README-ko_kr.md) is also available.

---

## License

MIT
