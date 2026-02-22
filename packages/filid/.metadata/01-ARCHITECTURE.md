# 01. 전체 구조 & 설계 철학

> filid 플러그인의 아키텍처, FCA-AI 이론과 구현의 매핑, 설계 결정 기록.

---

## FCA-AI 이론 요약

### Context Rot 문제

AI 에이전트가 대규모 코드베이스를 다룰 때 발생하는 핵심 문제:

1. **컨텍스트 창 한계**: 모든 코드를 한 번에 로드할 수 없음
2. **문서 비동기화**: 코드와 문서가 시간이 지남에 따라 괴리
3. **정보 손실**: 에이전트 세션 간 맥락 유실
4. **무분별한 성장**: CLAUDE.md, SPEC.md가 끝없이 비대해짐

### FCA-AI 해법

**Fractal Context Architecture for AI Agents** — 3가지 핵심 원리:

1. **프랙탈 분리**: 코드베이스를 자기유사적 독립 단위(fractal)로 분할
2. **부속품(Organ) 격리**: 공유 유틸리티를 리프 레벨로 격리 (CLAUDE.md 금지)
3. **상향식 파싱**: 리프 → 루트 방향으로 최소 컨텍스트만 로드

---

## filid가 FCA-AI를 구현하는 방식

### 이론 → 구현 매핑 테이블

| FCA-AI 이론 개념 | filid 구현 | 핵심 모듈 |
|-----------------|------------|-----------|
| 프랙탈 단위 | `FractalNode` (type: 'fractal') | `core/fractal-tree.ts` |
| 부속품(Organ) | `FractalNode` (type: 'organ') | `core/organ-classifier.ts` |
| 순수 함수 모듈 | `FractalNode` (type: 'pure-function') | `core/organ-classifier.ts` |
| CLAUDE.md 100줄 제한 | `validateClaudeMd()` | `core/document-validator.ts` |
| 3-tier 경계 시스템 | `ThreeTierBoundary` 검증 | `core/document-validator.ts` |
| SPEC.md append-only 금지 | `detectAppendOnly()` + `validateSpecMd()` | `core/document-validator.ts` |
| Organ CLAUDE.md 금지 | `guardStructure()` | `hooks/structure-guard.ts` |
| 3+12 테스트 규칙 | `check312Rule()` | `metrics/three-plus-twelve.ts` |
| LCOM4 분할 기준 | `calculateLCOM4()` + `decide()` | `ast/lcom4.ts`, `metrics/decision-tree.ts` |
| CC 압축 기준 | `calculateCC()` + `decide()` | `ast/cyclomatic-complexity.ts`, `metrics/decision-tree.ts` |
| 가역적 컨텍스트 압축 | `compactReversible()` | `compress/reversible-compactor.ts` |
| 손실 이력 압축 | `summarizeLossy()` | `compress/lossy-summarizer.ts` |
| 에이전트 역할 제한 | `enforceAgentRole()` | `hooks/agent-enforcer.ts` |
| 컨텍스트 규칙 주입 | `injectContext()` | `hooks/context-injector.ts` |
| PR 시점 동기화 | `ChangeQueue` | `core/change-queue.ts` |
| 의존성 비순환 검증 | `buildDAG()` + `detectCycles()` | `core/dependency-graph.ts` |

---

