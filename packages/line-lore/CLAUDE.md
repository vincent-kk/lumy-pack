# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
yarn build                   # inject version + tsup + tsc declarations
yarn dev                     # run CLI in dev mode via tsx (no build needed)

# Test
yarn test                    # vitest watch mode
yarn test:run                # vitest run

# Lint / typecheck
yarn lint                    # ESLint
yarn typecheck               # tsc (declaration check)
```

## Architecture

```
cli.ts  →  commands/*.tsx  →  core/*.ts  →  utils/
                          →  components/*.tsx (Ink UI)
```

### Layer 1 — CLI (`src/cli.ts`)
Commander.js entry point. Registers `trace` command.

### Layer 2 — Commands (`src/commands/*.tsx`)
Ink React components for CLI interaction.

### Layer 3 — Core (`src/core/*.ts`)
- `blame.ts` — git blame porcelain parsing
- `pr-lookup.ts` — PR number extraction from merge commits
- `trace.ts` — orchestrator combining blame → PR lookup

### Layer 4 — Utils (`src/utils/`)
Git utilities and helpers.

## Key Types

- `BlameResult` — parsed git blame output
- `PRInfo` — PR metadata
- `TraceResult` — combined blame + PR info
- `TraceOptions` — CLI options
