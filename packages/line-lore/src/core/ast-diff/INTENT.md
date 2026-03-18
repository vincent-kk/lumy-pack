# ast-diff — AST 구조적 Diff

## Purpose

파일 버전 간 AST 수준 구조적 비교를 수행하여 심볼 수준 변경 추적을 통해 스쿼시 머지를 통한 딥 트레이싱을 가능하게 한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `ast-diff.ts` | `traceByAst()` — 심볼 비교하며 커밋 히스토리 탐색 |
| `comparison/` | 심볼 맵 비교 로직 |
| `extraction/` | 심볼 추출 및 콘텐츠 해싱 |

## Conventions

- 최대 탐색 깊이 50 커밋
- AST 미사용 시 텍스트 기반 추출로 폴백

## Boundaries

### Always do

- `MAX_TRAVERSAL_DEPTH` 제한 준수
- 심볼 추출은 `extraction/`, diff는 `comparison/` 사용

### Ask first

- 탐색 깊이 제한 변경

### Never do

- 심볼 추출 추상화 레이어 우회
