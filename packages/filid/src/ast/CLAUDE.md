# ast — AST 분석 모듈

## Purpose

`@ast-grep/napi` (tree-sitter 백엔드)를 사용해 소스 코드를 파싱하고 구조적 메트릭(LCOM4, 순환 복잡도, 의존성 그래프, 트리 diff)을 계산한다.

## Structure

| 파일 | 역할 |
|------|------|
| `ast-grep-shared.ts` | `@ast-grep/napi` 지연 로딩, 언어 감지, 유틸리티 |
| `parser.ts` | ast-grep 기반 소스 파싱 (`parseSource`, `parseFile`, `walk`) |
| `dependency-extractor.ts` | import/export 의존성 추출 (`extractDependencies`) |
| `lcom4.ts` | LCOM4 응집도 계산 (`calculateLCOM4`, `extractClassInfo`) |
| `cyclomatic-complexity.ts` | 순환 복잡도 계산 (`calculateCC`) |
| `tree-diff.ts` | AST 시맨틱 diff 계산 (`computeTreeDiff`) |

## Conventions

- `@ast-grep/napi` (tree-sitter) 단일 AST 엔진 사용 (OMC와 동일 구조)
- 모든 분석 함수는 async (ast-grep 모듈 지연 로딩)
- 에러는 예외로 throw, 호출자가 처리

## Boundaries

### Always do

- `parseSource`를 통해 AST root 노드를 얻은 후 분석 함수에 전달
- LCOM4 ≥ 2 또는 CC > 20 결과는 `decision-tree.ts`에서 활용
- `types/ast.ts`의 타입만 사용 (로컬 타입 추가 금지)

### Ask first

- 새 분석 유형 추가 (메트릭 정의 검토 필요)
- `@ast-grep/napi` 버전 업그레이드

### Never do

- Babel, @swc, esprima, TypeScript Compiler API 등 다른 파서 추가
- AST 노드 직접 변환/뮤테이션 (읽기 전용 분석만)
- `core/` 또는 `mcp/` 모듈 직접 import (단방향 의존성)

## Dependencies

- `@ast-grep/napi` — tree-sitter 기반 AST 파싱
- `../types/ast.ts` — AST 관련 타입
