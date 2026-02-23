# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is filid?

`@lumy-pack/filid`는 **Fractal Context Architecture (FCA-AI)** 규칙을 강제하는 Claude Code 플러그인이다. 4계층 아키텍처로 작동한다:

```
Layer 1 (자동)  → Hooks (PreToolUse, SubagentStart, UserPromptSubmit)
Layer 2 (도구)  → MCP Server (14개 분석/관리 도구)
Layer 3 (에이전트) → 7개 특화 에이전트 (architect, implementer, QA 등)
Layer 4 (사용자) → 13개 Skills (/filid:fca-init, /filid:fca-review 등)
```

## Commands

```bash
yarn build          # clean → version:sync → tsc → esbuild
yarn build:plugin   # esbuild 번들만 (tsc 생략)
yarn typecheck      # 타입 체크 (emit 없음)
yarn test           # watch 모드
yarn test:run       # 단일 실행 (CI)
yarn test:coverage  # 커버리지
yarn bench:run      # 벤치마크
yarn format && yarn lint  # 포맷 + 린트
yarn version:sync   # 버전 동기화 (package.json → src/version.ts)
```

## Build System

1. **TypeScript 컴파일** (`tsconfig.build.json`): `src/` → `dist/` (ESM + `.d.ts`)
2. **esbuild 번들링** (개별 빌드 스크립트):
   - `scripts/build-mcp-server.mjs`: `src/mcp/server-entry.ts` → `bridge/mcp-server.cjs` (CJS)
   - `scripts/build-hooks.mjs`: `src/hooks/entries/*.entry.ts` → `libs/*.mjs` (ESM, 각 훅)

`dist/`는 라이브러리 export용, `bridge/`는 MCP 서버 런타임용, `libs/*.mjs`는 훅 런타임용. 변경 후 `yarn build`로 재생성.

## Architecture

### Core Concepts

- **FractalNode 타입**: `fractal` (CLAUDE.md 필요), `organ` (CLAUDE.md 금지), `pure-function`, `hybrid`
- **3-Tier Boundary**: "Always do" / "Ask first" / "Never do" 섹션 필수
- **100-line Limit**: CLAUDE.md/SPEC.md 각 100줄 이하
- **3+12 Test Rule**: 핵심 3 + 엣지 12 = 최대 15개 테스트
- **Module Split**: LCOM4 ≥ 2 또는 CC > 20 또는 500줄 초과 → 분리 권장

### Key Source Directories

| 경로            | 역할                                                            |
| --------------- | --------------------------------------------------------------- |
| `src/core/`     | 핵심 로직 (FractalTree, RuleEngine, DriftDetector 등 12개 모듈) |
| `src/ast/`      | `@ast-grep/napi` AST 분석 (LCOM4, CC, 의존성)                   |
| `src/mcp/`      | MCP 서버 + 14개 도구 핸들러                                     |
| `src/hooks/`    | 훅 구현체 + `entries/` (esbuild 진입점)                         |
| `src/metrics/`  | 테스트 밀도, 모듈 분리 결정 메트릭                              |
| `src/compress/` | 컨텍스트 압축 (가역/비가역)                                     |
| `src/types/`    | 타입 정의 (index.ts에서 중앙 export)                            |

### Key Files

- `src/index.ts` — 93개 함수/상수 + 전체 타입 re-export
- `src/core/rule-engine.ts` — 7개 내장 규칙 (naming, structure, dependency, documentation, index, module)
- `src/mcp/server.ts` — MCP 서버 초기화 + 14개 도구 등록
- `src/hooks/context-injector.ts` — UserPromptSubmit 시 FCA-AI 규칙 주입
- `scripts/build-mcp-server.mjs` — MCP 서버 esbuild 번들러
- `scripts/build-hooks.mjs` — 훅 스크립트 esbuild 번들러

### Plugin Runtime

- `.claude-plugin/plugin.json` — 매니페스트 (name, version, skills, mcp)
- `.mcp.json` — MCP 서버 등록 (`bridge/mcp-server.cjs`)
- `hooks/hooks.json` — 훅 이벤트 매핑 (PreToolUse→Write/Edit, SubagentStart→*, UserPromptSubmit→*)

### Agents (7)

`fractal-architect`, `qa-reviewer` (읽기 전용) · `implementer`, `restructurer` (구현) · `context-manager` (문서) · `drift-analyzer` (드리프트) · `code-surgeon` (패치)

### Skills (14)

`fca-review` (다중 페르소나 리뷰), `fca-scan` (위반 스캔), `fca-init`, `fca-sync`, `fca-structure-review`, `fca-promote`, `fca-restructure`, `fca-resolve`, `fca-revalidate`, `fca-guide`, `fca-context-query`, `fca-update` (문서/테스트 동기화), `fca-pull-request` (FCA-aware PR 자동 생성), `fca-ast-fallback` (LLM AST 패턴 매칭)

## References

`.metadata/`: `01-ARCHITECTURE.md` (설계), `06-HOW-IT-WORKS.md` (AST 엔진), `07-RULES-REFERENCE.md` (규칙), `08-API-SURFACE.md` (API)

## Development Notes

- **AST**: `@ast-grep/napi` (tree-sitter) 단일 엔진 (OMC 동일 구조)
- **훅 수정**: `src/hooks/entries/*.entry.ts` 수정 후 `yarn build:plugin`으로 재빌드
- **버전**: `src/version.ts` 직접 수정 금지 → `yarn version:sync` 사용
- **테스트**: `src/**/__tests__/**/*.test.ts`, 벤치마크는 `**/*.bench.ts`
