# Holon — 프로젝트 계획

## 1. 프로젝트 개요

### 목적

Holon은 **프랙탈 구조 관리 플러그인**이다. 프로젝트 디렉토리 구조가 프랙탈 아키텍처 원칙을 준수하는지 분석하고, 이격(drift)을 감지하며, 필요 시 재편(restructure)을 지원하는 Claude Code 플러그인이다.

"Holon"은 전체(whole)이면서 동시에 더 큰 전체의 부분(part)인 개체를 의미한다. 프랙탈 구조에서 각 모듈은 독립적인 단위이면서 상위 구조의 일부이기도 하다는 철학을 반영한다.

### 해결하는 문제

| 문제 | 해결 방법 |
|------|-----------|
| 프로젝트가 커질수록 프랙탈 원칙에서 이탈 | Drift 감지 및 보정 계획 자동 생성 |
| 새 파일 작성 시 구조 규칙 인지 부족 | UserPromptSubmit hook으로 규칙 자동 주입 |
| 수동으로 구조를 파악하는 비용 | fractal-scan MCP 도구로 즉시 트리 시각화 |
| 의존 관계 배치 결정의 모호성 | LCA(Lowest Common Ancestor) 알고리즘으로 최적 위치 계산 |
| 구조 변경 후 규칙 위반 누락 | structure-guard PreToolUse hook으로 변경 전 검증 |

### filid와의 관계

filid는 **FCA-AI 규칙 적용** 플러그인으로, 문서 품질(CLAUDE.md 라인 수, SPEC.md 구조), 테스트 수(3+12 규칙), 코드 복잡도(LCOM4, CC)를 강제한다.

Holon은 **프랙탈 구조 자체**를 관리한다. 디렉토리 계층이 올바른 카테고리로 분류되어 있는지, 모듈 진입점이 올바르게 구성되어 있는지, 의존 관계가 LCA 원칙을 위반하지 않는지를 관리한다.

두 플러그인은 상호 보완적이며 동시에 설치 가능하다. Holon이 구조를 맞추고, filid가 그 구조 안의 내용 품질을 보장한다.

---

## 2. 핵심 기능 요약

### 3가지 동작 모드

| 모드 | 트리거 | 핵심 동작 | 에이전트 |
|------|--------|-----------|---------|
| **Auto Guide** | UserPromptSubmit hook (자동) | 프랙탈 구조 규칙을 에이전트 컨텍스트에 주입 | fractal-architect (read-only) |
| **Restructure** | `/holon:restructure` 스킬 | 프로젝트 전체 스캔 → 위반 감지 → 재구성 제안/실행 | restructurer (write) |
| **Sync** | `/holon:sync` 스킬 | 현재 구조 vs 규칙 비교 → 이격 목록 → 보정 계획 실행 | drift-analyzer (read-only) |

### 모드별 세부 기능

**Auto Guide**
- 모든 사용자 프롬프트에 경량 규칙 리마인더 주입
- PreToolUse에서 쓰기 도구(Write/Edit) 사용 전 구조 검증
- PostToolUse에서 변경 추적 및 규칙 위반 로그

**Restructure**
- 전체 프로젝트 디렉토리 트리 스캔
- 각 노드를 fractal / organ / pure-function / hybrid로 분류
- 위반 항목 목록 및 재구성 제안 생성
- restructurer 에이전트가 승인 후 실행

**Sync**
- 규칙 기대값과 현재 파일 시스템 구조 비교
- 이격 항목의 severity (error / warning / info) 분류
- SyncPlan 생성: 이동, 이름 변경, 생성, 삭제 액션 목록
- drift-analyzer 에이전트가 보정 계획 실행

---

## 3. 전체 파일 트리