## 플러그인 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│                        Claude Code Runtime                        │
│                                                                    │
│  ┌─────────────┐    ┌────────────────┐    ┌───────────────────┐  │
│  │ User Prompt  │───→│ UserPromptSubmit│───→│ context-injector  │  │
│  └─────────────┘    │    Hook         │    │ (규칙 리마인더)    │  │
│                      └────────────────┘    └───────────────────┘  │
│                                                                    │
│  ┌─────────────┐    ┌────────────────┐    ┌───────────────────┐  │
│  │ Write/Edit   │───→│  PreToolUse    │───→│ pre-tool-validator│  │
│  │ Tool Call    │    │    Hook         │    │ structure-guard   │  │
│  └─────────────┘    └────────────────┘    └───────┬───────────┘  │
│        │                                          │ pass/block    │
│        ▼                                          ▼               │
│  ┌─────────────┐    ┌────────────────┐                           │
│  │ Tool 실행    │───→│  PostToolUse   │    (disabled)             │
│  │ (파일 수정)  │    │    Hook         │                           │
│  └─────────────┘    └────────────────┘                           │
│                                                                    │
│  ┌─────────────┐    ┌────────────────┐    ┌───────────────────┐  │
│  │ Subagent     │───→│ SubagentStart  │───→│ agent-enforcer    │  │
│  │ 생성         │    │    Hook         │    │ (역할 제한 주입)   │  │
│  └─────────────┘    └────────────────┘    └───────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     MCP Server (filid)                        │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │ │
│  │  │ ast-analyze   │ │fractal-nav.  │ │ doc-compress       │   │ │
│  │  │              │ │              │ │                    │   │ │
│  │  │ - dependency │ │ - classify   │ │ - reversible       │   │ │
│  │  │ - lcom4      │ │ - siblings   │ │ - lossy            │   │ │
│  │  │ - cc         │ │ - tree       │ │ - auto             │   │ │
│  │  │ - tree-diff  │ │              │ │                    │   │ │
│  │  │ - full       │ │              │ │                    │   │ │
│  │  └──────────────┘ └──────────────┘ └────────────────────┘   │ │
│  │  ┌──────────────┐                                            │ │
│  │  │ test-metrics  │    ← stdio JSON-RPC transport              │ │
│  │  │              │                                            │ │
│  │  │ - count      │                                            │ │
│  │  │ - check-312  │                                            │ │
│  │  │ - decide     │                                            │ │
│  │  └──────────────┘                                            │ │
│  │  ┌──────────────┐ ┌──────────────┐                           │ │
│  │  │review-manage │ │ debt-manage  │  ← 거버넌스 결정론적 연산   │ │
│  │  │              │ │              │                           │ │
│  │  │- normalize   │ │- create      │                           │ │
│  │  │- ensure-dir  │ │- list        │                           │ │
│  │  │- checkpoint  │ │- resolve     │                           │ │
│  │  │- elect       │ │- calc-bias   │                           │ │
│  │  │- cleanup     │ │              │                           │ │
│  │  └──────────────┘ └──────────────┘                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     Agents (4 역할)                           │ │
│  │  architect (RO)  │  implementer   │  context-mgr │ qa-rev(RO)│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     Skills (11 명령)                          │ │
│  │  /init  │  /scan  │  /sync  │  /review  │  /promote  │ /query│ │
│  │  /guide │ /restructure │ /code-review │ /resolve │ /re-valid.│ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4계층 구조: Hook → MCP → Agent → Skill

| 계층 | 역할 | 실행 시점 | 인터페이스 |
|------|------|-----------|-----------|
| **Hook** | 규칙 시행 (차단/주입) | 자동 (이벤트 기반) | stdin/stdout JSON |
| **MCP** | 분석 도구 제공 | 에이전트 호출 시 | JSON-RPC over stdio |
| **Agent** | 역할별 워크플로우 | 사용자/시스템 지시 | Claude Code subagent |
| **Skill** | 고수준 작업 단위 | 사용자 `/command` | SKILL.md 프롬프트 |

---

## 디렉토리 구조

