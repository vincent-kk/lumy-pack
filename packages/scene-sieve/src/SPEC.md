# SPEC: src (scene-sieve)

## Purpose

동영상/GIF에서 유의미한 핵심 프레임을 자동 선별하는 라이브러리.

## Public API

### `extractScenes(options: SieveOptions): Promise<SieveResult>`

- 3가지 입력 모드: file, buffer, frames
- count/threshold 기반 가지치기 전략 자동 결정
- 결과: 선별된 프레임 경로 또는 Buffer 배열

## Types (re-exported from types/)

- `SieveOptions`, `SieveOptionsBase`, `SieveInput`
- `SieveResult`, `FrameNode`, `ScoreEdge`
- `BoundingBox`, `DBSCANResult`, `ProcessContext`
- `ResolvedOptions`, `ProgressPhase`

## Dependencies

- `core/` — 비즈니스 로직 파이프라인
- `types/` — 타입 정의
- `utils/` — 유틸리티 함수

## Acceptance Criteria

- [ ] file/buffer/frames 3가지 모드 정상 동작
- [ ] count/threshold/threshold-with-cap 가지치기 전략 정상 작동
- [ ] 첫/마지막 프레임 항상 포함 (boundary protection)
- [ ] 임시 workspace 정상 정리 (debug 모드 제외)
