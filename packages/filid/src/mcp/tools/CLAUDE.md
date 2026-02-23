# mcp/tools — MCP 도구 핸들러

## Purpose

MCP 서버에 등록된 14개 도구의 실제 비즈니스 로직을 구현한다. 각 핸들러는 zod 검증을 통과한 인자를 받아 `core/`, `ast/`, `metrics/`, `compress/` 모듈을 조합하여 결과를 반환한다.

## Structure

| 파일                    | MCP 도구               | 주요 의존                                    |
| ----------------------- | ---------------------- | -------------------------------------------- |
| `ast-analyze.ts`        | `ast_analyze`          | `ast/`                                       |
| `ast-grep-search.ts`    | `ast_grep_search`      | `ast/ast-grep-shared` (`@ast-grep/napi`)     |
| `ast-grep-replace.ts`   | `ast_grep_replace`     | `ast/ast-grep-shared` (`@ast-grep/napi`)     |
| `fractal-navigate.ts`   | `fractal_navigate`     | `core/fractal-tree`, `core/organ-classifier` |
| `fractal-scan.ts`       | `fractal_scan`         | `core/fractal-tree`, `core/project-analyzer` |
| `drift-detect.ts`       | `drift_detect`         | `core/drift-detector`                        |
| `lca-resolve.ts`        | `lca_resolve`          | `core/lca-calculator`                        |
| `rule-query.ts`         | `rule_query`           | `core/rule-engine`                           |
| `structure-validate.ts` | `structure_validate`   | `core/fractal-validator`                     |
| `test-metrics.ts`       | `test_metrics`         | `metrics/`                                   |
| `doc-compress.ts`       | `doc_compress`         | `compress/`                                  |
| `review-manage.ts`      | `review_manage`        | 파일시스템 (`.filid/review/`)                |
| `debt-manage.ts`        | `debt_manage`          | 파일시스템 (`.filid/debt/`)                  |
| `cache-manage.ts`       | `cache_manage`         | `core/cache-manager`                         |

## Conventions

- 각 파일은 단일 `handle*` 함수 export
- 입력 타입은 `server.ts`의 zod 스키마에서 파생
- 파일시스템 I/O는 `review-manage`, `debt-manage`에만 허용

## Boundaries

### Always do

- 핸들러 함수명 패턴 유지: `handle<ToolName>` (camelCase)
- 반환 타입을 `server.ts`의 `toolResult()`가 직렬화 가능한 형태로 유지
- 새 핸들러 추가 시 `server.ts`와 `src/index.ts` 동시 업데이트

### Ask first

- `review-manage` · `debt-manage` 파일시스템 경로 구조 변경

### Never do

- 핸들러에서 직접 MCP SDK 호출
- `hooks/` 모듈 import (순환 의존성)
- 한 핸들러 파일에 여러 도구 로직 혼합

## Dependencies

- `../../core/`, `../../ast/`, `../../metrics/`, `../../compress/`