```
packages/holon/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── build-plugin.mjs
├── .mcp.json
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── agents/
│   ├── fractal-architect.md
│   ├── restructurer.md
│   └── drift-analyzer.md
├── skills/
│   ├── guide/
│   │   ├── SKILL.md
│   │   └── reference.md
│   ├── restructure/
│   │   ├── SKILL.md
│   │   └── reference.md
│   └── sync/
│       ├── SKILL.md
│       └── reference.md
├── libs/                     # (빌드 산출물)
│   └── server.cjs
├── scripts/                  # (빌드 산출물)
│   ├── context-injector.mjs
│   ├── structure-guard.mjs
│   └── change-tracker.mjs
├── src/
│   ├── index.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── fractal.ts
│   │   ├── rules.ts
│   │   ├── config.ts
│   │   ├── drift.ts
│   │   ├── hooks.ts
│   │   └── report.ts
│   ├── core/
│   │   ├── rule-engine.ts
│   │   ├── config-loader.ts
│   │   ├── category-classifier.ts
│   │   ├── fractal-scanner.ts
│   │   ├── index-analyzer.ts
│   │   ├── module-main-analyzer.ts
│   │   ├── fractal-validator.ts
│   │   ├── lca-calculator.ts
│   │   ├── drift-detector.ts
│   │   └── project-analyzer.ts
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── server-entry.ts
│   │   └── tools/
│   │       ├── fractal-scan.ts
│   │       ├── drift-detect.ts
│   │       ├── lca-resolve.ts
│   │       ├── rule-query.ts
│   │       └── structure-validate.ts
│   └── hooks/
│       ├── context-injector.ts
│       ├── structure-guard.ts
│       ├── change-tracker.ts
│       └── entries/
│           ├── context-injector.entry.ts
│           ├── structure-guard.entry.ts
│           └── change-tracker.entry.ts
└── src/__tests__/
    ├── core/
    │   ├── rule-engine.test.ts
    │   ├── config-loader.test.ts
    │   ├── category-classifier.test.ts
    │   ├── fractal-scanner.test.ts
    │   ├── index-analyzer.test.ts
    │   ├── module-main-analyzer.test.ts
    │   ├── fractal-validator.test.ts
    │   ├── lca-calculator.test.ts
    │   ├── drift-detector.test.ts
    │   └── project-analyzer.test.ts
    ├── mcp/
    │   └── server.test.ts
    └── hooks/
        ├── context-injector.test.ts
        ├── structure-guard.test.ts
        └── change-tracker.test.ts
```

---

## 4. 구현 Phase 및 의존 관계

### Phase 1: Foundation (기반 설정)

**목표:** 패키지 뼈대, 빌드 시스템, 타입 시스템 완성

**작업 항목:**
1. `package.json` — `@lumy-pack/holon`, filid와 동일한 의존성 구조 (zod, yaml, fast-glob, @modelcontextprotocol/sdk, esbuild)
2. `tsconfig.json` / `tsconfig.build.json` — filid와 동일한 컴파일 설정
3. `vitest.config.ts` — 테스트 환경 설정
4. `src/types/` 전체 — 6개 타입 파일 작성 (BLUEPRINT.md 섹션 2 참조)
5. `src/index.ts` — public API export

**완료 조건:** `tsc --noEmit` 통과, 타입 임포트 오류 없음

**의존 관계:** 없음 (시작점)

---

### Phase 2: Core Modules (핵심 로직)

**목표:** 10개 핵심 모듈 구현, 의존 순서 준수

**의존 순서 (하위 → 상위):**

```
Level 0 (의존 없음):
  config-loader       — .holonrc.yml 로드, 3단계 설정 병합
  category-classifier — 경로 패턴으로 카테고리 판별

Level 1 (config-loader 의존):
  rule-engine         — 규칙 로드, 평가, 실행 (config-loader 사용)
  fractal-scanner     — 디렉토리 트리 스캔 (config-loader의 include/exclude 사용)

Level 2 (fractal-scanner 의존):
  index-analyzer      — index.ts barrel export 패턴 분석
  module-main-analyzer — 모듈 진입점, public API 추출

Level 3 (rule-engine + fractal-scanner 의존):
  fractal-validator   — 규칙 위반 검출 (rule-engine으로 평가)
  lca-calculator      — 의존 그래프에서 LCA 계산

Level 4 (모든 Level 3 의존):
  drift-detector      — validator 결과와 현재 구조 비교
  project-analyzer    — 모든 모듈 통합, 종합 분석 리포트
```

**완료 조건:** 각 모듈 단위 테스트 통과

---

### Phase 3: MCP Server (도구 서버)

**목표:** 5개 MCP 도구 구현, 서버 빌드 완성

**작업 항목:**

