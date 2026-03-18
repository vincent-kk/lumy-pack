# blame — Git Blame 단계

## Purpose

`git blame --porcelain`을 실행하고 결과를 분석한다. 공백 전용 또는 import 재정렬 커밋을 필터링하기 위한 코스메틱 변경 감지를 포함한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `blame.ts` | `executeBlame()` 및 `analyzeBlameResults()` |
| `parsing/` | Porcelain 출력 파서 |
| `detection/` | 코스메틱 diff 감지기 |

## Conventions

- blame 결과는 라인별 커밋 어트리뷰션 포함
- 코스메틱 감지는 조상 추적 전에 실행

## Boundaries

### Always do

- porcelain 형식만 파싱 (`--porcelain` 플래그 출력)
- 코스메틱 변경을 감지하고 플래그 지정

### Ask first

- 코스메틱 감지 휴리스틱 변경

### Never do

- 파이프라인에서 코스메틱 감지 건너뛰기
