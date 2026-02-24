# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## scene-sieve

Video/GIF 핵심 프레임 추출 및 가지치기 CLI 도구. 동영상에서 유의미한 N장의 장면을 자동 선별.

## Commands

```bash
yarn build              # tsup + tsc declarations
yarn dev <input>        # run CLI in dev mode via tsx
yarn test               # vitest watch mode (unit only)
yarn test:run           # vitest run (unit only)
yarn test:integration   # integration tests (vitest.integration.config.ts)
yarn test:e2e           # E2E tests (vitest.e2e.config.ts)
yarn lint               # ESLint

# 단일 테스트 실행
yarn test:run src/__tests__/unit/pruner.test.ts
yarn test:run -- -t "test name pattern"
```

## Architecture

```
cli.ts → index.ts → core/orchestrator.ts → core/{input-resolver,workspace,extractor,analyzer,pruner}
                                          → utils/{logger,paths,min-heap}, types/, constants.ts
```

### Pipeline (orchestrator.ts)

5단계 순차 파이프라인. `ProcessContext`가 전체 상태를 보유:

1. **Init** — workspace 생성 (tmpdir), input 해석 (`input-resolver.ts`)
2. **Extract** — FFmpeg로 프레임 추출 (I-frame 우선, 부족 시 FPS fallback; GIF은 항상 FPS)
3. **Analyze** — 인접 프레임 쌍의 정보 이득 점수(G(t)) 산출 → `ScoreEdge[]` 그래프 생성
4. **Prune** — G(t) 그래프 기반으로 유의미한 프레임만 선별 (pure function, I/O 없음)
5. **Finalize** — staging dir → atomic rename (file mode) 또는 Buffer 반환 (buffer/frames mode)

### 3가지 입력 모드 (Discriminated Union)

`SieveOptions = SieveOptionsBase & SieveInput` (types/index.ts)

| Mode | Input | Output | FFmpeg |
|------|-------|--------|--------|
| `file` | 파일 경로 | 디스크에 JPG 출력 | O |
| `buffer` | `Buffer` (동영상) | `Buffer[]` 반환 | O (temp file 경유) |
| `frames` | `Buffer[]` (프레임 이미지) | `Buffer[]` 반환 | X (직접 분석) |

### pruneMode 전략 (`input-resolver.ts`가 자동 결정)

| Condition | pruneMode | Algorithm |
|-----------|-----------|-----------|
| count만 지정 | `count` | `pruneTo` — greedy merge, min-heap O(N log N) |
| threshold만 지정 | `threshold` | `pruneByThreshold` — max-normalized 점수 필터 O(N) |
| 둘 다 지정 | `threshold-with-cap` | threshold 필터 → subgraph 재구축 → pruneTo |

### 비전 분석 파이프라인 (analyzer.ts)

인접 프레임 쌍별로 4단계 처리:

1. **AKAZE Feature Diff** — 두 프레임 간 특징점 매칭 후 새로 등장/소실된 특징점(sNew/sLoss) 추출
2. **DBSCAN Clustering** — sNew 점들을 공간 클러스터링, eps = alpha * sqrt(W² + H²)
3. **IoU Tracking** — 클러스터 bounding box의 시공간 추적, 반복 애니메이션 영역 감쇠
4. **G(t) Scoring** — 클러스터 면적 비율 x 특징점 밀도, 애니메이션 가중치 차감

## Key Patterns

- **OpenCV WASM 로딩**: `createRequire`로 CJS 로드 (ESM dynamic import는 Vite 변환 시 hang). `.then` 프로퍼티를 삭제해야 thenable 무한 루프 방지.
- **메모리**: analyzer는 `OPENCV_BATCH_SIZE`(10)만큼 배치 처리. 모든 OpenCV Mat은 `finally` 블록에서 `.delete()` 필수.
- **Pruner**: 순수 함수. doubly-linked list + MinHeap 기반 greedy merge. 첫/마지막 프레임은 boundary protection으로 절대 제거 안 됨.
- **Atomic output**: workspace.ts가 staging dir에 복사 후 `fs.rename()`으로 최종 경로에 원자적 이동.
- **FFmpeg**: `ffmpeg-static` + `@ffprobe-installer/ffprobe`로 번들 바이너리 사용. 시스템 FFmpeg에 비의존.
- **Debug mode**: `--debug`로 temp workspace 보존. 미지정 시 finally에서 항상 cleanup.

## Test Configuration

3개의 vitest config 파일로 분리. 모두 `pool: 'forks'` + `singleFork: true` (OpenCV WASM 때문).

| Config | Include Pattern | Timeout |
|--------|----------------|---------|
| `vitest.config.ts` | `src/__tests__/**/*.test.ts` (e2e, integration 제외) | 60s |
| `vitest.integration.config.ts` | `src/__tests__/integration/**/*.test.ts` | 120s |
| `vitest.e2e.config.ts` | `src/__tests__/e2e/**/*.test.ts` | 120s |

Unit test setup file: `src/__tests__/helpers/setup.ts`

## Tech Stack

- TypeScript 5.7, Node.js >=20, ESM
- Build: tsup (ESM `.mjs` + CJS `.cjs` dual), tsc declarations
- Test: Vitest 3.2
- CLI: Commander.js 12, ora, cli-progress
- Media: fluent-ffmpeg, ffmpeg-static, sharp, @techstark/opencv-js
