# metrics — 모듈 메트릭 모듈

## Purpose

테스트 밀도 측정, 3+12 규칙 검사, 모듈 분리 결정 트리, 스펙 승격 자격 판단을 담당한다. AST 메트릭(LCOM4, CC)을 입력으로 받아 구조적 결정을 내린다.

## Structure

| 파일 | 역할 |
|------|------|
| `test-counter.ts` | 테스트 파일에서 테스트 케이스 수 집계 (`countTestCases`) |
| `three-plus-twelve.ts` | 3+12 규칙 위반 검사 (`check312Rule`) — 스펙당 핵심 3 + 엣지 12 = 최대 15 |
| `decision-tree.ts` | 모듈 분리/유지 결정 (`decide`) — LCOM4, CC, 파일 크기 기반 |
| `promotion-tracker.ts` | `test.ts` → `spec.ts` 승격 자격 판단 (`checkPromotionEligibility`) |

## Conventions

- 모든 함수는 순수 함수 (입력 → 불리언/숫자/객체, 사이드 이펙트 없음)
- 결정 트리 임계값: LCOM4 ≥ 2, CC > 15, 파일 크기 > 500줄
- 3+12 규칙: 핵심 테스트 3개 미만이거나 총합 15개 초과 시 위반

## Boundaries

### Always do

- `decide()` 결과를 `mcp/tools/test-metrics.ts`를 통해서만 외부에 노출
- 임계값 상수는 `types/metrics.ts` 또는 해당 파일 내 상수로 관리

### Ask first

- 결정 트리 임계값 변경 (LCOM4, CC, 파일 크기 기준)
- 3+12 규칙 숫자 변경 (문서 및 규칙 엔진 동시 업데이트 필요)

### Never do

- 파일시스템 직접 접근 (테스트 파일 경로는 호출자가 전달)
- `ast/` 모듈 직접 import (AST 메트릭은 호출자가 계산 후 전달)
- 결정 결과를 캐싱하거나 상태 저장

## Dependencies

- `../types/metrics.ts` — 메트릭 입출력 타입
