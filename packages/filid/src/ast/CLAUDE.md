# ast — AST 분석 모듈

## Purpose

TypeScript Compiler API를 사용해 소스 코드를 파싱하고 구조적 메트릭(LCOM4, 순환 복잡도, 의존성 그래프, 트리 diff)을 계산한다.

## Structure

| 파일 | 역할 |
|------|------|
| `parser.ts` | TS Compiler API 기반 소스 파싱 (`parseSource`, `parseFile`) |
| `dependency-extractor.ts` | import/export 의존성 추출 (`extractDependencies`) |
| `lcom4.ts` | LCOM4 응집도 계산 (`calculateLCOM4`, `extractClassInfo`) |
| `cyclomatic-complexity.ts` | 순환 복잡도 계산 (`calculateCC`) |
| `tree-diff.ts` | AST 시맨틱 diff 계산 (`computeTreeDiff`) |

## Conventions

- TypeScript Compiler API 직접 사용 (Babel 미사용 — ADR-1: 네이티브 바인딩 불필요)
- 모든 함수는 순수 함수 또는 async (파일 I/O 최소화)
- 에러는 예외로 throw, 호출자가 처리

## Boundaries

### Always do

- `parseSource`를 통해 AST를 얻은 후 분석 함수에 전달
- LCOM4 ≥ 2 또는 CC > 20 결과는 `decision-tree.ts`에서 활용
- `types/ast.ts`의 타입만 사용 (로컬 타입 추가 금지)

### Ask first

- 새 분석 유형 추가 (메트릭 정의 검토 필요)
- Compiler API 버전 업그레이드

### Never do

- Babel, @swc, esprima 등 외부 파서 추가
- AST 노드 직접 변환/뮤테이션 (읽기 전용 분석만)
- `core/` 또는 `mcp/` 모듈 직접 import (단방향 의존성)

## Dependencies

- `typescript` (Compiler API)
- `../types/ast.ts` — AST 관련 타입