| 도구 | 핸들러 파일 | 사용 Core 모듈 |
|------|------------|----------------|
| `fractal-scan` | `tools/fractal-scan.ts` | fractal-scanner, project-analyzer |
| `drift-detect` | `tools/drift-detect.ts` | drift-detector, fractal-validator |
| `lca-resolve` | `tools/lca-resolve.ts` | lca-calculator |
| `rule-query` | `tools/rule-query.ts` | rule-engine, config-loader |
| `structure-validate` | `tools/structure-validate.ts` | fractal-validator, category-classifier |

**서버 구성:**
- `src/mcp/server.ts` — `createServer()`, `startServer()` (filid 패턴 그대로)
- `src/mcp/server-entry.ts` — 진입점 (`startServer()` 호출)
- `libs/server.cjs` — esbuild CJS 번들 (빌드 산출물)

**완료 조건:** `build-plugin.mjs` 실행 후 `libs/server.cjs` 생성, MCP 서버 stdio 통신 확인

---

### Phase 4: Hooks (이벤트 훅)

**목표:** 3개 hook 핸들러 구현 및 빌드

**Hook 목록:**

| Hook | 이벤트 | 핸들러 | 동작 |
|------|--------|--------|------|
| `context-injector` | UserPromptSubmit | `hooks/context-injector.ts` | 프랙탈 규칙 요약을 `additionalContext`로 주입 |
| `structure-guard` | PreToolUse (Write\|Edit) | `hooks/structure-guard.ts` | 대상 경로가 규칙을 위반하면 `continue: false` |
| `change-tracker` | PostToolUse (Write\|Edit) | `hooks/change-tracker.ts` | 변경된 파일 경로와 카테고리를 로그에 기록 |

**Entry 파일 패턴 (filid 동일):**
```typescript
// entries/context-injector.entry.ts
import { injectContext } from '../context-injector.js';
const input = JSON.parse(await readStdin());
const output = injectContext(input);
process.stdout.write(JSON.stringify(output));
```

**hooks/hooks.json 구성:**
```json
{
  "hooks": {
    "UserPromptSubmit": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/context-injector.mjs\"", "timeout": 5 }] }],
    "PreToolUse": [{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/structure-guard.mjs\"", "timeout": 3 }] }],
    "PostToolUse": [{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/change-tracker.mjs\"", "timeout": 3 }] }]
  }
}
```

**완료 조건:** 3개 `.mjs` 스크립트 빌드 완료, stdin/stdout JSON 통신 테스트 통과

---

### Phase 5: Agents & Skills (에이전트/스킬)

**목표:** 3개 에이전트 정의, 3개 스킬 정의

**에이전트:**

| 파일 | 모델 | 권한 | 역할 |
|------|------|------|------|
| `agents/fractal-architect.md` | opus | read-only | 프랙탈 구조 분석, 재구성 제안 작성 |
| `agents/restructurer.md` | sonnet | write | 에이전트 승인 후 실제 파일/디렉토리 이동 실행 |
| `agents/drift-analyzer.md` | sonnet | read-only | 이격 목록 분석, SyncPlan 작성 |

**스킬:**

| 디렉토리 | SKILL.md 트리거 | 동작 요약 |
|----------|----------------|-----------|
| `skills/guide/` | `/holon:guide` | 현재 프로젝트의 프랙탈 규칙 안내 출력 |
| `skills/restructure/` | `/holon:restructure` | fractal-architect 에이전트 실행 → 재구성 계획 → restructurer 실행 |
| `skills/sync/` | `/holon:sync` | drift-detect MCP 도구 실행 → drift-analyzer 에이전트 → SyncPlan 실행 |

**완료 조건:** 스킬 호출 시 에이전트 실행 확인, `.claude-plugin/plugin.json` 등록 완료

---

### Phase 6: Tests (테스트)

**목표:** 전체 모듈 테스트 커버리지 확보

**테스트 전략:**

| 레이어 | 파일 수 | 테스트 방식 |
|--------|---------|------------|
| `__tests__/core/` | 10개 | 순수 단위 테스트 (파일 시스템 mock) |
| `__tests__/mcp/` | 1개 | MCP 서버 도구 호출 통합 테스트 |
| `__tests__/hooks/` | 3개 | stdin/stdout JSON 직렬화 테스트 |

