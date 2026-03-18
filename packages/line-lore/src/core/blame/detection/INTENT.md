# detection — 코스메틱 변경 감지

## Purpose

공백 전용 변경, import 재정렬, 포맷팅 조정 등 코스메틱(비기능적) diff를 감지하여 blame 탐색 시 건너뛸 수 있게 한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `cosmetic-detector.ts` | `isCosmeticDiff()` 및 `getCosmeticDiff()` |

## Conventions

- 이유 분류가 포함된 `CosmeticCheckResult` 반환
- 지원 이유: `whitespace`, `import-order`, `formatting`

## Boundaries

### Always do

- import 재정렬을 공백보다 먼저 확인 (더 구체적인 것 우선)
- 코스메틱 분류에 구조화된 이유 반환

### Ask first

- 새로운 코스메틱 감지 카테고리 추가

### Never do

- 기능적 코드 변경을 코스메틱으로 분류
