# pr-lookup — PR 해석

## Purpose

다중 전략 접근으로 커밋 SHA를 원본 PR로 해석한다: 캐시 확인 → 머지 메시지 추출 → 플랫폼 API 쿼리.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `pr-lookup.ts` | 계층적 해석 전략의 `lookupPR()` |

## Conventions

- `FileCache`를 통해 결과 캐싱 (`sha-to-pr.json`)
- Level 0(캐시만) ~ Level 2(전체 API)에서 동작

## Boundaries

### Always do

- API 호출 전 캐시 확인
- null 어댑터 처리 (Level 0 동작)

### Ask first

- 해석 전략 순서 변경

### Never do

- API 호출 전 캐시 조회 건너뛰기
