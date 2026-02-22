# @lumy-pack/filid

**FCA-AI (Fractal Context Architecture for AI Agents) rule enforcement plugin for Claude Code.**

filid solves the **Context Rot** problem — where AI agents lose coherence across large codebases due to context window limits, documentation drift, and uncontrolled growth. It enforces fractal decomposition principles through hooks, MCP tools, specialized agents, and user-invocable skills.

## Quick Start

### Option A: Install from Marketplace

If the plugin is published to a marketplace, install it directly in Claude Code:

```bash
# 1. Add the marketplace (one-time setup)
/plugin marketplace add vincent-kk/lumy-pack

# 2. Install the plugin
/plugin install filid@lumy-pack

# Done! Skills, agents, hooks, and MCP tools are automatically activated.
```

### Option B: Install from Local Directory

For development or manual installation:

```bash
# 1. Clone the repository
git clone https://github.com/vincent-kk/lumy-pack.git
cd lumy-pack/packages/filid

# 2. Install dependencies and build
npm install
npm run build    # TypeScript compile + plugin bundle

# 3. Launch Claude Code with the plugin loaded
claude --plugin-dir ./
```

### Option C: Install from npm

Reference via a marketplace catalog entry:

```json
{
  "plugins": [{
    "name": "filid",
    "source": { "source": "npm", "package": "@lumy-pack/filid" }
  }]
}
```

### Verify Installation

Once installed, verify that all components are active:

```bash
# Check skills are registered
/filid:scan

# Check MCP tools are available (in Claude Code)
# The 4 MCP tools (ast-analyze, fractal-navigate, doc-compress, test-metrics)
# will appear automatically in the tool list.

# Check agents (architect, implementer, context-manager, qa-reviewer)
# are listed in /agents

# Check hooks are firing
# Write/Edit operations will trigger pre-tool-validator and organ-guard hooks.
```

### First Steps After Installation

```bash
# Initialize FCA-AI architecture in your project
/filid:init

# Audit current project for violations
/filid:scan

# Fix auto-remediable violations
/filid:scan --fix
```

### What Gets Activated

| Component | Count | Auto-registered | User Action Needed |
|-----------|-------|-----------------|-------------------|
| **Skills** | 6 | Yes — available as `/filid:*` commands | None |
| **MCP Tools** | 4 | Yes — MCP server starts automatically | None |
| **Agents** | 4 | Yes — available as subagents | None |
| **Hooks** | 5 | Yes — fire on matching events | None |

All components are automatically registered when the plugin is enabled. No manual configuration required.

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Fractal** | A self-similar, independent module unit with its own `CLAUDE.md` boundary document |
| **Organ** | A shared utility directory (e.g., `utils/`, `components/`, `hooks/`) — isolated at leaf level, no `CLAUDE.md` allowed |
| **3-Tier Boundary** | Every `CLAUDE.md` must define "Always do", "Ask first", and "Never do" sections |
| **CLAUDE.md 100-line limit** | Strict density control — forces concise, high-signal documentation |
| **3+12 Rule** | Maximum 15 test cases per `spec.ts` file (3 core + 12 edge cases) |
| **LCOM4 / CC Decision Tree** | Automated split/compress recommendations based on cohesion and cyclomatic complexity metrics |

## Development

### Prerequisites

- **Node.js** >= 20.0.0
- **Claude Code** >= 1.0.33 (plugin system support)

### Build

```bash
# Full build (TypeScript compile + plugin bundle)
yarn build

# Plugin bundle only (MCP server + hook scripts)
node build-plugin.mjs

# Development mode (watch)
yarn dev
```

Build outputs:
- `libs/server.cjs` — MCP server bundle (~516KB, CJS)
- `scripts/*.mjs` — 5 hook script bundles (ESM)

### Test

```bash
yarn test          # Watch mode
yarn test:run      # Single run
yarn test:coverage # With coverage report
yarn typecheck     # Type checking only
```

### Local Plugin Development

