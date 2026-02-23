# filid Built-in Rules Reference

filid ships 7 built-in rules that are automatically evaluated against the FractalTree of any scanned project.
Rules are defined in `src/core/rule-engine.ts` and loaded via `loadBuiltinRules()`.

## Rule Summary

| ID | Name | Category | Severity | Description |
|---|---|---|---|---|
| `naming-convention` | Naming Convention | naming | warning | Directory/file names must follow kebab-case or camelCase |
| `organ-no-claudemd` | Organ No CLAUDE.md | structure | error | Organ nodes must not contain CLAUDE.md |
| `index-barrel-pattern` | Index Barrel Pattern | index | warning | fractal/hybrid index.ts must be a pure barrel (re-exports only) |
| `module-entry-point` | Module Entry Point | module | warning | All fractal nodes must have index.ts or main.ts |
| `max-depth` | Max Depth | structure | error | Fractal tree depth must not exceed the configured maximum |
| `circular-dependency` | Circular Dependency | dependency | error | No circular dependencies between modules (Phase 2 placeholder) |
| `pure-function-isolation` | Pure Function Isolation | dependency | error | pure-function nodes must not import from fractal modules |

## Rule Files

- [naming-convention.md](./naming-convention.md)
- [structure-rules.md](./structure-rules.md) — covers `organ-no-claudemd` and `max-depth`
- [index-rules.md](./index-rules.md) — covers `index-barrel-pattern`
- [module-rules.md](./module-rules.md) — covers `module-entry-point`
- [dependency-rules.md](./dependency-rules.md) — covers `circular-dependency` and `pure-function-isolation`
- [documentation-rules.md](./documentation-rules.md) — CLAUDE.md / SPEC.md document conventions

## Configuring Rules

Rules are enabled by default. To disable or customize a rule, add a `rules` section to `.filid/config.json`:

```json
{
  "rules": {
    "naming-convention": { "enabled": false },
    "max-depth": { "enabled": true }
  }
}
```

Custom rules can be registered by passing additional `Rule[]` objects to `evaluateRules()`.
