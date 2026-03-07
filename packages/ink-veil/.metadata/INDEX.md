# @lumy-pack/ink-veil — Design Documentation

Bidirectional fidelity-tiered document de-identification/re-identification engine.

## Documents

| # | Document | Description |
|---|----------|-------------|
| 1 | [Theoretical Foundations](./theoretical-foundations.md) | De-identification theory, privacy frameworks, NER fundamentals, and the problem space ink-veil operates in |
| 2 | [Dictionary Architecture](./dictionary-architecture.md) | Dictionary-centric design, composite-key indexing, bidirectional lookup, snapshot/restore, and merge strategies |
| 3 | [Detection Pipeline](./detection-pipeline.md) | Hybrid NER + Regex + Manual detection, priority system, merge algorithm, and GLiNER model integration |
| 4 | [Token Design & LLM Resilience](./token-design.md) | LLM-resistant token formats, three-stage fuzzy matching, invisible signatures, and preservation benchmarks |
| 5 | [Fidelity Tiers & Parsers](./fidelity-tiers.md) | Round-trip guarantees per file format, tier classification, and parser implementation constraints |
| 6 | [CLI & Programmatic Interface](./cli-interface.md) | POSIX CLI design, LLM-agent-friendly structured output, subpath exports, and MCP tool integration |

## Architecture Overview

```
@lumy-pack/ink-veil
├── detection/     ← NER + Regex + Manual hybrid (Electron only)
├── dictionary/    ← Composite-key bidirectional index (shared)
├── transform/     ← Veil/Unveil + LLM-resistant tokens (shared)
├── document/      ← Fidelity-tiered parsers (Electron only)
├── verification/  ← SHA-256 round-trip + token integrity
└── errors/        ← Result pattern, error codes

Consumers:
  Inkognito (Electron)  ← imports full package
  ink-veil-ext (Chrome) ← imports /transform only
```

## Dependency Boundary

```
transform/ ──→ dictionary/     ✅
transform/ ──→ errors/         ✅
detection/ ──→ dictionary/     ✅
document/  ──→ transform/      ✅
transform/ ──→ detection/      ❌ FORBIDDEN
transform/ ──→ document/       ❌ FORBIDDEN
dictionary/──→ detection/      ❌ FORBIDDEN
```

This boundary ensures `@lumy-pack/ink-veil/transform` stays lightweight (~tens of KB) without NER/ONNX/parser dependencies.
