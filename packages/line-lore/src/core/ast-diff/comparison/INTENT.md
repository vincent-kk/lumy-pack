# comparison — 심볼 맵 비교

## Purpose

두 심볼 맵(현재 vs 부모)을 비교하여 콘텐츠 해시 기반으로 어떤 심볼이 추가, 삭제, 수정 또는 동일한지 판별한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `structure-comparator.ts` | 신뢰도 점수가 포함된 `compareSymbolMaps()` |

## Conventions

- 비교에 `ContentHash` (exact + normalized) 사용
- 신뢰도 수준: `exact`, `normalized`, `name-only`

## Boundaries

### Always do

- exact 및 normalized 해시 모두 비교
- 신뢰도 수준이 포함된 `ComparisonResult[]` 반환

### Ask first

- 새로운 비교 전략 추가

### Never do

- 비교 중 심볼 맵 수정 (순수 함수)
