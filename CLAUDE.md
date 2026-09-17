# lumy-pack

Personal Environment Manager monorepo. Configuration backup/restore and machine provisioning CLI tools.

## Project Structure

- **Monorepo**: Yarn 4.12 workspaces (`packages/*`)
- **Package**: `@lumy-pack/syncpoint` — Project synchronization and scaffolding CLI (npm public)
- **Package**: `@lumy-pack/scene-sieve` — Video/GIF frame extraction CLI
- **Package**: `@lumy-pack/ink-veil` — Korean PII detection and masking library
- **Package**: `@lumy-pack/line-lore` — Traces code lines to their originating pull requests via git blame
- **Package**: `@lumy-pack/shared` — Shared CLI utilities (private, source-only)

## Tech Stack

- TypeScript 5.7.2, Node.js >=20, Build: rolldown, Test: Vitest 3.2

## Commands

```bash
yarn build:all                        # Build all packages
yarn test:run                         # Run all tests
yarn typecheck packages/<pkg>         # TypeScript type check (tsc -b <project>)
yarn lint                             # ESLint
yarn workspace @lumy-pack/<pkg> lint  # ESLint for one package
```

`yarn typecheck` is `tsc -b` in project-reference mode: the root has no `tsconfig.json`, so pass the package directory (`yarn typecheck packages/scene-sieve`). Running it without a path fails with TS5083.

## Conventions

- ESM modules (`"type": "module"`), output: `.mjs` / `.cjs`
- Version injection: `packages/<pkg>/scripts/inject-version.js` where a package needs it (syncpoint, line-lore); scene-sieve reads `package.json` at runtime instead
- Release: Changesets (`yarn changeset`)

## Always do

- Follow each package's own CLAUDE.md for package-specific conventions.
- Run `yarn typecheck packages/<pkg>` before committing to catch type errors early.
- Use Changesets for any user-facing changes.

## Ask first

- Adding a new package to the monorepo.
- Changing shared build/test infrastructure.

## Never do

- Commit `.env` or credential files.
- Duplicate package-level docs in this root file.
- Push directly to `main` without a PR.