**핵심 테스트 케이스:**
- `rule-engine.test.ts`: 규칙 로드, 평가 결과 (pass/fail/skip), severity 필터
- `fractal-scanner.test.ts`: 가상 디렉토리 트리 스캔, FractalTree 빌드 검증
- `category-classifier.test.ts`: 각 카테고리 분류 기준 경계값 테스트
- `lca-calculator.test.ts`: 의존 그래프 LCA 계산 정확성
- `drift-detector.test.ts`: 기대 구조 vs 실제 구조 비교, DriftItem 생성
- `context-injector.test.ts`: 규칙 요약 텍스트 형식 검증

**완료 조건:** `vitest run` 전체 통과, 핵심 모듈 커버리지 80% 이상

---

## 5. 재사용 패턴 (filid 참조)

filid에서 그대로 가져오거나 최소 수정으로 재사용할 수 있는 패턴 목록:

### 빌드 스크립트 (`build-plugin.mjs`)

filid의 `build-plugin.mjs`를 기반으로 hook entry 이름만 변경:
- `pre-tool-validator`, `organ-guard`, `change-tracker`, `agent-enforcer`, `context-injector`
  → `context-injector`, `structure-guard`, `change-tracker`
- MCP 서버 번들 구성 (`libs/server.cjs`) 동일

### MCP 서버 구조 (`src/mcp/server.ts`)

`createServer()` + `startServer()` 패턴 동일. Tool definition 배열과 switch-case 핸들러 구조 재사용.
`mapReplacer` 유틸리티 (Map → plain object JSON 직렬화) 동일하게 재사용.

### Hook stdin/stdout 패턴

Entry 파일 패턴 (readStdin → parse → handle → stringify → stdout) 동일:
```typescript
// filid의 entries/*.entry.ts 패턴 그대로
const raw = await new Promise<string>((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});
const input = JSON.parse(raw);
const output = handler(input);
process.stdout.write(JSON.stringify(output));
```

### Hook 타입 정의 (`src/types/hooks.ts`)

filid의 `HookBaseInput`, `PreToolUseInput`, `PostToolUseInput`, `UserPromptSubmitInput`, `HookOutput` 인터페이스를 그대로 복사. 구조 변경 없음.

### 에이전트/스킬 파일 구조

filid의 `agents/*.md`, `skills/*/SKILL.md` 구조 동일. frontmatter 필드 (`model`, `allowedTools`, `description`) 동일하게 사용.

### `package.json` 의존성

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "fast-glob": "^3.0.0",
    "yaml": "^2.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@vitest/coverage-v8": "^3.2.4",
    "esbuild": "^0.24.0"
  }
}
```

`typescript`는 filid와 달리 holon의 `fast-glob` 기반 스캐너에 AST 파싱이 불필요하므로 의존성에서 제외 가능.

---

## 6. 검증 계획

### 빌드 검증

```bash
# TypeScript 컴파일 + esbuild 번들
yarn workspace @lumy-pack/holon build

# 예상 산출물
libs/server.cjs          # MCP 서버 CJS 번들
scripts/context-injector.mjs
scripts/structure-guard.mjs
scripts/change-tracker.mjs
```

### 타입체크 검증

```bash
yarn workspace @lumy-pack/holon typecheck
# 기대: 0 errors
```

### 테스트 검증

```bash
yarn workspace @lumy-pack/holon test:run
# 기대: 전체 통과, 핵심 모듈 커버리지 ≥ 80%
```

### 플러그인 로드 검증

| 항목 | 방법 | 기대 결과 |
|------|------|-----------|
| MCP 서버 시작 | `node libs/server.cjs` | stdio 대기 (프로세스 종료 없음) |
| Hook 스크립트 실행 | `echo '{"cwd":"/tmp","session_id":"test","hook_event_name":"UserPromptSubmit"}' \| node scripts/context-injector.mjs` | `{"continue":true,"hookSpecificOutput":{"additionalContext":"..."}}` |
| 플러그인 JSON 유효성 | `.claude-plugin/plugin.json` 스키마 검사 | 오류 없음 |
| .mcp.json 유효성 | JSON 파싱 | 오류 없음 |

### 통합 검증

- Claude Code에 플러그인 설치 후 사용자 프롬프트 입력 시 `[Holon]` 컨텍스트 주입 확인
- `/holon:sync` 스킬 호출 후 drift 보고서 출력 확인
- 구조 위반 파일 Write 시도 시 `structure-guard` hook의 차단 확인
