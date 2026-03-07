# ink-veil Removal Request

Audit date: 2026-03-07

---

## 1. Executive Summary

ink-veil codebase audit results. Removal targets fall into three categories:

| Category | Items | Impact |
|----------|-------|--------|
| Unused dependencies | 3 packages | ~50MB node_modules reduction |
| MCP subsystem | 1 module + 1 dep + export + tsup entry | Removes redundant LLM interface layer |
| Premature Phase 4 code | 5 parsers + 1 module + 1 dep | Removes ~900 lines of untested-in-production code |

---

## 2. Unused Dependencies (0 imports in src/)

These packages are declared in `package.json` dependencies but have **zero import statements** anywhere in `src/`.

| Package | Size Impact | Likely Intent | Evidence |
|---------|-------------|---------------|----------|
| `sharp` | ~30MB | Image processing (未계획) | No import in any .ts file |
| `cli-progress` | ~200KB | Progress bars | No import; `ora` also unused |
| `ora` | ~100KB | Spinners | No import; CLI uses Commander only |

### Action

```diff
# package.json dependencies
- "sharp": "^0.33.0",
- "cli-progress": "^3.12.0",
- "ora": "^8.1.1",
```

```diff
# package.json devDependencies
- "@types/cli-progress": "^3.11.6",
```

---

## 3. MCP Subsystem Removal

### 3.1 Why Remove

ink-veil's CLI is already fully LLM-compatible by design (PLAN.md Principle 5):

> **LLM-Agent Compatibility** — CLI는 stdout에 JSON, stderr에 진행상황, 의미적 exit code, non-TTY에서 대화형 프롬프트 금지.

The CLI provides:
- `--json` flag on all commands (veil, unveil, detect, verify, dict)
- `--stdin` for pipe input
- Semantic exit codes 0-8
- Non-TTY safe (no ANSI colors, no interactive prompts)

MCP adds a **redundant interface layer** that duplicates what `--json` + `--stdin` already provide:

| Capability | CLI (--json) | MCP |
|------------|-------------|-----|
| Structured input/output | ✅ JSON stdout | ✅ JSON over stdio |
| Agent-callable | ✅ via Bash tool | ✅ via MCP protocol |
| No interactive prompts | ✅ | ✅ |
| Pipe-friendly | ✅ --stdin | N/A |
| Additional dependency | None | @modelcontextprotocol/sdk |
| Maintenance burden | None (part of CLI) | Separate module to maintain |

The only advantage MCP provides over CLI is **schema autodiscovery** — but this is achievable via `--help --json` (not yet implemented, lower cost).

### 3.2 Offline-First Principle Concern

ink-veil's core principle is **Offline-First Security** — no network calls, all processing local. While MCP itself runs over stdio (not network), the `@modelcontextprotocol/sdk` dependency introduces:
- 15+ transitive dependencies
- Protocol negotiation overhead
- A server abstraction that implies network-style communication

This is philosophically misaligned with a tool designed to process sensitive PII data in isolated environments.

### 3.3 Files to Remove

| File | Lines | Description |
|------|-------|-------------|
| `src/mcp/server.ts` | ~150 | MCP tool server (3 tools: veil, unveil, detect) |
| `src/mcp/index.ts` | ~5 | Barrel export |
| `src/__tests__/mcp/server.test.ts` | ~100 | MCP tests |

### 3.4 Configuration to Update

```diff
# package.json — dependencies
- "@modelcontextprotocol/sdk": "^1.27.1",

# package.json — exports
  ".": { ... },
  "./transform": { ... },
- "./mcp": {
-   "types": "./dist/mcp/index.d.ts",
-   "import": "./dist/mcp/index.mjs",
-   "require": "./dist/mcp/index.cjs"
- }
```

```diff
# tsup.config.ts — entry points
  entry: {
    index: 'src/index.ts',
    'transform/index': 'src/transform/index.ts',
-   'mcp/index': 'src/mcp/index.ts',
    cli: 'src/cli.ts',
  },
```

### 3.5 Documentation to Update

| File | Section | Action |
|------|---------|--------|
| `.metadata/cli-interface.md` | §6 "MCP Tool Integration" | Remove entire section |
| `PLAN.md` | Phase 3.2 "MCP 서버 통합" | Remove section |
| `PLAN.md` | Spec Gap Matrix row #5 | Remove row |
| `PLAN.md` | Phase 3 description | Update to "Advanced Formats" (remove "& MCP") |

---

## 4. Premature Phase 4 Code

