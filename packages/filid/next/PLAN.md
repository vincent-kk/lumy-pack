# filid v2 — 프랙탈 구조 관리 통합 계획

## 1. 프로젝트 개요

### 목적

filid v2는 기존 **FCA-AI 규칙 적용** 기능에 **프랙탈 구조 관리** 기능을 통합한다. 문서 품질, 테스트 수, 코드 복잡도를 강제하던 기존 기능에 더해, 디렉토리 계층이 프랙탈 원칙을 준수하는지 분석하고, 이격(drift)을 감지하며, 구조 재편(restructure)을 지원한다.

### 통합 배경

프랙탈 구조 관리를 별도 플러그인(holon)으로 분리하는 방안을 검토한 결과, 통합이 유리하다는 결론에 도달했다.

| 비교 항목 | 분리 (2개 플러그인) | 통합 (filid 확장) |
|-----------|-------------------|------------------|
| 코드 중복 | ~780줄 (타입, hook, 분류기) | 0 |
| Hook 이벤트 겹침 | 100% (3/3 이벤트 동일) | 단일 파이프라인 |
| 타입 호환성 | NodeType(3종) vs CategoryType(4종) 불일치 | 단일 타입 체계 |
| ORGAN_DIR_NAMES | 이중 하드코딩 위험 | config-loader 단일화 |
| 사용자 설치 | 2개 플러그인 관리 | 1개 플러그인 |
| 에이전트 협업 | 플러그인 간 통신 불가 | 내부 모듈 호출 |

### 해결하는 문제

**기존 filid 기능 (유지)**

| 문제 | 해결 방법 |
|------|-----------|
| CLAUDE.md 품질 저하 | PreToolUse hook으로 라인 수/구조 검증 |
| 테스트 부족 | 3+12 규칙 강제 (max 15 cases per spec.ts) |
| 코드 복잡도 초과 | LCOM4, CC 기반 split/compress/parameterize 결정 |
| Organ 디렉토리 내 CLAUDE.md | organ-guard hook으로 차단 |

**추가 기능 (v2 신규)**

| 문제 | 해결 방법 |
|------|-----------|
| 프로젝트가 커질수록 프랙탈 원칙에서 이탈 | Drift 감지 및 보정 계획 자동 생성 |
| 새 파일 작성 시 구조 규칙 인지 부족 | context-injector에 프랙탈 규칙 요약 추가 주입 |
| 수동으로 구조를 파악하는 비용 | fractal-scan MCP 도구로 즉시 트리 시각화 |
| 의존 관계 배치 결정의 모호성 | LCA 알고리즘으로 최적 위치 계산 |
| 구조 변경 후 규칙 위반 누락 | structure-guard 통합으로 변경 전 검증 강화 |
| ORGAN_DIR_NAMES 하드코딩 | .holonrc.yml 설정 기반 외부 주입으로 전환 |

---

## 2. 핵심 기능 요약

### v2 추가 동작 모드 (3가지)

| 모드 | 트리거 | 핵심 동작 | 에이전트 |
|------|--------|-----------|---------|
| **Auto Guide** | UserPromptSubmit hook (자동) | 프랙탈 구조 규칙을 에이전트 컨텍스트에 주입 | fractal-architect (read-only) |
| **Restructure** | `/filid:restructure` 스킬 | 프로젝트 전체 스캔 → 위반 감지 → 재구성 제안/실행 | restructurer (write) |
| **Sync** | `/filid:sync` 스킬 | 현재 구조 vs 규칙 비교 → 이격 목록 → 보정 계획 실행 | drift-analyzer (read-only) |

### 모드별 세부 기능

**Auto Guide**
- 기존 context-injector에 프랙탈 규칙 요약 섹션 추가 주입
- 기존 organ-guard를 structure-guard로 확장 (카테고리 분류 기반 검증)
- PostToolUse에서 변경 추적에 카테고리 정보 추가

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

## 3. 변경 범위 요약

### 기존 유지 (변경 없음)

