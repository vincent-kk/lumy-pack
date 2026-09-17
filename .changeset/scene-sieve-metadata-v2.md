---
'@lumy-pack/scene-sieve': minor
---

Add metadata v2 with per-selection change signals, raw information-gain aggregates, non-animation union area and output-coordinate regions. Record the runtime tool version, nine pipeline parameters, source provenance, candidate counts and frame hold durations.

Add optional contact sheets through `sheet` / `--sheet` and candidate edge diagnostics through `includeEdges` / `--include-edges`. Expose frame metadata, sheet layout and in-memory sheet JPEGs across the file, buffer and frames APIs, along with named metadata type exports.

The exported `ResolvedOptions` type gains required `sheet` and `includeEdges` members, and `VideoMetadata` gains required `candidatesCount`, `selectedCount` and `source` members, so TypeScript consumers constructing these literals must supply them.

Keep frame selection, existing video semantics and zero-based API animation IDs unchanged. Metadata documents use deterministic key ordering and numeric rounding; document frame and animation IDs remain one-based.

Compute rectangle union areas with an O(n log n) sweep to keep metadata generation scalable when many regions accumulate between selected frames, and reject arrays passed as sheet options.