Phase 4 is labeled **"Experimental"** in PLAN.md. These features are implemented but:
- Tier 4 parsers have **no round-trip guarantee** (by design)
- Faker mode adds a heavy dependency for a non-core feature
- None of these are needed for the MVP or production use

### 4.1 Tier 4 Parsers

| File | Format | Lines | Guarantee |
|------|--------|-------|-----------|
| `src/document/parsers/latex.ts` | LaTeX | ~89 | none |
| `src/document/parsers/hwp.ts` | HWP (HWPx only) | ~83 | none |
| `src/document/parsers/rtf.ts` | RTF | ~95 | none |
| `src/document/parsers/odt.ts` | ODT/ODS | ~95 | none |

These are **best-effort text extractors** that strip formatting and return plain text. They cannot reconstruct the original document.

### 4.2 Faker Replacement Mode

| File | Lines | Description |
|------|-------|-------------|
| `src/transform/faker.ts` | ~150 | Faker-based PII replacement |
| `src/__tests__/transform/faker.test.ts` | ~100 | Tests |

```diff
# package.json — dependencies
- "@faker-js/faker": "^9.0.0",
```

`@faker-js/faker` is ~5MB and adds realistic fake data generation. This is a Phase 4 experimental feature.

### 4.3 Recommendation

**Option A (Conservative)**: Keep Tier 4 parsers and Faker, but move them behind a feature flag or lazy import so they don't affect bundle size.

**Option B (Aggressive)**: Remove all Phase 4 code now. Re-implement when Phase 4 is actually prioritized.

### 4.4 Parser Router Update (if removing Tier 4)

```diff
# src/document/parser.ts — getParser() format map
  // Tier 1a
  'txt': TextParser, 'md': TextParser, 'csv': CsvParser, 'tsv': CsvParser,
  // Tier 1b
  'json': JsonParser, 'xml': XmlParser, 'yaml': YamlParser, 'toml': TomlParser, 'ini': IniParser,
  // Tier 2
  'docx': DocxParser, 'xlsx': XlsxParser, 'html': HtmlParser,
  // Tier 3
  'pdf': PdfParser, 'pptx': PptxParser, 'epub': EpubParser,
- // Tier 4 (experimental, no round-trip guarantee)
- 'hwp': HwpParser, 'hwpx': HwpParser,
- 'rtf': RtfParser,
- 'odt': OdtParser, 'ods': OdtParser,
- 'tex': LatexParser, 'latex': LatexParser,
```

---

## 5. Additional Finding: Placeholder SHA256

Not a removal item, but a **blocking issue** discovered during audit:

```
src/detection/ner/model-manager.ts:23  sha256: 'PLACEHOLDER_SHA256_GLINER_MULTI'
src/detection/ner/model-manager.ts:31  sha256: 'PLACEHOLDER_SHA256_GLINER_KO'
```

NER model download checksums are placeholders. Until real SHA256 hashes are set, `model download` will fail verification. Currently falls back to regex-only (exit code 6).

---

## 6. Summary of All Changes

### Must Remove (no debate)

| Item | Type | Reason |
|------|------|--------|
| `sharp` | dependency | Zero imports |
| `cli-progress` | dependency | Zero imports |
| `@types/cli-progress` | devDependency | Zero imports |
| `ora` | dependency | Zero imports |

### Recommended Remove (MCP)

| Item | Type | Reason |
|------|------|--------|
| `@modelcontextprotocol/sdk` | dependency | Redundant with CLI --json |
| `src/mcp/` | source | Redundant interface layer |
| `./mcp` export | config | No source after removal |
| tsup `mcp/index` entry | config | No source after removal |
| cli-interface.md §6 | docs | References removed feature |
| PLAN.md Phase 3.2 | docs | References removed feature |

### Optional Remove (Phase 4)

| Item | Type | Reason |
|------|------|--------|
| `@faker-js/faker` | dependency | Phase 4 experimental |
| `src/transform/faker.ts` | source | Phase 4 experimental |
| `src/document/parsers/{latex,hwp,rtf,odt}.ts` | source | Tier 4 no-guarantee parsers |
| Related test files | tests | Tests for removed code |
| Parser router entries | config | References removed parsers |

---

## 7. Post-Removal Verification

After applying changes:

1. `yarn test:run` — all remaining tests pass
2. `yarn build` — tsup builds without errors
3. Verify `transform/` subpath has no new dependencies leaked
4. Verify exit code 4 (unsupported format) for removed Tier 4 formats
5. `import('@lumy-pack/ink-veil/mcp')` should fail with MODULE_NOT_FOUND