| 모듈 | 역할 |
|------|------|
| `src/metrics/decision-tree.ts` | split/compress/parameterize 결정 |
| `src/metrics/three-plus-twelve.ts` | 3+12 규칙 |
| `src/hooks/pre-tool-validator.ts` | CLAUDE.md/SPEC.md 라인 수 검증 |
| `src/hooks/agent-enforcer.ts` | 에이전트 역할 제한 |
| `src/core/dependency-graph.ts` | DAG 구축/순환 감지 |
| `agents/fca-enforcer.md` | FCA-AI 규칙 강제 |
| `agents/structure-planner.md` | 구조 설계 |
| `agents/refactoring-guide.md` | 리팩토링 안내 |
| `agents/metrics-analyst.md` | 메트릭 분석 |

### 확장 (기존 파일 수정)

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/fractal.ts` | `NodeType` → `CategoryType`(+hybrid) 확장, `FractalNode` 필드 추가 (hasIndex, hasPackageJson, depth), `ModuleInfo` 타입 추가 |
| `src/core/organ-classifier.ts` | `ORGAN_DIR_NAMES` 하드코딩 → config-loader 기반 주입으로 전환 |
| `src/core/fractal-tree.ts` | `buildFractalTree()` 확장 — config 기반 include/exclude, maxDepth 지원, 스캔 시간 측정 |
| `src/hooks/context-injector.ts` | 프랙탈 규칙 요약 섹션 추가 주입, 인라인 organ 목록 → config-loader 참조로 교체 |
| `src/hooks/organ-guard.ts` | structure-guard로 확장 — 카테고리 분류 기반 검증 3가지 추가 |
| `src/hooks/change-tracker.ts` | 카테고리 분류 태그 추가, `.filid/change-log.jsonl` 기록 |
| `src/mcp/server.ts` | MCP 도구 5개 추가 등록 (fractal-scan, drift-detect, lca-resolve, rule-query, structure-validate) |
| `src/index.ts` | 신규 모듈 re-export 추가 |
| `hooks/hooks.json` | structure-guard matcher 유지, 기존 hook과 병합 |
| `build-plugin.mjs` | 신규 hook entry 빌드 추가 |
| `.claude-plugin/plugin.json` | 신규 에이전트/스킬 등록 |

### 신규 (새로 추가)

| 파일 | 역할 |
|------|------|
| `src/types/rules.ts` | 규칙 타입 정의 (Rule, RuleSet, RuleViolation, RuleSeverity) |
| `src/types/config.ts` | 설정 타입 정의 (HolonConfig, CategoryConfig, ScanConfig) |
| `src/types/drift.ts` | 이격 타입 정의 (DriftItem, DriftResult, SyncPlan, SyncAction) |
| `src/types/report.ts` | 보고서 타입 정의 (ScanReport, ValidationReport, AnalysisReport) |
| `src/core/config-loader.ts` | .holonrc.yml 로드, 3단계 설정 병합 |
| `src/core/rule-engine.ts` | 규칙 로드, 평가, 실행 |
| `src/core/fractal-scanner.ts` | 디렉토리 트리 스캔 (config 기반 확장판 fractal-tree) |
| `src/core/index-analyzer.ts` | index.ts barrel export 패턴 분석 |
| `src/core/module-main-analyzer.ts` | 모듈 진입점, public API 추출 |
| `src/core/fractal-validator.ts` | 규칙 위반 검출 |
| `src/core/lca-calculator.ts` | 의존 그래프에서 LCA 계산 |
| `src/core/drift-detector.ts` | validator 결과와 현재 구조 비교 |
| `src/core/project-analyzer.ts` | 모든 모듈 통합, 종합 분석 리포트 |
| `src/mcp/tools/fractal-scan.ts` | MCP 도구 핸들러 |
| `src/mcp/tools/drift-detect.ts` | MCP 도구 핸들러 |
| `src/mcp/tools/lca-resolve.ts` | MCP 도구 핸들러 |
| `src/mcp/tools/rule-query.ts` | MCP 도구 핸들러 |
| `src/mcp/tools/structure-validate.ts` | MCP 도구 핸들러 |
| `src/hooks/entries/structure-guard.entry.ts` | structure-guard hook 진입점 |
| `agents/fractal-architect.md` | 프랙탈 구조 분석 에이전트 |
| `agents/restructurer.md` | 구조 재편 실행 에이전트 |
| `agents/drift-analyzer.md` | 이격 분석 에이전트 |
| `skills/guide/SKILL.md` | 프랙탈 규칙 안내 스킬 |
| `skills/restructure/SKILL.md` | 구조 재편 스킬 |
| `skills/sync/SKILL.md` | 이격 동기화 스킬 |

---

## 4. 파일 트리 (추가/변경 부분)

기존 `packages/filid/` 구조에 추가되는 파일을 `[NEW]`, 수정되는 파일을 `[MOD]`로 표시한다.

```
packages/filid/
├── [MOD] .claude-plugin/plugin.json         # 에이전트/스킬 추가 등록
├── [MOD] .mcp.json                          # 서버 이름 유지 (filid)
├── [MOD] hooks/hooks.json                   # structure-guard 통합
├── [MOD] build-plugin.mjs                   # 신규 entry 빌드 추가
├── agents/
│   ├── (기존 4개 유지)
│   ├── [NEW] fractal-architect.md
│   ├── [NEW] restructurer.md
│   └── [NEW] drift-analyzer.md
├── skills/
│   ├── (기존 6개 유지)
│   ├── [NEW] guide/
│   │   ├── SKILL.md
│   │   └── reference.md
│   ├── [NEW] restructure/
│   │   ├── SKILL.md
│   │   └── reference.md
│   └── [NEW] sync/
│       ├── SKILL.md
│       └── reference.md
├── src/
│   ├── [MOD] index.ts                       # 신규 모듈 re-export
│   ├── types/
│   │   ├── [MOD] fractal.ts                 # CategoryType 확장, FractalNode 필드 추가
│   │   ├── [NEW] rules.ts
│   │   ├── [NEW] config.ts
│   │   ├── [NEW] drift.ts
│   │   └── [NEW] report.ts
│   ├── core/
│   │   ├── [MOD] fractal-tree.ts            # config 기반 스캔 확장
│   │   ├── [MOD] organ-classifier.ts        # 하드코딩 → config-loader 주입
│   │   ├── (dependency-graph.ts 유지)
│   │   ├── [NEW] config-loader.ts
│   │   ├── [NEW] rule-engine.ts
│   │   ├── [NEW] fractal-scanner.ts         # fractal-tree 래핑 + config 통합
│   │   ├── [NEW] index-analyzer.ts
│   │   ├── [NEW] module-main-analyzer.ts
│   │   ├── [NEW] fractal-validator.ts
│   │   ├── [NEW] lca-calculator.ts
│   │   ├── [NEW] drift-detector.ts
│   │   └── [NEW] project-analyzer.ts
│   ├── mcp/
│   │   ├── [MOD] server.ts                  # 5개 도구 추가 (총 9개)
│   │   └── tools/
│   │       ├── (fractal-navigate.ts 유지)
│   │       ├── [NEW] fractal-scan.ts
│   │       ├── [NEW] drift-detect.ts
│   │       ├── [NEW] lca-resolve.ts
│   │       ├── [NEW] rule-query.ts
│   │       └── [NEW] structure-validate.ts
│   ├── hooks/
│   │   ├── [MOD] context-injector.ts        # 프랙탈 규칙 섹션 추가
│   │   ├── [MOD] organ-guard.ts → structure-guard.ts  # 확장 리네임
│   │   ├── [MOD] change-tracker.ts          # 카테고리 태그 추가
│   │   ├── (pre-tool-validator.ts 유지)
│   │   ├── (agent-enforcer.ts 유지)
│   │   └── entries/
│   │       └── [NEW] structure-guard.entry.ts
│   └── __tests__/
│       ├── core/
│       │   ├── [NEW] config-loader.test.ts
│       │   ├── [NEW] rule-engine.test.ts
│       │   ├── [NEW] fractal-scanner.test.ts
│       │   ├── [NEW] category-classifier.test.ts
│       │   ├── [NEW] index-analyzer.test.ts
│       │   ├── [NEW] module-main-analyzer.test.ts
│       │   ├── [NEW] fractal-validator.test.ts
│       │   ├── [NEW] lca-calculator.test.ts
│       │   ├── [NEW] drift-detector.test.ts
│       │   └── [NEW] project-analyzer.test.ts
│       ├── mcp/
│       │   └── [MOD] server.test.ts         # 신규 도구 테스트 추가
│       └── hooks/
│           ├── [NEW] structure-guard.test.ts
│           └── [MOD] context-injector.test.ts
└── next/                                    # 본 계획 문서
    ├── PLAN.md (본 문서)
    ├── BLUEPRINT.md
    └── phases/
        ├── phase-1-foundation.md
        ├── phase-2-core.md
        ├── phase-3-mcp.md
        ├── phase-4-hooks.md
        ├── phase-5-agents-skills.md
        └── phase-6-tests.md