```
packages/filid/
├── .claude-plugin/
│   └── plugin.json              # 플러그인 매니페스트
├── .mcp.json                    # MCP 서버 등록
├── agents/                      # 에이전트 정의 (4개)
│   ├── architect.md             # 읽기 전용 설계자
│   ├── implementer.md           # SPEC 범위 구현자
│   ├── context-manager.md       # 문서 관리자
│   └── qa-reviewer.md           # 읽기 전용 QA
├── hooks/
│   └── hooks.json               # Hook 이벤트 매핑
├── libs/
│   └── server.cjs               # MCP 서버 번들 (~516KB)
├── scripts/                     # Hook 스크립트 번들 (5개)
│   ├── pre-tool-validator.mjs   # CLAUDE.md/SPEC.md 검증
│   ├── structure-guard.mjs       # Organ 보호
│   ├── change-tracker.mjs       # 변경 기록 (disabled)
│   ├── agent-enforcer.mjs       # 역할 제한
│   └── context-injector.mjs     # 규칙 주입
├── skills/                      # 스킬 정의 (11개)
│   ├── init/SKILL.md
│   ├── scan/SKILL.md
│   ├── sync/SKILL.md
│   ├── structure-review/SKILL.md
│   ├── promote/SKILL.md
│   ├── context-query/SKILL.md
│   ├── guide/SKILL.md
│   ├── restructure/SKILL.md
│   ├── code-review/             # 거버넌스: phases/, personas/, state-machine.md
│   ├── resolve-review/          # 거버넌스: 수정 해결
│   └── re-validate/             # 거버넌스: Delta 재검증
├── src/                         # TypeScript 소스
│   ├── index.ts                 # 라이브러리 export (33 함수 + 30 타입)
│   ├── types/                   # 타입 정의 (6 파일)
│   ├── core/                    # 순수 비즈니스 로직 (5 모듈)
│   ├── ast/                     # AST 분석 (5 모듈)
│   ├── metrics/                 # 메트릭 분석 (4 모듈)
│   ├── compress/                # 압축 (2 모듈)
│   ├── hooks/                   # Hook 로직 + 엔트리 (5+5)
│   ├── mcp/                     # MCP 서버 + 도구 (2+6)
│   └── __tests__/               # 테스트 (unit + integration)
├── build-plugin.mjs             # esbuild 번들 스크립트
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 의존성 흐름

```
types/
  ↑
core/ ←──────────────────────────────────────┐
  ↑                                          │
  ├── ast/ (core의 타입 + parser 사용)         │
  ├── metrics/ (core의 타입 사용)              │
  └── compress/ (documents 타입 사용)          │
        ↑                                    │
hooks/ (core + core/organ-classifier 사용)     │
        ↑                                    │
mcp/tools/ (ast + metrics + compress 사용) ───┘
        ↑
mcp/server.ts (tools 통합)
        ↑
