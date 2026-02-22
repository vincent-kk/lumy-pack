# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
yarn build                   # inject version + tsup + tsc declarations
yarn dev                     # run CLI in dev mode via tsx (no build needed)

# Test
yarn test                    # vitest watch mode (excludes e2e and docker)
yarn test:run                # vitest run (unit + integration)
yarn test:e2e                # E2E tests (vitest.e2e.config.ts)
yarn test:docker             # Docker-based provision tests
yarn test:all                # all of the above in sequence

# Run a single test file
yarn vitest run src/__tests__/core/backup.test.ts

# Lint / typecheck
yarn lint                    # ESLint
yarn typecheck               # tsc (declaration check)
```

## Architecture

The codebase is split into four strict layers. Dependencies only flow downward.

```
cli.ts  →  commands/*.tsx  →  core/*.ts  →  utils/
                          →  schemas/
                          →  components/*.tsx (Ink UI only)
```

### Layer 1 — CLI (`src/cli.ts`)
Commander.js entry point. Calls `registerXxxCommand(program)` for each command and runs `program.parseAsync`. No logic here.

### Layer 2 — Commands (`src/commands/*.tsx`)
Each command is an **Ink React component** rendered with `ink`'s `render()`. Pattern:

- `register<Name>Command(program)` function exported from each file wires up Commander options → renders the component.
- The component drives a `phase` state machine (e.g., `'scanning' | 'compressing' | 'done' | 'error'`), runs the core logic inside a `useEffect`, and calls `exit()` when done.
- Use `<Static>` for output that should not be re-rendered (completed items), dynamic content stays outside it.

Command metadata (description, flags, examples) lives in `src/utils/command-registry.ts` (`COMMANDS` map) — this is the single source of truth used by both `Help.tsx` and each `registerXxxCommand`.

### Layer 3 — Core (`src/core/*.ts`)
Pure async functions, no UI imports.

| File | Responsibility |
|------|----------------|
| `config.ts` | Load/save/init `~/.syncpoint/config.yml`. Always validates with AJV before returning. |
| `backup.ts` | `scanTargets()` (resolves literal/glob/regex targets), `createBackup()` (scan → metadata → tar.gz). |
| `restore.ts` | `getRestorePlan()` (hash comparison), `restoreBackup()` (extract to tmpdir → copy → cleanup). Auto-creates a safety backup before overwriting. |
| `provision.ts` | `runProvision()` is an **async generator** (`AsyncGenerator<StepResult>`) — yields per-step status for real-time UI. Blocks `curl \| sh` patterns. |
| `metadata.ts` | `collectFileInfo()` (stat + SHA-256 hash), `createMetadata()`, `parseMetadata()`. |
| `storage.ts` | `createArchive()`, `extractArchive()`, `readFileFromArchive()` via the `tar` package. Archives always stage through a tmpdir. |
| `migrate.ts` | Schema-driven diff of user config vs current template. Preserves user values, comments out deprecated keys, validates output before writing. |

### Layer 4 — Supporting modules

**`src/schemas/`** — AJV validators compiled from `assets/schemas/*.json`. Each exports `validateXxx(data): { valid, errors? }`.

**`src/components/`** — Reusable Ink terminal UI: `ProgressBar`, `StepRunner` (splits completed/active with `<Static>`), `Table`, `Confirm`, `Viewer`.

**`src/utils/`** — No cross-layer business logic:
- `types.ts` — all TypeScript interfaces
- `pattern.ts` — detects `literal` / `glob` (`*?{`) / `regex` (`/…/`) patterns; `createExcludeMatcher()` pre-compiles for efficient repeated matching
- `paths.ts` — tilde expansion, `resolveTargetPath`, `ensureDir`, `fileExists`
- `command-registry.ts` — `COMMANDS` record, source of truth for all command metadata
- `claude-code-runner.ts` — invokes Claude Code binary for the `wizard` and `create-template` commands
- `version.ts` — populated at build time by `scripts/inject-version.js`

## Key Patterns

**Config loading**: Always use `loadConfig()` from `core/config.ts`. It validates with AJV and throws a user-friendly error if the file is missing or invalid. Never parse config YAML directly.

**Backup archive format**: A `tar.gz` containing `_metadata.json` at the root plus files stored with their home-relative paths (tilde stripped). `_metadata.json` includes file hashes, which drive the restore plan.

**Provision generator**: `runProvision()` yields `{ status: 'running' }` before each step, then the actual result. Consumers (`Provision.tsx`) accumulate results in an array and re-render. Steps with `skip_if` are evaluated via a shell command (exit 0 = skip).

**Pattern matching**: targets/excludes support all three types in the same array. `scanTargets()` dispatches per pattern type; excludes are compiled once with `createExcludeMatcher()` for O(1) literal checks, single-pass glob, and iterated regex.

**Sensitive file filtering**: Files matching `SENSITIVE_PATTERNS` in `constants.ts` are silently excluded unless `config.backup.includeSensitiveFiles` is set.

## Test Structure

```
src/__tests__/
  core/        # unit tests for core/ modules
  utils/       # unit tests for utils/ and schemas/
  schemas/     # AJV schema validation tests
  commands/    # Ink component tests (ink-testing-library)
  components/  # Ink UI component tests
  integration/ # full init→backup→restore workflows in a sandbox
  e2e/         # CLI subprocess tests (vitest.e2e.config.ts)
  docker/      # provision tests inside Docker
  helpers/     # sandbox.ts, fixtures.ts, mock-factories.ts, docker-runner.ts
```

The default `vitest.config.ts` excludes `docker/` and `e2e/`. Use `vitest.e2e.config.ts` for those. Setup file: `src/__tests__/helpers/setup.ts`.
