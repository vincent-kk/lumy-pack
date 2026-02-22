# @lumy-pack/filid

A Claude Code plugin that automatically manages project structure and documentation.

As codebases grow, AI agents lose context, documentation drifts from code, and directory structures lose consistency. filid solves this through automated rule enforcement based on **Fractal Context Architecture (FCA-AI)**.

---

## Installation

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

- `libs/server.cjs` — MCP server (11 analysis tools)
- `scripts/*.mjs` — 5 hook scripts (automatic rule enforcement)

All components (Skills, MCP, Agents, Hooks) register automatically after installation. No manual configuration needed.

---

## How to Use

filid skills are **LLM prompts**, not CLI commands. You invoke them in Claude Code as natural language conversations. Flags like `--fix` are hints the LLM understands, but plain language works just as well.

### Initialize a Project

```
/filid:init
/filid:init ./packages/my-app
```

Scans directories and generates `CLAUDE.md` boundary documents for each module. Utility directories like `components/`, `utils/` (organs) are automatically skipped.

### Find and Fix Violations

```
/filid:scan
/filid:scan src/core 쪽만 봐줘
/filid:scan 고칠 수 있는 건 고쳐줘
```

Detects CLAUDE.md exceeding 100 lines, missing boundary sections, CLAUDE.md in organ directories, etc.

### Sync Documentation After Code Changes

```
/filid:sync
/filid:sync 바뀌는 것만 미리 보여줘
/filid:sync critical 이상만 처리해줘
```

Detects structural drift and updates the affected CLAUDE.md/SPEC.md files. Uses `drift-detect` MCP tool internally.

### Verify Structure Before a PR

```
/filid:structure-review
/filid:structure-review 3단계만 실행해줘
```

Runs 6 stages: boundary check -> document validation -> dependency analysis -> test metrics -> complexity assessment -> final verdict.

### AI Code Review

The most powerful feature. A multi-persona consensus committee reviews code in three phases.

```
# Review current branch
/filid:code-review

# Review a specific PR
/filid:code-review https://github.com/owner/repo/pull/123

# Force restart (discard previous review)
/filid:code-review 처음부터 다시 해줘

# After review — handle fix requests
/filid:resolve-review

# After fixes — final verdict
/filid:re-validate
```

**Flow:**

1. **`/filid:code-review`** — Committee election -> technical verification -> consensus -> review report
2. **`/filid:resolve-review`** — Accept or reject each fix request (with justification for rejections)
3. **`/filid:re-validate`** — Final PASS/FAIL verdict after fixes

Outputs go to `.filid/review/<branch>/`, technical debt to `.filid/debt/`.

### Learn About FCA-AI

```
/filid:guide
/filid:guide fractal 구조에 대해 알려줘
/filid:context-query organ 디렉토리에서 뭘 할 수 있어?
```

### Improve Module Structure

```
/filid:restructure ./src/core
/filid:promote
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

| Skill                     | What it does                                    |
| ------------------------- | ----------------------------------------------- |
| `/filid:init`             | Initialize FCA-AI in a project                  |
| `/filid:scan`             | Detect rule violations (with optional auto-fix) |
| `/filid:sync`             | Sync documentation with code changes            |
| `/filid:structure-review` | 6-stage PR structure verification               |
| `/filid:promote`          | Promote stable tests to spec                    |
| `/filid:context-query`    | Q&A about project structure                     |
| `/filid:guide`            | FCA-AI guidance on any topic                    |
| `/filid:restructure`      | Module refactoring guide with migration steps   |
| `/filid:code-review`      | Multi-persona governance code review            |
| `/filid:resolve-review`   | Resolve fix requests from a review              |
| `/filid:re-validate`      | Post-fix re-validation (PASS/FAIL)              |

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