mcp/server-entry.ts (시작점)
```

### 외부 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `typescript` | ^5.7.2 | Compiler API (AST 파싱) |
| `@modelcontextprotocol/sdk` | ^1.26.0 | MCP 서버 프레임워크 |
| `fast-glob` | ^3.0.0 | 파일 패턴 탐색 |
| `yaml` | ^2.0.0 | YAML 파싱 |
| `zod` | ^3.23.8 | 스키마 검증 |
| `esbuild` | ^0.24.0 (dev) | 번들링 |

---

## 설계 결정 기록 (ADR)

### ADR-1: TypeScript Compiler API 선택

**상태**: 채택

**맥락**: AST 분석 엔진에 tree-sitter, @swc/core, TypeScript Compiler API 세 가지 후보.

**결정**: TypeScript Compiler API (`ts.createSourceFile`)를 선택.

**근거**:
- tree-sitter: 네이티브 바인딩 필요 → `node-gyp` 의존 → 플러그인 설치 복잡도 증가
- @swc/core: Rust 바이너리 → 플랫폼별 빌드 필요 → 이식성 저하
- TS Compiler API: `typescript` npm 패키지만으로 동작 → 순수 JS, 크로스 플랫폼
- filid는 TypeScript/JavaScript 소스 전용이므로 범용 파서 불필요

**트레이드오프**:
- TS Compiler API는 tree-sitter 대비 파싱 속도 느림
- 번들 크기 증가 (typescript 패키지가 무거움 → `external`로 처리)

### ADR-2: esbuild Self-Contained 번들링

**상태**: 채택

**맥락**: 플러그인이 `git clone` 후 즉시 동작해야 함. `tsc` 빌드 단계 없이.

**결정**: `build-plugin.mjs`로 esbuild 번들링. MCP 서버는 CJS, Hook 스크립트는 ESM.

**근거**:
- `libs/server.cjs`: CJS 형식 → Node.js 호환성 극대화
- `scripts/*.mjs`: ESM 형식 → `#!/usr/bin/env node` + `for await` 지원
- `typescript`를 `external`로 처리 → 사용자가 `npm install` 시 자동 설치
- 단일 파일 번들 → `dist/` 디렉토리 없이 동작

**트레이드오프**:
- `server.cjs`가 ~516KB로 큼 (minify 미적용 — 디버깅 우선)
- `typescript` 패키지가 `external` → 별도 설치 필요

### ADR-3: Hook → MCP → Agent → Skill 4계층 구조

**상태**: 채택

**맥락**: FCA-AI 규칙 시행의 자동화 수준과 사용자 제어 수준 사이 균형.

**결정**: 4계층으로 분리. 자동화 수준이 높은 순서대로:

1. **Hook** (가장 자동): 모든 도구 호출/프롬프트에 자동 개입
2. **MCP** (반자동): 에이전트가 필요 시 호출하는 분석 도구
3. **Agent** (수동-자동): 역할별 제한된 자율 에이전트
4. **Skill** (가장 수동): 사용자가 명시적으로 `/command` 실행

**근거**:
- Hook은 규칙 위반을 실시간 차단/경고 → 예방적 시행
- MCP는 필요 시에만 호출 → 불필요한 오버헤드 회피
- Agent는 역할 분리로 권한 최소화 원칙 적용
- Skill은 복잡한 워크플로우를 캡슐화 → 사용자 진입 장벽 낮춤

---

---

## 거버넌스 프레임워크 (Governance Framework)

### Layer 4 내부 프레임워크

코드 리뷰 거버넌스는 별도 Layer가 아닌 **Layer 4 (Skills) 내부 프레임워크**로 설계되었다. 3개 스킬(`code-review`, `resolve-review`, `re-validate`)이 하나의 거버넌스 라이프사이클을 형성한다.

```
/code-review ──→ /resolve-review ──→ /re-validate
 (분석+합의)       (수용/거부+ADR)      (Delta 재검증)
```

### 의장 위임 패턴 (Chairperson Delegation Pattern)

`/code-review`는 3-Phase 위임 패턴으로 컨텍스트 효율을 극대화한다:

| Phase | 실행자 | 모델 | 역할 |
|-------|--------|------|------|
| A (분석) | subagent | haiku | git diff 분석, 위원회 결정론적 선출 |
| B (검증) | subagent | sonnet | MCP tool 기반 기술 검증 |
| C (합의) | 의장 직접 | - | 페르소나 합의 상태 머신 실행 |

### 기술 부채 시스템

`debt-manage` MCP tool이 가중치 공식(`base × 2^touch_count`, cap=16)과 멱등성 보호(`last_review_commit`)를 결정론적으로 처리한다. 부채 바이어스는 리뷰 엄격도에 반영된다:

- LOW_PRESSURE (0-5): 가벼운 리뷰
- MODERATE_PRESSURE (6-15): 표준 리뷰
- HIGH_PRESSURE (16-30): 엄격한 리뷰
- CRITICAL_PRESSURE (31+): 부채 해소 우선

### ADR-4: Layer 4 내부 프레임워크 선택

**상태**: 채택

**맥락**: 거버넌스 시스템을 Layer 5로 분리하거나 Layer 4 내부 프레임워크로 설계하는 두 가지 방안.

**결정**: Layer 4 (Skills) 내부 프레임워크로 설계.

**근거**:
- 거버넌스 스킬은 기존 Hook/MCP/Agent 계층을 그대로 활용 — 새 계층 불필요
- 신규 MCP tool 2개(`review-manage`, `debt-manage`)만 추가로 충분
- 신규 agent 0개 — 페르소나는 SKILL.md 내 프레임워크 문서로 내장
- 기존 4계층 아키텍처의 일관성 유지

**트레이드오프**:
- Layer 4 스킬 수가 8→11로 증가 — 관리 범위 확대
- 페르소나 파일이 skills/ 하위에 위치 — agents/와 분리된 관리

---

## 관련 문서

- [02-BLUEPRINT.md](./02-BLUEPRINT.md) — 모듈별 상세 청사진
- [03-LIFECYCLE.md](./03-LIFECYCLE.md) — 라이프사이클 & 워크플로우
- [06-HOW-IT-WORKS.md](./06-HOW-IT-WORKS.md) — 내부 동작 메커니즘
- [07-RULES-REFERENCE.md](./07-RULES-REFERENCE.md) — 전체 규칙 레퍼런스
