# ast — AST 파싱

## Purpose

`@ast-grep/napi`를 통한 선택적 AST 파싱 기능을 제공한다. 심볼 추출 및 구조적 코드 분석에 사용되며, ast-grep 미설치 시 텍스트 기반으로 우아하게 폴백한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `parser.ts` | ast-grep 지연 로딩, 심볼 검색, 텍스트 폴백 |

## Conventions

- ast-grep는 런타임에 지연 로딩하여 가용성 확인
- AST 미사용 시 정규식 기반 텍스트 폴백 적용

## Boundaries

### Always do

- AST 기능 사용 전 `isAstAvailable()` 확인
- `EXTENSION_TO_LANG` 맵의 모든 언어 지원

### Ask first

- 새로운 언어 지원 추가

### Never do

- ast-grep를 필수 의존성으로 만들기
