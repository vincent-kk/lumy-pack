# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## scene-sieve

Video/GIF key-frame extraction and pruning CLI. Automatically selects meaningful scenes from video.

## Commands

```bash
yarn build              # rolldown + tsc declarations
yarn dev <input>        # run CLI in dev mode via tsx
yarn test               # vitest watch mode (unit only)
yarn test:run           # vitest run (unit only)
yarn test:integration   # integration tests (vitest.integration.config.ts)
yarn test:e2e           # E2E tests (vitest.e2e.config.ts)
yarn lint               # ESLint

# Run a single test
yarn test:run src/__tests__/unit/pruner.test.ts
yarn test:run -- -t "test name pattern"
```

## Architecture

```
cli.ts → index.ts / commands/Sieve.tsx → core/index.ts → core/orchestrator.ts
                                                    → core/{input-resolver,workspace,extractor,analyzer,pruner}
                                                    → utils/{logger,paths,min-heap}, types/, constants.ts
```

### Pipeline (orchestrator.ts)

Five sequential stages. `ProcessContext` holds pipeline state:

1. **Init** — Creates a workspace (tmpdir) and resolves input (`input-resolver.ts`)
2. **Extract** — Extracts frames on an FFmpeg FPS grid; file/buffer candidates obey the strict `maxFrames` cap. Effective FPS is `min(fps, maxFrames / duration)`, with no 0.5 FPS floor.
3. **Analyze** — Computes information gain G(t) for adjacent frame pairs, producing a `ScoreEdge[]` graph
4. **Prune** — Selects meaningful frames from the G(t) graph (pure functions, no I/O)
5. **Finalize** — Deletes existing output before renaming staging (file mode), or returns Buffers (buffer/frames mode)

### Three input modes (Discriminated Union)

`SieveOptions = SieveOptionsBase & SieveInput` (types/index.ts)

| Mode     | Input                 | Output          | FFmpeg          |
| -------- | --------------------- | --------------- | --------------- |
| `file`   | File path             | JPEGs on disk   | Yes             |
| `buffer` | Video `Buffer`        | `Buffer[]`      | Via temp file   |
| `frames` | Frame image `Buffer[]` | `Buffer[]`      | No              |

### pruneMode strategy (`input-resolver.ts`)

| Condition | pruneMode | Algorithm |
| --------- | --------- | --------- |
| All option combinations | `threshold-with-cap` | Apply the distribution-normalized threshold, rebuild the subgraph, then cap with `pruneTo` |

Omitted `count` and `threshold` use 20 and 0.5. The first and last candidates remain protected, including when `count = 1`.

### Vision analysis pipeline (analyzer.ts)

Four stages for adjacent frame pairs:

1. **AKAZE Feature Diff** — Caches preprocessing and features once per frame, reuses the detector, and matches previous to next features to obtain newly appeared points (sNew only)
2. **DBSCAN Clustering** — Groups sNew points spatially, eps = alpha * sqrt(W² + H²)
3. **IoU Tracking** — Tracks cluster bounding boxes over time and discounts repetitive animation regions
4. **G(t) Scoring** — Combines cluster area ratio and feature density with animation discounting

## Key Patterns

- **OpenCV WASM loading**: Load CJS with `createRequire` (ESM dynamic import hangs under Vite transformation). Delete the `.then` property to prevent thenable recursion.
- **Memory**: The analyzer processes `OPENCV_BATCH_SIZE` (10) frames per batch. Delete all owned OpenCV Mat/Vector handles in `finally`.
- **Pruner**: Pure functions. Doubly linked list + MinHeap greedy merge. Boundary protection preserves first/last candidates.
- **Output replacement**: workspace.ts writes to staging, deletes existing output, then calls `fs.rename()`. The delete-and-rename sequence is not an atomic replacement.
- **FFmpeg**: Bundled binaries from `ffmpeg-static` and `@ffprobe-installer/ffprobe`; no system FFmpeg dependency.
- **Debug mode**: `--debug` preserves the temp workspace; otherwise cleanup runs in `finally`.

## Test Configuration

Three Vitest configs use `pool: 'forks'` + `singleFork: true` because of OpenCV WASM.

| Config | Include Pattern | Timeout |
| ------ | --------------- | ------- |
| `vitest.config.ts` | `src/__tests__/**/*.{test,spec}.ts` (excluding e2e/integration) | 60s |
| `vitest.integration.config.ts` | `src/__tests__/integration/**/*.{test,spec}.ts` | 120s |
| `vitest.e2e.config.ts` | `src/__tests__/e2e/**/*.{test,spec}.ts` | 120s |

Unit test setup file: `src/__tests__/helpers/setup.ts`

## Tech Stack

- TypeScript 5.7, Node.js >=20, ESM
- Build: rolldown (ESM `.mjs` + CJS `.cjs` dual), tsc declarations
- Test: Vitest 3.2
- CLI: Commander.js 12, Ink, ink-spinner
- Media: execa, ffmpeg-static, sharp, @techstark/opencv-js
