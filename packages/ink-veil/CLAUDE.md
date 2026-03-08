# ink-veil

Korean PII detection and masking library with multi-format document support.

## Always do

- Export only through `src/index.ts` — the single public barrel entry point.
- Use the `Result<T, E>` monad from `errors/` for all fallible operations.
- Keep fractal modules (`detection`, `dictionary`, `transform`, `verification`, `document`, `config`, `errors`) self-contained with no cross-fractal circular imports.
- Sign veil tokens with SHA-256 before storing in the dictionary.
- Support both regex and Kiwi NLP engines; allow the caller to choose via config.
- Use `commands/` and `utils/` as organ directories — no CLAUDE.md inside them.

## Ask first

- Adding a new document format parser to `document/` — confirm parser scope and dependency budget.
- Changing the veil token signature scheme — this is a breaking contract for existing dictionaries.
- Introducing a new NLP engine alongside Kiwi — assess memory and startup-time trade-offs first.
- Exposing internal fractal types in the public API surface.

## Never do

- Import from `commands/` or `utils/` inside fractal modules — organs are consumers, not providers.
- Store plaintext PII values in the dictionary without encryption.
- Bypass the `Result` monad by throwing raw errors across module boundaries.
- Add CLAUDE.md files inside `commands/` or `utils/` (organ directories).
- Duplicate root `CLAUDE.md` content (monorepo build, test, or release conventions).

## Module Map

| Fractal        | Responsibility                                      |
| -------------- | --------------------------------------------------- |
| `config/`      | Configuration schema loading and validation         |
| `detection/`   | PII detection pipeline (regex, kiwi, manual)        |
| `dictionary/`  | Token-to-PII mapping with optional encryption       |
| `transform/`   | Veil (mask) and unveil (restore) text operations    |
| `verification/`| SHA-256 hash-based integrity verification           |
| `document/`    | Parsers: CSV, JSON, YAML, XML, HTML, TOML, INI, PDF, DOCX, XLSX, PPTX, EPUB |
| `errors/`      | Error types and `Result<T, E>` monad                |
