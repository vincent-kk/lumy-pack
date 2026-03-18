# parsing — Blame 출력 파서

## Purpose

`git blame --porcelain` 출력을 라인별 커밋 SHA, 작성자, 콘텐츠 어트리뷰션이 포함된 구조화된 `BlameResult[]`로 파싱한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `blame-parser.ts` | 라인별 상태 머신 파서 `parsePorcelainOutput()` |

## Conventions

- 40자 SHA 헤더 및 경계 커밋(`^` 접두사) 처리
- 작성자, 커미터, 요약 메타데이터 추출

## Boundaries

### Always do

- porcelain 형식만 파싱 (`--porcelain` 플래그 출력)
- 경계 커밋을 우아하게 처리

### Ask first

- 대체 blame 출력 형식 지원

### Never do

- porcelain 출력의 고정 라인 순서 가정
