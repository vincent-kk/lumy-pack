# shared

Shared CLI utilities for lumy-pack packages. JSON response envelope and error helpers.

## Structure

```
src/
├── index.ts          # barrel re-export (types + functions)
├── cli-response.ts   # CliResponse, CliError, CliMeta interfaces
├── errors.ts         # BaseErrorCode type
└── respond.ts        # respond(), respondError() stdout writers
```

## Public Interface

- `CliResponse<T>` — universal JSON response envelope (`ok`, `command`, `data`, `error`, `meta`)
- `CliError` — error payload (`code`, `message`, `details?`)
- `CliMeta` — response metadata (`version`, `durationMs`, `timestamp`)
- `BaseErrorCode` — shared error code union (`'UNKNOWN' | 'INTERNAL'`)
- `respond(command, data, startTime, version)` — write success JSON to stdout
- `respondError(command, code, message, startTime, version, details?)` — write error JSON + set exitCode=1

## Conventions

- TypeScript source-only package (`private: true`, no build step)
- ESM with `.js` import extensions
- Each package extends `BaseErrorCode` with domain-specific codes

## Boundaries

### Always do

- Keep response shape stable (breaking change affects all CLI packages)
- Use `respond`/`respondError` for all `--json` mode output

### Never do

- Add package-specific logic (this is a shared utility layer)
- Import from consumer packages (syncpoint, scene-sieve)
