# output — 응답 포맷팅

## Purpose

추적 결과를 사람이 읽기 쉬운 형태, JSON, LLM 최적화 형태로 포맷팅한다. 응답 정규화 및 헬프 스키마 생성을 제공한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `formats.ts` | picocolors를 사용한 사람 읽기용 포맷팅 |
| `normalizer.ts` | `NormalizedResponse` 생성 헬퍼 |

## Conventions

- 모든 CLI 출력은 포맷 함수를 통해 처리
- `NormalizedResponse<T>`가 모든 명령어 결과를 래핑

## Boundaries

### Always do

- 모든 정규화된 응답에 `operatingLevel` 포함
- `--output` 플래그 지원 (human, json, llm)

### Ask first

- 새로운 출력 포맷 추가

### Never do

- 포맷 함수 외부에서 직접 stdout 출력
