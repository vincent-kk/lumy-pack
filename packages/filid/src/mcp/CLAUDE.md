# mcp — MCP 서버 모듈

## Purpose

Model Context Protocol 서버를 초기화하고 12개 FCA-AI 분석 도구를 등록·제공한다. Claude Code 에이전트가 MCP 프로토콜을 통해 filid 기능을 호출할 수 있게 한다.

## Structure

| 파일/디렉토리 | 역할 |
|------|------|
| `server.ts` | MCP 서버 생성 + 11개 도구 등록 (`createServer`, `startServer`) |
| `server-entry.ts` | esbuild 번들 진입점 (`libs/server.cjs` 생성 대상) |
| `tools/` | 각 MCP 도구의 비즈니스 로직 핸들러 (11개 파일) |

## Conventions

- MCP SDK(`@modelcontextprotocol/sdk`) + `zod` 스키마 검증 사용
- 도구 응답: 성공 시 `toolResult()`, 실패 시 `toolError()` 래퍼 사용
- `Map`/`Set` JSON 직렬화: `mapReplacer` 함수로 처리
- `server-entry.ts`는 `startServer()` 호출만 — 로직 없음

## Boundaries

### Always do

- 새 도구 추가 시 `server.ts`에 `registerTool` 호출 + `tools/` 핸들러 파일 추가
- `src/index.ts`에 핸들러 함수 re-export
- Zod 스키마로 모든 도구 입력 검증

### Ask first

- 기존 도구 입력 스키마 변경 (클라이언트 호환성 영향)
- 도구 이름 변경 (`.mcp.json` 및 스킬 파일 동시 수정 필요)

### Never do

- `server-entry.ts`에 비즈니스 로직 추가
- `toolResult`/`toolError` 래퍼 없이 raw 응답 반환
- `core/` 로직을 `server.ts`에 직접 인라인 구현

## Dependencies

- `@modelcontextprotocol/sdk` — MCP 서버/트랜스포트
- `zod` — 입력 스키마 검증
- `../core/`, `../ast/`, `../metrics/`, `../compress/` — 도구 핸들러가 사용하는 로직
