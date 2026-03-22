# pr-lookup — PR 해석

## Purpose

다중 전략 접근으로 커밋 SHA를 원본 PR로 해석한다: 캐시 → API direct → blame commit message pre-check → ancestry-path → patch-id.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `pr-lookup.ts` | 계층적 해석 전략의 `lookupPR()` |

## Conventions

- `ShardedCache`를 통해 결과 캐싱
- Level 0(캐시만) ~ Level 2(전체 API)에서 동작
- Strategy 3a: blame commit message에서 직접 PR 번호 추출 (squash merge 대응)

## Boundaries

### Always do

- API 호출 전 캐시 확인
- null 어댑터 처리 (Level 0 동작)

### Ask first

- 해석 전략 순서 변경

### Never do

- API 호출 전 캐시 조회 건너뛰기
