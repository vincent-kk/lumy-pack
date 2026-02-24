# scene-sieve

Video/GIF 핵심 프레임 추출 및 가지치기 CLI 도구. 동영상에서 유의미한 N장의 장면을 자동 선별.

## Commands

```bash
yarn build              # inject version + tsup + tsc declarations
yarn dev <input>        # run CLI in dev mode via tsx
yarn test               # vitest watch mode (excludes e2e)
yarn test:run           # vitest run
yarn test:e2e           # E2E tests (vitest.e2e.config.ts)
yarn lint               # ESLint
```

## Architecture

```
cli.ts  ->  index.ts  ->  core/orchestrator.ts  ->  core/{workspace,extractor,analyzer,pruner}
                                                 ->  utils/, types/, constants.ts
```

### Layer 1 — CLI (`src/cli.ts`)
Commander.js single command. ora spinner + cli-progress bar. Delegates to `extractScenes()`.

### Layer 2 — Orchestrator (`src/core/orchestrator.ts`)
Facade/API. ProcessContext lifecycle, 5-stage pipeline (Init -> Extract -> Analyze -> Prune -> Finalize).

### Layer 3 — Core Pipeline (`src/core/`)

| File | Responsibility |
|------|----------------|
| `workspace.ts` | Temp dir creation, atomic rename, cleanup |
| `extractor.ts` | FFmpeg I-frame extraction + FPS fallback |
| `analyzer.ts` | sharp preprocessing + OpenCV WASM batch analysis |
| `pruner.ts` | Pure greedy merge algorithm (no I/O) |

### Supporting
- `types/index.ts` — All TypeScript interfaces
- `utils/logger.ts` — picocolors logger with debug mode
- `utils/paths.ts` — ensureDir, fileExists, deriveOutputPath
- `constants.ts` — Defaults, thresholds, file patterns

## Key Patterns

- **Memory**: analyzer processes in batches of `OPENCV_BATCH_SIZE`. Each Mat must `.delete()` after use.
- **Atomic output**: workspace.ts copies to staging dir, then `fs.rename()` to final path.
- **FFmpeg independence**: `ffmpeg-static` + `@ffprobe-installer/ffprobe` bundle binaries.
- **Debug mode**: `--debug` preserves temp workspace. Always cleaned up otherwise.
- **Pruner**: Pure function, no side effects. Greedy algorithm removes lowest-score adjacent pairs.

## Tech Stack

- TypeScript 5.7, Node.js >=20, ESM
- Build: tsup (ESM + CJS dual), tsc declarations
- Test: Vitest 3.2
- CLI: Commander.js 12, ora, cli-progress
- Media: fluent-ffmpeg, ffmpeg-static, sharp, @techstark/opencv-js
