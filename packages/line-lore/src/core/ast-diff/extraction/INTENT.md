# extraction — 심볼 추출

## Purpose

AST 파싱 또는 텍스트 기반 폴백을 사용하여 소스 코드에서 심볼 정보(함수, 클래스, 변수)를 추출하고 비교를 위한 콘텐츠 해시를 계산한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `symbol-extractor.ts` | AST/텍스트 이중 전략의 `extractSymbols()` |
| `signature-hasher.ts` | 정규화된 해싱을 위한 `computeContentHash()` |

## Conventions

- AST 추출 우선, 텍스트 기반 정규식으로 폴백
- `findContainingSymbol()`로 특정 라인을 포함하는 심볼 탐색

## Boundaries

### Always do

- AST 추출 먼저 시도, 텍스트로 폴백
- exact 및 normalized 콘텐츠 해시 모두 계산

### Ask first

- 새로운 심볼 종류 추출 추가

### Never do

- AST 미사용 시 텍스트 폴백 건너뛰기
