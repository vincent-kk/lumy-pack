# core — 파이프라인 오케스트레이션

## Purpose

4단계 추적 파이프라인을 구현하고 최상위 `trace()`, `health()`, `clearCache()` 함수를 노출한다. blame, 코스메틱 감지, 조상 추적, AST diff, PR 조회 서브 모듈을 조율한다.

## Structure

| 경로 | 역할 |
|------|------|
| `core.ts` | 메인 오케스트레이터 — `trace()`, `health()`, `clearCache()` |
| `blame/` | Git blame 실행 및 결과 분석 |
| `ancestry/` | 커밋 히스토리에서 머지 커밋 탐색 |
| `ast-diff/` | 딥 트레이싱을 위한 AST 수준 구조적 diff |
| `patch-id/` | 스쿼시 감지를 위한 Git patch-id 매칭 |
| `pr-lookup/` | 캐시, 머지 메시지, API를 통한 PR 해석 |
| `issue-graph/` | PR-이슈 그래프 탐색 |

## Conventions

- 각 서브 모듈은 `index.ts` 배럴을 통해 기능 노출
- 운영 수준(0–2)이 기능 가용성을 제어

## Boundaries

### Always do

- 모든 추적은 `core.ts` 오케스트레이터를 통해 라우팅
- API 종속 기능은 운영 수준 준수

### Ask first

- 새로운 파이프라인 단계 추가
- 단계 실행 순서 변경

### Never do

- core에서 직접 플랫폼 API 호출 (`pr-lookup` 사용)
