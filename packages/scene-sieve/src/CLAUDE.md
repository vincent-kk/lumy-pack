# src

scene-sieve 라이브러리 엔트리포인트. extractScenes 함수와 타입을 외부에 공개.

## Structure

| Directory | Type | Purpose |
|-----------|------|---------|
| `core/` | fractal | 비즈니스 로직 (파이프라인, 분석, 가지치기) |
| `types/` | organ | TypeScript 타입 정의 |
| `utils/` | organ | 유틸리티 (logger, paths, min-heap) |
| `__tests__/` | organ | 테스트 (unit, integration, e2e, bench) |

## Public Interface

- `extractScenes(options: SieveOptions): Promise<SieveResult>` — 메인 API
- 타입: SieveOptions, SieveResult, FrameNode, ScoreEdge 등 (types/index.ts)

## Always do

- index.ts를 통해서만 외부 공개 API를 정의
- core/ 모듈은 core/index.ts barrel을 통해 접근
- 타입 변경 시 types/index.ts에서 관리

## Ask first

- 새로운 public export 추가
- 외부 의존성 추가
- ProcessContext 구조 변경

## Never do

- core/ 내부 모듈을 index.ts에서 직접 import (core/index.ts 경유)
- utils/를 외부에 직접 공개
- __tests__/ 파일에서 비즈니스 로직 구현
