# src — filid 소스 루트

## Purpose

`@lumy-pack/filid`의 전체 소스 코드 루트. FCA-AI 규칙 강제를 위한 핵심 로직, MCP 서버, AST 분석, 메트릭, 압축, 훅 구현체를 포함한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 공개 API 엔트리포인트 (33개 함수 + 30개 타입 re-export) |
| `version.ts` | 자동 생성 버전 상수 (직접 수정 금지) |
| `core/` | FractalTree, RuleEngine, DriftDetector 등 12개 핵심 모듈 |
| `ast/` | TypeScript Compiler API 기반 AST 분석 (LCOM4, CC, 의존성) |
| `mcp/` | MCP 서버 + 11개 도구 핸들러 |
| `hooks/` | Claude Code 훅 구현체 + esbuild 진입점 |
| `metrics/` | 테스트 밀도 · 모듈 분리 결정 메트릭 |
| `compress/` | 컨텍스트 압축 (가역/비가역) |
| `types/` | 공유 TypeScript 타입 정의 |
| `__tests__/` | 테스트 모음 (unit, integration, bench) |

## Conventions

- ESM modules (`"type": "module"`), 확장자 `.js` import
- TypeScript Compiler API 사용 (Babel 미사용, ADR-1)
- `version.ts`는 `yarn version:sync`로만 갱신
- 모든 공개 API는 `index.ts`에서 re-export

## Boundaries

### Always do

- 새 모듈 추가 시 `index.ts`에 export 추가
- `core/` 변경 후 관련 `__tests__/unit/core/` 테스트 업데이트
- 빌드 후 `dist/`와 `libs/` 모두 재생성 확인

### Ask first

- 새 하위 디렉토리 추가 (아키텍처 결정 필요)
- 공개 API 제거 또는 시그니처 변경 (breaking change)

### Never do

- `version.ts` 직접 수정
- `types/` 디렉토리에 비즈니스 로직 추가
- 순환 의존성 도입 (core ↔ mcp ↔ hooks)

## Dependencies

- Node.js `>=20`, TypeScript 5.7
- `@modelcontextprotocol/sdk`, `zod`, `fast-glob`