```

---

## 5. 구현 Phase 및 의존 관계

### Phase 1: 타입 확장 & 설정 시스템

**목표:** 기존 타입을 확장하고, config-loader를 도입하여 하드코딩 제거

**작업 항목:**
1. `src/types/fractal.ts` — `NodeType` → `CategoryType`(+hybrid) 확장, `FractalNode` 필드 추가, `ModuleInfo` 타입 추가
2. `src/types/rules.ts` — 규칙 타입 정의 (BLUEPRINT.md 섹션 2.2 참조)
3. `src/types/config.ts` — 설정 타입 정의 (BLUEPRINT.md 섹션 2.3 참조)
4. `src/types/drift.ts` — 이격 타입 정의 (BLUEPRINT.md 섹션 2.4 참조)
5. `src/types/report.ts` — 보고서 타입 정의 (BLUEPRINT.md 섹션 2.6 참조)
6. `src/core/config-loader.ts` — `.holonrc.yml` 로드, 설정 병합 (default → project → user)
7. `src/index.ts` — 신규 타입 re-export 추가

**마이그레이션:**
- `src/core/organ-classifier.ts`의 `ORGAN_DIR_NAMES` 하드코딩을 config-loader에서 제공하는 값으로 교체
- `src/hooks/context-injector.ts:21`의 인라인 organ 목록을 config-loader 참조로 교체
- 기존 `NodeType`을 사용하는 모든 import는 `CategoryType`으로 전환 (하위 호환: `NodeType = CategoryType`으로 alias 유지)

**완료 조건:** `tsc --noEmit` 통과, 기존 테스트 전체 통과

**의존 관계:** 없음 (시작점)

---

### Phase 2: Core 모듈 추가

**목표:** 8개 신규 핵심 모듈 구현, 기존 2개 모듈 확장

**의존 순서 (하위 → 상위):**

```
Level 0 (의존 없음, Phase 1 타입만 의존):
  config-loader         — .holonrc.yml 로드, 3단계 설정 병합 (Phase 1에서 생성)
  organ-classifier [MOD] — config-loader 기반 주입으로 전환

