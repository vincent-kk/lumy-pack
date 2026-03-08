# lumy-pack

Personal Environment Manager monorepo. Configuration backup/restore and machine provisioning CLI tools.

## Project Structure

- **Monorepo**: Yarn 4.12 workspaces (`packages/*`)
- **Package**: `@lumy-pack/syncpoint` — CLI tool (v0.0.8, npm public)
- **Package**: `@lumy-pack/scene-sieve` — Video/GIF frame extraction CLI
- **Package**: `@lumy-pack/ink-veil` — Korean PII detection and masking library
- **Package**: `@lumy-pack/shared` — Shared CLI utilities (private, source-only)

## Tech Stack

- TypeScript 5.7.2, Node.js >=20, Build: tsup, Test: Vitest 3.2

## Commands

```bash
yarn build:all          # Build all packages
yarn test:run           # Run all tests
yarn typecheck          # TypeScript type check
yarn lint               # ESLint
```

## Conventions

- ESM modules (`"type": "module"`), output: `.mjs` / `.cjs`
- Version injection: `scripts/inject-version.js`
- Release: Changesets (`yarn changeset`)

## Always do

- Follow each package's own CLAUDE.md for package-specific conventions.
- Run `yarn typecheck` before committing to catch type errors early.
- Use Changesets for any user-facing changes.

## Ask first

- Adding a new package to the monorepo.
- Changing shared build/test infrastructure.

## Never do

- Commit `.env` or credential files.
- Duplicate package-level docs in this root file.
- Push directly to `main` without a PR.
