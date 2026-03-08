# shared/src

Shared CLI response envelope types and helper functions.

## Structure

```
src/
├── index.ts          # barrel re-export
├── cli-response.ts   # CliResponse, CliError, CliMeta types
├── errors.ts         # BaseErrorCode type
└── respond.ts        # respond(), respondError() stdout writers
```

## Boundaries

### Always do

- Export all public types through `index.ts` barrel
- Keep `respond`/`respondError` as the only stdout writers

### Ask first

- Changing `CliResponse` shape (affects all consumer packages)
- Adding new modules beyond types and helpers

### Never do

- Import from consumer packages (syncpoint, scene-sieve)
- Add package-specific business logic
