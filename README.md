# Lumy Pack

[![TypeScript](https://img.shields.io/badge/typescript-✔-blue.svg)]()
[![CLI](https://img.shields.io/badge/cli-✔-brightgreen.svg)]()
[![Tools](https://img.shields.io/badge/tools-✔-orange.svg)]()
[![Node.js](https://img.shields.io/badge/node.js-20+-green.svg)]()

---

## Overview

**Lumy Pack** is a monorepo toolbox that brings together various **CLI tools**, **developer utilities**, and **automation scripts** built with TypeScript.
It serves as a collection of practical, everyday tools — from environment management to project scaffolding — designed to streamline repetitive workflows and simplify complex tasks for developers.

---

## Monorepo Structure

This repository consists of several packages with independent version management and deployment capabilities.
Each package provides individual `README.md` documentation with detailed usage instructions, dependency information, and example code.

### `syncpoint`

- **[`@lumy-pack/syncpoint`](./packages/syncpoint/README.md)** — CLI tool for personal environment synchronization, backup/restore, and machine provisioning

---

## Development Environment Setup

```bash
# Clone repository
dir=your-lumy-pack && git clone https://github.com/vincent-kk/lumy-pack.git "$dir" && cd "$dir"

# Install dependencies
nvm use && yarn install && yarn build:all

# Use yarn workspaces
yarn workspace <package-name> <command>

# Run tests
yarn workspace <package-name> test

# Build
yarn workspace <package-name> build
```

---

## Compatibility

This package is built with ECMAScript 2022 (ES2022) syntax.

If you're using a JavaScript environment that doesn't support ES2022, you'll need to include this package in your transpilation process.

**Supported environments:**

- Node.js 20.0.0 or later

**For legacy environment support:**
Please use a transpiler like Babel to transform the code for your target environment.

---

## Version Management

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

### Creating a Changeset

When you make changes to any package, create a changeset to document your changes:

```bash
yarn changeset
```

### Releasing

```bash
# Update package versions based on changesets
yarn changeset:version

# Publish packages to npm
yarn changeset:publish
```

### Changeset Guidelines

- **patch**: Bug fixes, documentation updates, internal refactoring
- **minor**: New features, new exports, non-breaking changes
- **major**: Breaking changes, removed exports, API changes

---

## Scripts

- `yarn build:all` — Build all packages
- `yarn test` — Run tests across all packages
- `yarn lint` — Check code style
- `yarn typecheck` — Verify TypeScript types
- `yarn changeset` — Create a new changeset
- `yarn changeset:version` — Update versions based on changesets
- `yarn changeset:publish` — Publish packages to npm
- `yarn tag:packages <commit>` — Create Git tags for all packages based on their versions

---

## License

This repository is provided under the MIT license. For more details, please refer to the [`LICENSE`](./LICENSE) file.

---

## Contact

If you have any questions or suggestions related to the project, please create an issue.