Level 1 (config-loader 의존):
  rule-engine            — 규칙 로드, 평가, 실행
  fractal-scanner        — fractal-tree.ts 래핑 + config 기반 include/exclude

Level 2 (fractal-scanner 의존):
  index-analyzer         — index.ts barrel export 패턴 분석
  module-main-analyzer   — 모듈 진입점, public API 추출

Level 3 (rule-engine + fractal-scanner 의존):
  fractal-validator      — 규칙 위반 검출
  lca-calculator         — 의존 그래프에서 LCA 계산

Level 4 (모든 Level 3 의존):
  drift-detector         — validator 결과와 현재 구조 비교
  project-analyzer       — 모든 모듈 통합, 종합 분석 리포트
```

**기존 모듈 확장:**
- `fractal-tree.ts` — config 기반 include/exclude, maxDepth, 스캔 시간 측정 추가
- `organ-classifier.ts` — `ORGAN_DIR_NAMES`를 `config-loader`에서 주입받도록 변경, `classifyNode()` 반환값을 `CategoryType`으로 확장 (hybrid 판별 추가)

**완료 조건:** 각 모듈 단위 테스트 통과, 기존 테스트 전체 통과

---

### Phase 3: MCP 서버 확장

**목표:** 기존 MCP 서버에 5개 도구 추가 (총 9개 도구)

**기존 도구 (유지):**
- `fractal-navigate` (action: tree | classify | ancestors | descendants)

**추가 도구:**

| 도구 | 핸들러 파일 | 사용 Core 모듈 |
|------|------------|----------------|
| `fractal-scan` | `tools/fractal-scan.ts` | fractal-scanner, project-analyzer |
| `drift-detect` | `tools/drift-detect.ts` | drift-detector, fractal-validator |
| `lca-resolve` | `tools/lca-resolve.ts` | lca-calculator |
| `rule-query` | `tools/rule-query.ts` | rule-engine, config-loader |
| `structure-validate` | `tools/structure-validate.ts` | fractal-validator, category-classifier |

**서버 수정:**
- `src/mcp/server.ts`의 `TOOL_DEFINITIONS` 배열에 5개 도구 정의 추가
- `CallToolRequestSchema` 핸들러의 switch-case에 5개 분기 추가
- 서버 이름 유지: `filid` (변경 없음)

**완료 조건:** `build-plugin.mjs` 실행 후 `libs/server.cjs` 생성, 9개 도구 등록 확인

---

### Phase 4: Hook 통합

**목표:** 기존 5개 hook 중 3개를 확장하여 프랙탈 구조 기능 통합

**Hook 통합 전략:**

| 기존 Hook | 통합 방향 | 변경 내용 |
|-----------|----------|-----------|
| `context-injector` | **확장** | 기존 FCA-AI 규칙 주입에 프랙탈 구조 규칙 요약 섹션 추가. config-loader 기반 organ 목록 참조 |
| `organ-guard` | **확장 + 리네임** → `structure-guard` | 기존 organ CLAUDE.md 차단에 카테고리 기반 검증 3가지 추가 (미분류 경로, 순환 의존, organ 하위 fractal 생성) |
| `change-tracker` | **확장** | 기존 추적에 카테고리 분류 태그 추가, `.filid/change-log.jsonl` 기록 |
| `pre-tool-validator` | **유지** | 변경 없음 |
| `agent-enforcer` | **유지** | 변경 없음 |

**hooks.json 통합:**
- `organ-guard`의 matcher와 이벤트를 그대로 사용 (`PreToolUse: Write|Edit`)
- 빌드 산출물 파일명: `scripts/structure-guard.mjs` (기존 `organ-guard.mjs` 대체)
- 기존 `organ-guard.mjs` 참조를 `structure-guard.mjs`로 업데이트

**설계 결정 — structure-guard의 차단 정책:**
- 기존 filid organ-guard: `continue: false` (CLAUDE.md 차단)
- 통합 후: organ CLAUDE.md는 여전히 `continue: false`, 나머지 구조 검증은 `continue: true` (경고만)

**완료 조건:** 기존 hook 동작 변경 없음 확인, 확장 기능 테스트 통과

---

### Phase 5: Agent & Skill 추가

**목표:** 3개 에이전트 정의, 3개 스킬 정의

**에이전트 추가:**

| 파일 | 모델 | 권한 | 역할 |
|------|------|------|------|
| `agents/fractal-architect.md` | opus | read-only | 프랙탈 구조 분석, 재구성 제안 작성 |
| `agents/restructurer.md` | sonnet | write | 승인된 제안에 따라 실제 파일/디렉토리 이동 실행 |
| `agents/drift-analyzer.md` | sonnet | read-only | 이격 목록 분석, SyncPlan 작성 |

**스킬 추가:**

| 디렉토리 | SKILL.md 트리거 | 동작 요약 |
|----------|----------------|-----------|
| `skills/guide/` | `/filid:guide` | 현재 프로젝트의 프랙탈 규칙 안내 출력 |
| `skills/restructure/` | `/filid:restructure` | fractal-architect → 재구성 계획 → restructurer 실행 |
| `skills/sync/` | `/filid:sync` | drift-detect → drift-analyzer → SyncPlan 실행 |

**기존 에이전트/스킬과의 관계:**
- 기존 `fca-enforcer` 에이전트는 FCA-AI 규칙 강제를 유지
- `fractal-architect`는 구조 분석/설계에 집중 (역할 분리)
- 기존 `skills/init/`, `skills/scan/` 스킬에서 `fractal-navigate` 호출 부분은 `fractal-scan`으로 전환 가능 (선택적)

**완료 조건:** 스킬 호출 시 에이전트 실행 확인, plugin.json 등록 완료

---

### Phase 6: 테스트 확장

**목표:** 신규/확장 모듈 테스트 커버리지 확보

**테스트 전략:**

| 레이어 | 신규 파일 수 | 테스트 방식 |
|--------|-------------|------------|
| `__tests__/core/` | 10개 | 순수 단위 테스트 (파일 시스템 mock) |
| `__tests__/mcp/` | 기존 확장 | 5개 신규 도구 통합 테스트 추가 |
| `__tests__/hooks/` | 2개 (확장 + 신규) | stdin/stdout JSON 직렬화 테스트 |

**핵심 테스트 케이스:**
- `config-loader.test.ts`: 설정 로드, 병합, zod 검증, 기본값 폴백
- `fractal-scanner.test.ts`: 가상 디렉토리 트리 스캔, FractalTree 빌드 검증
- `category-classifier.test.ts`: 4종 카테고리 분류 경계값 (organ-classifier 확장)
- `lca-calculator.test.ts`: 의존 그래프 LCA 계산 정확성
- `drift-detector.test.ts`: 기대 구조 vs 실제 구조 비교, DriftItem 생성
- `structure-guard.test.ts`: 기존 organ-guard 동작 보존 + 확장 검증 (회귀 방지)
- `context-injector.test.ts`: 기존 FCA-AI 주입 + 프랙탈 규칙 주입 통합 확인

**완료 조건:** `vitest run` 전체 통과, 핵심 모듈 커버리지 80% 이상, 기존 테스트 회귀 없음

---

## 6. 마이그레이션 가이드

### 6.1 타입 시스템 마이그레이션

기존 `NodeType`을 `CategoryType`으로 확장:

```typescript
// 기존 (v1)
export type NodeType = 'fractal' | 'organ' | 'pure-function';

