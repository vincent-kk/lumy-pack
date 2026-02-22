# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is filid?

`@lumy-pack/filid`는 **Fractal Context Architecture (FCA-AI)** 규칙을 강제하는 Claude Code 플러그인이다. AI 에이전트가 코드베이스 작업 시 컨텍스트 비대화, 문서 드리프트, 구조적 혼란을 방지하기 위해 4계층 아키텍처로 작동한다:

```
Layer 1 (자동)  → Hooks (PreToolUse, SubagentStart, UserPromptSubmit)
Layer 2 (도구)  → MCP Server (11개 분석/관리 도구)
Layer 3 (에이전트) → 6개 특화 에이전트 (architect, implementer, QA 등)
Layer 4 (사용자) → 11개 Skills (/filid:fca-init, /filid:fca-review 등)
```

## Commands

```bash
# 빌드 (순서: clean → version:sync → tsc → esbuild)
yarn build

# esbuild 번들만 (tsc 생략)
yarn build:plugin

# 타입 체크 (emit 없음)
yarn typecheck

# 테스트
yarn test          # watch 모드
yarn test:run      # 단일 실행 (CI)
yarn test:coverage # 커버리지

# 특정 테스트 실행
yarn test:run src/__tests__/unit/core/drift-detector.test.ts

# 벤치마크
yarn bench:run

# 포맷
yarn format

# 린트
yarn lint

# 버전 동기화 (package.json → src/version.ts)
yarn version:sync
```

## Build System

빌드는 두 단계로 구성된다:

1. **TypeScript 컴파일** (`tsconfig.build.json`): `src/` → `dist/` (ESM + `.d.ts`)
2. **esbuild 번들링** (`build-plugin.mjs`):
   - `src/mcp/server-entry.ts` → `libs/server.cjs` (CJS, ~516KB)
   - `src/hooks/entries/*.entry.ts` → `libs/*.mjs` (ESM, 각 훅)

`dist/`는 라이브러리 export용, `libs/`는 플러그인 런타임용이다. 플러그인을 변경하면 반드시 `yarn build`로 `libs/`를 재생성해야 한다.

## Architecture

### Core Concepts

- **FractalNode 타입**: `fractal` (독립 비즈니스 모듈, CLAUDE.md 필요), `organ` (공유 유틸리티, CLAUDE.md 금지), `pure-function` (순수 계산), `hybrid` (혼합 — 리팩터링 필요)
- **3-Tier Boundary System**: CLAUDE.md 내 "Always do" / "Ask first" / "Never do" 3개 섹션
- **100-line Limit**: CLAUDE.md와 SPEC.md는 각 100줄을 초과할 수 없음
- **3+12 Test Rule**: 스펙당 핵심 3개 + 엣지 케이스 12개 = 최대 15개 테스트

### Module Split Decision Tree

- LCOM4 ≥ 2 → 모듈 분리 권장
- Cyclomatic Complexity > 20 → 분리 권장
- 파일 크기 > 500줄 → 분리 권장

### Key Source Directories

| 경로 | 역할 |
|------|------|
| `src/core/` | 핵심 비즈니스 로직 (FractalTree, RuleEngine, DriftDetector 등 12개 모듈) |
| `src/ast/` | TypeScript Compiler API 기반 AST 분석 (LCOM4, CC, 의존성 추출) |
| `src/mcp/` | MCP 서버 + 11개 도구 핸들러 |
| `src/hooks/` | 훅 구현체 + `entries/` (esbuild 진입점) |
| `src/metrics/` | 테스트 밀도, 모듈 분리 결정 메트릭 |
| `src/compress/` | 컨텍스트 압축 (가역/비가역) |
| `src/types/` | 타입 정의 (index.ts에서 중앙 export) |

### Key Files

- `src/index.ts` — 33개 함수 + 30개 타입 공개 export
- `src/core/rule-engine.ts` — 7개 내장 규칙 (naming, structure, dependency, documentation, index, module)
- `src/core/document-validator.ts` — CLAUDE.md/SPEC.md 100줄 제한 + 3-tier 경계 검증
- `src/mcp/server.ts` — MCP 서버 초기화 + 11개 도구 등록
- `src/hooks/context-injector.ts` — UserPromptSubmit 시 FCA-AI 규칙 컨텍스트 주입
- `build-plugin.mjs` — esbuild 번들러 스크립트

### Plugin Runtime Files

- `.claude-plugin/plugin.json` — 플러그인 매니페스트 (name, version, skills, mcp)
- `.mcp.json` — MCP 서버 등록 (`libs/server.cjs` 실행)
- `hooks/hooks.json` — 훅 이벤트 매핑 (PreToolUse→Write/Edit, SubagentStart→*, UserPromptSubmit→*)

### Agents & Skills

`agents/*.md` — 6개 특화 에이전트 정의:
- `fractal-architect`, `qa-reviewer` — 읽기 전용 리뷰어 (코드 수정 불가)
- `implementer`, `restructurer` — 구현/리팩터링 담당
- `context-manager` — CLAUDE.md/SPEC.md 문서 관리
- `drift-analyzer` — 코드-문서 드리프트 감지

`skills/*/SKILL.md` — 11개 사용자 호출 가능 스킬:
- `fca-review` — 다중 페르소나 거버넌스 리뷰 (가장 복잡)
- `fca-scan` — 규칙 위반 스캔 (`--fix` 자동 수정)
- `fca-init`, `fca-sync`, `fca-structure-review`, `fca-promote`, `fca-restructure`, `fca-resolve`, `fca-revalidate`, `fca-guide`, `fca-context-query`

## Internal Documentation

`.metadata/` 디렉터리에 상세 기술 문서가 있다:
- `01-ARCHITECTURE.md` — FCA-AI 이론, 4계층 아키텍처, ADR
- `06-HOW-IT-WORKS.md` — AST 엔진 메커니즘, 결정 트리, MCP 라우팅
- `07-RULES-REFERENCE.md` — 규칙 카탈로그 + 임계값 상수
- `08-API-SURFACE.md` — 공개 API 레퍼런스

## Development Notes

- **AST 파싱**: `@babel/parser` 대신 TypeScript Compiler API 사용 (네이티브 바인딩 불필요, ADR-1)
- **훅 수정 시**: `src/hooks/entries/*.entry.ts`를 통해 진입점이 분리됨. 수정 후 `yarn build:plugin`으로 `libs/*.mjs` 재빌드
- **버전 관리**: `src/version.ts`는 자동 생성 파일 — 직접 수정하지 말 것. `package.json`의 version 변경 후 `yarn version:sync` 실행
- **테스트 패턴**: `src/**/__tests__/**/*.test.ts`, fixtures 제외. 벤치마크는 `**/*.bench.ts`