```bash
# Test plugin changes without installing
claude --plugin-dir ./packages/filid

# Validate plugin structure
claude plugin validate ./packages/filid
```

## Architecture

filid operates through a **4-layer architecture**, ordered by automation level:

```
┌─────────────────────────────────────────────────────┐
│                  Claude Code Runtime                 │
│                                                      │
│  Layer 1: HOOKS (automatic, event-driven)            │
│  ┌─────────────────────────────────────────────────┐ │
│  │ PreToolUse  → pre-tool-validator, organ-guard   │ │
│  │ PostToolUse → change-tracker                    │ │
│  │ SubagentStart → agent-enforcer                  │ │
│  │ UserPromptSubmit → context-injector             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Layer 2: MCP TOOLS (on-demand analysis)             │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ast-analyze │ fractal-navigate │ doc-compress   │ │
│  │ test-metrics                                    │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Layer 3: AGENTS (role-restricted autonomy)          │
│  ┌─────────────────────────────────────────────────┐ │
│  │ architect(RO) │ implementer │ context-manager   │ │
│  │ qa-reviewer(RO)                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Layer 4: SKILLS (user-invoked workflows)            │
│  ┌─────────────────────────────────────────────────┐ │
│  │ /init │ /scan │ /sync │ /structure-review │ /promote │ │
│  │ /context-query                                  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

| Layer | Role | Trigger | Interface |
|-------|------|---------|-----------|
| **Hook** | Rule enforcement (block/inject) | Automatic (event-based) | stdin/stdout JSON |
| **MCP** | Analysis tools | Agent invocation | JSON-RPC over stdio |
| **Agent** | Role-scoped workflows | System/user directive | Claude Code subagent |
| **Skill** | High-level task units | User `/command` | SKILL.md prompt |

## Skills

### `/filid:init` — Initialize FCA-AI Architecture

Classifies directories as fractal/organ/pure-function, generates `CLAUDE.md` for fractals, and validates the structure.

```
/filid:init [path]
```

### `/filid:scan` — Audit for Violations

Detects FCA-AI rule violations (CLAUDE.md limits, organ boundaries, test rules) with optional auto-fix.

```
/filid:scan [path] [--fix]
```

### `/filid:structure-review` — PR Verification Pipeline

Runs a 6-stage verification pipeline on pull request changes.

```
/filid:structure-review [--stage=1-6] [--verbose]
```

**Stages**: boundary check → document validation → dependency analysis → test metrics → complexity assessment → final verdict

### `/filid:promote` — Test Promotion

Promotes stable regression tests (`test.ts`) to specification tests (`spec.ts`) after meeting stability criteria.

```
/filid:promote [path] [--days=90]
```

### `/filid:context-query` — Context Query

Answers targeted questions about project structure within a 3-prompt limit, applying compression when context exceeds thresholds.

```
/filid:context-query <question>
```

### `/filid:sync` — Document Synchronization

Batch-applies accumulated documentation updates from the ChangeQueue at PR time.

```
/filid:sync [--dry-run]
```

## MCP Tools

Four tools exposed via stdio JSON-RPC transport:

### `ast-analyze`

AST-based code analysis using the TypeScript Compiler API.

| Action | Description |
|--------|-------------|
| `dependency-graph` | Extract imports, exports, calls, and inheritance |
| `lcom4` | Calculate Lack of Cohesion of Methods (split indicator) |
| `cyclomatic-complexity` | Calculate cyclomatic complexity (compress indicator) |
| `tree-diff` | Compute semantic diff between two source versions |
| `full` | Run all analyses at once |

```json
{
  "source": "class Foo { x = 0; getX() { return this.x; } }",
  "analysisType": "lcom4",
  "className": "Foo"
}
// → { "value": 1, "components": [["getX"]], "methodCount": 1, "fieldCount": 1 }
```

### `fractal-navigate`

Directory classification and fractal tree operations.

| Action | Description |
|--------|-------------|
| `classify` | Determine if a directory is fractal, organ, or pure-function |
| `siblings` | List sibling nodes at the same tree level |
| `tree` | Build the full fractal hierarchy tree |

### `doc-compress`

Context compression for token optimization.

| Mode | Description | Recoverable |
|------|-------------|-------------|
| `reversible` | File-reference compression (path + exports + line count) | 100% |
| `lossy` | Tool call history summarization | No |
| `auto` | Selects mode based on content type | Varies |

### `test-metrics`

Test analysis and decision support.

| Action | Description |
|--------|-------------|
| `count` | Count test cases in a file |
| `check-312` | Validate the 3+12 rule (max 15 tests per spec.ts) |
| `decide` | Run the decision tree (split/compress/parameterize recommendation) |

```json
{
  "action": "decide",
  "decisionInput": { "testCount": 20, "lcom4": 3, "cyclomaticComplexity": 10 }
}
// → { "decision": { "action": "split", "reason": "LCOM4 = 3 indicates multiple responsibilities..." } }
```

## Agents

Four specialized agents with role-based tool restrictions:

| Agent | Model | Tools Restricted | Purpose |
|-------|-------|-----------------|---------|
| **architect** | opus | Write, Edit, Bash | Read-only design, planning, SPEC.md drafting |
| **implementer** | sonnet | _(none)_ | Code implementation within approved SPEC.md scope |
| **context-manager** | sonnet | _(none)_ | CLAUDE.md/SPEC.md sync, AST-based drift detection |
| **qa-reviewer** | sonnet | Write, Edit, Bash | Read-only test metrics validation, PR review |

## Hooks

Runtime enforcement hooks that fire automatically on Claude Code events:

| Hook Event | Matcher | Script | Purpose |
|------------|---------|--------|---------|
| `PreToolUse` | `Write\|Edit` | `pre-tool-validator` | Validate CLAUDE.md line limits, SPEC.md constraints |
| `PreToolUse` | `Write\|Edit` | `organ-guard` | Block CLAUDE.md creation in organ directories |
| `PostToolUse` | `Write\|Edit` | `change-tracker` | Record changes in ChangeQueue for batch sync |
| `SubagentStart` | `*` | `agent-enforcer` | Inject role constraints into sub-agents |
| `UserPromptSubmit` | `*` | `context-injector` | Inject FCA-AI rules into agent context |

## Configuration

### Plugin Manifest (`.claude-plugin/plugin.json`)

```json
{
  "name": "filid",
  "version": "1.0.0",
  "description": "FCA-AI rule enforcement for Claude Code agent workflows",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

### MCP Server (`.mcp.json`)

```json
{
  "mcpServers": {
    "filid": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/libs/server.cjs"]
    }
  }
}
```

### Hooks (`hooks/hooks.json`)

Registers 5 hook scripts across 4 Claude Code lifecycle events. See [Usage Guide](./.metadata/04-USAGE.md) for the full configuration.

## Project Structure

```
packages/filid/
├── src/
│   ├── index.ts              # Library exports (33 functions + 30 types)
│   ├── types/                # Type definitions (6 files)
│   ├── core/                 # Business logic (5 modules)
│   │   ├── fractal-tree.ts       # Fractal hierarchy building & navigation
│   │   ├── document-validator.ts  # CLAUDE.md / SPEC.md validation
│   │   ├── organ-classifier.ts    # Directory classification
│   │   ├── dependency-graph.ts    # DAG construction & cycle detection
│   │   └── change-queue.ts        # PR-time change batching
│   ├── ast/                  # AST analysis (5 modules)
│   │   ├── parser.ts              # TypeScript Compiler API parser
│   │   ├── dependency-extractor.ts # Import/export/call extraction
│   │   ├── lcom4.ts               # Lack of Cohesion of Methods
│   │   ├── cyclomatic-complexity.ts # Cyclomatic complexity
│   │   └── tree-diff.ts           # Semantic source diff
│   ├── metrics/              # Decision engines (4 modules)
│   │   ├── test-counter.ts        # Test case counting
│   │   ├── three-plus-twelve.ts   # 3+12 rule enforcement
│   │   ├── promotion-tracker.ts   # Test stability tracking
│   │   └── decision-tree.ts       # Split/compress/parameterize logic
│   ├── compress/             # Context compression (2 modules)
│   │   ├── reversible-compactor.ts # File-reference compression
│   │   └── lossy-summarizer.ts     # Tool history summarization
│   ├── hooks/                # Runtime hooks (5 modules + entries)
│   └── mcp/                  # MCP server + 4 tool handlers
├── skills/                   # 6 user-invocable skills
│   └── {init,scan,sync,structure-review,promote,context-query}/SKILL.md
├── agents/                   # 4 specialized agent definitions
│   └── {architect,implementer,context-manager,qa-reviewer}.md
├── hooks/hooks.json          # Hook event registration
├── libs/server.cjs           # MCP server bundle
├── scripts/*.mjs             # Hook script bundles
└── .metadata/                # Design documentation archive (8 docs)
```

## Programmatic API

filid exports 33 functions and 30 types for direct use:

```typescript
import {
  // Core
  buildFractalTree, findNode, validateClaudeMd, classifyNode,
  buildDAG, detectCycles, ChangeQueue,

  // AST Analysis
  parseSource, extractDependencies, calculateLCOM4, calculateCC, computeTreeDiff,

  // Metrics
  countTestCases, check312Rule, decide, checkPromotionEligibility,

  // Compression
  compactReversible, restoreFromCompacted, summarizeLossy,

  // Hooks
  validatePreToolUse, guardOrganWrite, trackChange, enforceAgentRole, injectContext,

  // MCP
  createServer, startServer,
} from '@lumy-pack/filid';
```

## FCA-AI Rules Reference

| Rule | Threshold | Enforcement |
|------|-----------|-------------|
| CLAUDE.md max lines | 100 | Hook (pre-tool-validator) |
| 3-Tier boundary sections required | Always / Ask / Never | Hook (pre-tool-validator) |
| Organ directories: no CLAUDE.md | `components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants` | Hook (organ-guard) |
| SPEC.md no append-only growth | Structural change required | Validator |
| Max tests per spec.ts | 15 (3 core + 12 edge) | MCP (test-metrics) |
| LCOM4 split threshold | >= 2 | MCP (ast-analyze) + Decision tree |
| Cyclomatic complexity compress threshold | > 15 | MCP (ast-analyze) + Decision tree |
| Test stability for promotion | >= 90 days without failure | MCP (test-metrics) |
| Dependency graph | Acyclic (DAG) | Core (dependency-graph) |

## Documentation

Detailed design documentation is available in the [`.metadata/`](./.metadata/) directory:

| Document | Content |
|----------|---------|
| [01-ARCHITECTURE](./.metadata/01-ARCHITECTURE.md) | Design philosophy, FCA-AI theory mapping, ADRs |
| [02-BLUEPRINT](./.metadata/02-BLUEPRINT.md) | Module-level technical blueprint |
| [03-LIFECYCLE](./.metadata/03-LIFECYCLE.md) | Skill workflows, agent collaboration, hook timeline |
| [04-USAGE](./.metadata/04-USAGE.md) | Installation, configuration, usage guide, troubleshooting |
| [05-COST-ANALYSIS](./.metadata/05-COST-ANALYSIS.md) | Hook overhead, MCP costs, bundle size analysis |
| [06-HOW-IT-WORKS](./.metadata/06-HOW-IT-WORKS.md) | Internal mechanics, AST engine, decision tree |
| [07-RULES-REFERENCE](./.metadata/07-RULES-REFERENCE.md) | Complete rule catalog with constants and thresholds |
| [08-API-SURFACE](./.metadata/08-API-SURFACE.md) | Full public API reference (33 functions + 30 types) |

## Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript 5.7 | Language + Compiler API for AST analysis |
| @modelcontextprotocol/sdk | MCP server framework |
| Zod | Input schema validation |
| fast-glob | File pattern scanning |
| YAML | Configuration parsing |
| esbuild | Plugin bundling |
| Vitest | Testing |

## License

MIT