// 확장 (v2) — 하위 호환
export type CategoryType = 'fractal' | 'organ' | 'pure-function' | 'hybrid';
export type NodeType = CategoryType; // alias 유지
```

기존 `FractalNode`에 필드 추가:

```typescript
// 추가 필드 (기존 필드는 모두 유지)
hasIndex: boolean;       // index.ts 존재 여부
hasPackageJson: boolean; // 패키지 경계
depth: number;           // 루트로부터의 깊이
```

### 6.2 ORGAN_DIR_NAMES 마이그레이션

```typescript
// 기존 (v1) — organ-classifier.ts
const ORGAN_DIR_NAMES = ['components', 'utils', 'types', ...]; // 9개 하드코딩

// 확장 (v2) — config-loader에서 주입
import { loadConfig } from './config-loader.js';
const config = await loadConfig(cwd);
const organNames = config.categories?.organNames ?? DEFAULT_ORGAN_NAMES;
```

기본값은 기존 9개를 유지하되, `.holonrc.yml`로 확장 가능:

```yaml
# .holonrc.yml
categories:
  organNames:
    - "queries"
    - "mutations"
    - "schemas"
```

### 6.3 Hook 마이그레이션

`organ-guard.ts` → `structure-guard.ts` 리네임 시:
- `hooks.json`에서 스크립트 경로 변경: `organ-guard.mjs` → `structure-guard.mjs`
- `build-plugin.mjs`에서 entry 이름 변경
- 기존 `isOrganDirectory()` 함수는 내부적으로 유지 (structure-guard에서 호출)
- 기존 차단 동작 (`continue: false` for organ CLAUDE.md) 완전 보존

### 6.4 context-injector 인라인 organ 목록 교체

```typescript
// 기존 (v1) — line 21
'- Organ directories (components, utils, types, hooks, helpers, lib, styles, assets, constants) must NOT have CLAUDE.md'

// 확장 (v2) — config-loader 참조
const organNames = config.categories?.organNames ?? DEFAULT_ORGAN_NAMES;
`- Organ directories (${organNames.join(', ')}) must NOT have CLAUDE.md`
```

---

## 7. 검증 계획

### 빌드 검증

```bash
# TypeScript 컴파일 + esbuild 번들
yarn workspace @lumy-pack/filid build

# 예상 산출물 (기존 + 추가)
libs/server.cjs               # MCP 서버 CJS 번들 (9개 도구 포함)
scripts/context-injector.mjs   # (기존, 확장됨)
scripts/structure-guard.mjs    # (organ-guard.mjs 대체)
scripts/change-tracker.mjs     # (기존, 확장됨)
scripts/pre-tool-validator.mjs # (기존, 변경 없음)
scripts/agent-enforcer.mjs     # (기존, 변경 없음)
```

### 타입체크 검증

```bash
yarn workspace @lumy-pack/filid typecheck
# 기대: 0 errors
```

### 테스트 검증

```bash
yarn workspace @lumy-pack/filid test:run
# 기대: 전체 통과 (기존 + 신규), 핵심 모듈 커버리지 ≥ 80%
```

### 회귀 테스트

| 항목 | 방법 | 기대 결과 |
|------|------|-----------|
| 기존 hook 동작 | 기존 테스트 전체 실행 | 변경 전과 동일한 결과 |
| organ CLAUDE.md 차단 | organ-guard 테스트 | `continue: false` 유지 |
| FCA-AI 규칙 주입 | context-injector 테스트 | 기존 주입 내용 보존 |
| MCP 기존 도구 | fractal-navigate 테스트 | 기존 동작 동일 |

### 플러그인 로드 검증

| 항목 | 방법 | 기대 결과 |
|------|------|-----------|
| MCP 서버 시작 | `node libs/server.cjs` | stdio 대기 (프로세스 종료 없음) |
| 신규 도구 응답 | `fractal-scan` 호출 | ScanReport JSON 반환 |
| Hook 스크립트 실행 | context-injector stdin/stdout | 기존 FCA-AI + 프랙탈 규칙 포함 |
| structure-guard 실행 | organ CLAUDE.md Write | `continue: false` + 차단 사유 |
| plugin.json 유효성 | 스키마 검사 | 7개 에이전트, 9개 스킬 등록 확인 |

### 통합 검증

- Claude Code에 플러그인 설치 후 사용자 프롬프트 입력 시 `[filid]` 컨텍스트에 프랙탈 규칙 포함 확인
- `/filid:guide` 스킬 호출 후 규칙 안내 출력 확인
- `/filid:sync` 스킬 호출 후 drift 보고서 출력 확인
- 구조 위반 파일 Write 시도 시 `structure-guard` hook의 경고 확인
- 기존 `/filid:init`, `/filid:scan` 스킬 정상 동작 확인

---

## 8. 의존성 변경

### 추가 의존성

```json
{
  "dependencies": {
    "yaml": "^2.0.0",
    "zod": "^3.23.8"
  }
}
```

기존 filid 의존성 (`@modelcontextprotocol/sdk`, `fast-glob`, `esbuild` 등)은 변경 없음.
`yaml`은 `.holonrc.yml` 파싱에 필요하고, `zod`는 설정 스키마 검증에 필요하다.

### 불필요한 의존성

기존 holon 계획에서 별도 패키지용으로 예정했던 `typescript` (AST 파싱용) 의존성은 filid에 이미 포함되어 있으므로 추가 불필요.
