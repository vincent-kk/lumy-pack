# filid 프랙탈 구조 참조 맵

> filid 내에서 프랙탈 구조를 참조하는 모든 위치를 정리한 문서.
> 프랙탈 구조의 구체적 정의/설정은 이 문서에 포함하지 않으며, 참조 위치와 역할만 기술한다.
> 프랙탈 구조 관리는 별도 플러그인(holon)으로 분리될 수 있으며, 중복 선언을 피하기 위한 참조 맵이다.

---

## 1. 타입 정의 (프랙탈 데이터 모델)

| 파일 | 정의 | 결합도 | 비고 |
|------|------|--------|------|
| `src/types/fractal.ts` | `CategoryType`, `NodeType`, `FractalNode`, `FractalTree`, `DirEntry`, `ModuleInfo`, `PublicApi`, `DependencyEdge`, `DependencyDAG` | **강결합** | 프랙탈 구조의 핵심 데이터 모델. 분리 시 인터페이스 패키지 필요 |
| `src/types/rules.ts` | `Rule`, `RuleContext`, `RuleViolation`, `RuleEvaluationResult`, `BUILTIN_RULE_IDS` | **강결합** | FractalNode/FractalTree를 직접 참조 |
| `src/types/scan.ts` | `ScanOptions`, `DEFAULT_SCAN_OPTIONS` | 약결합 | maxDepth 등 스캔 파라미터 |
| `src/types/drift.ts` | `DriftItem`, `DriftResult`, `SyncPlan`, `SyncAction`, `DriftSeverity` | 중결합 | 프랙탈 규칙 위반 기반 이격 모델 |
| `src/types/report.ts` | `ScanReport`, `ValidationReport`, `DriftReport`, `AnalysisReport` | 중결합 | FractalTree를 포함하는 보고서 타입 |
| `src/types/hooks.ts` | `StructureGuardOutput`, `FractalContextSummary` | 약결합 | hook 출력용 프랙탈 컨텍스트 |

---

## 2. 코어 모듈 (프랙탈 로직)

### 프랙탈 구조 직접 구현 (강결합)

| 파일 | 역할 | 분리 가능성 |
|------|------|-------------|
| `src/core/fractal-tree.ts` | `buildFractalTree()`, `scanProject()`, `findNode()`, `getAncestors()`, `getDescendants()` | holon의 fractal-scanner로 대체 가능 |
| `src/core/organ-classifier.ts` | `classifyNode()`, `isOrganDirectory()`, `LEGACY_ORGAN_DIR_NAMES` | 구조 기반 분류 로직. zero-config 방식으로 전환 완료 |
| `src/core/rule-engine.ts` | `loadBuiltinRules()` (7개 내장 규칙), `evaluateRules()` | 프랙탈 구조 규칙을 직접 정의 |
| `src/core/fractal-validator.ts` | `validateStructure()`, `validateNode()`, `validateDependencies()`, `detectCycles()` | 프랙탈 트리 + 규칙 엔진 조합 |
| `src/core/drift-detector.ts` | `detectDrift()`, `generateSyncPlan()`, `compareCurrent()` | 규칙 위반 → 이격 항목 매핑 |
| `src/core/project-analyzer.ts` | `analyzeProject()` 파이프라인, `calculateHealthScore()`, `generateReport()` | scan → validate → drift → report 오케스트레이션 |
| `src/core/lca-calculator.ts` | `findLCA()`, `getModulePlacement()` | 프랙탈 트리에서 최소 공통 조상 계산 |
| `src/core/index-analyzer.ts` | `analyzeIndex()`, `extractModuleExports()` | barrel 패턴 분석 |
| `src/core/module-main-analyzer.ts` | `analyzeModule()`, `findEntryPoint()`, `extractPublicApi()` | 모듈 진입점 분석 |

### 간접 참조

| 파일 | 참조 내용 | 결합도 |
|------|-----------|--------|
| `src/core/dependency-graph.ts` | `DependencyEdge`, `DependencyDAG` import | 약결합 — DAG 알고리즘만 |

---

## 3. MCP 도구 (프랙탈 기능 노출)

| 파일 | 도구명 | 코어 의존 |
|------|--------|-----------|
| `src/mcp/tools/fractal-navigate.ts` | `fractal-navigate` | fractal-tree + organ-classifier |
| `src/mcp/tools/fractal-scan.ts` | `fractal-scan` | fractal-tree + module-main-analyzer |
| `src/mcp/tools/drift-detect.ts` | `drift-detect` | fractal-tree + fractal-validator + drift-detector |
| `src/mcp/tools/lca-resolve.ts` | `lca-resolve` | fractal-tree + lca-calculator |
| `src/mcp/tools/rule-query.ts` | `rule-query` | rule-engine + fractal-tree |
| `src/mcp/tools/structure-validate.ts` | `structure-validate` | fractal-tree + fractal-validator + rule-engine |
| `src/mcp/server.ts` | 9개 도구 라우터 | 위 6개 + ast-analyze, doc-compress, test-metrics |

---

## 4. Hook (프랙탈 컨텍스트 주입/검증)

| 파일 | 역할 | 프랙탈 참조 방식 |
|------|------|-----------------|
| `src/hooks/structure-guard.ts` | organ 내 CLAUDE.md 차단, organ 중첩 경고, 순환 import 경고 | `isOrganDirectory()` import |
| `src/hooks/context-injector.ts` | FCA-AI 규칙 + 프랙탈 구조 규칙 + 카테고리 분류 가이드 + 고위험 이격 주입 | `loadBuiltinRules()`, `scanProject()`, `validateStructure()`, `detectDrift()` import. 카테고리 가이드는 인라인 문자열 |
| `src/hooks/change-tracker.ts` | 파일 변경 시 카테고리 태그 부여 | `isOrganDirectory()` import |

---

## 5. 에이전트/스킬 (프랙탈 워크플로우)

| 파일 | 참조 내용 |
|------|-----------|
| `agents/fractal-architect.md` | 프랙탈 구조 설계 자문 (opus, read-only) |
| `agents/restructurer.md` | 프랙탈 구조 재구성 실행 (sonnet, write) |
| `agents/drift-analyzer.md` | 이격 분석 전문 (sonnet, read-only) |
| `skills/guide/SKILL.md` | 프랙탈 구조 가이드 워크플로우 |
| `skills/restructure/SKILL.md` | 프랙탈 구조 재구성 워크플로우 |
| `skills/drift-sync/SKILL.md` | 이격 보정 워크플로우 |
| `skills/scan/SKILL.md` | `fractal-navigate(action: "tree")` 호출 |
| `skills/init/SKILL.md` | `fractal-navigate(action: "tree"/"classify")` 호출 |

---

## 6. 문서 (프랙탈 이론/규칙)

| 파일 | 참조 내용 |
|------|-----------|
| `.metadata/01-ARCHITECTURE.md` | FCA-AI 이론, 프랙탈 분리, Organ 격리, 상향식 파싱 |
| `.metadata/06-HOW-IT-WORKS.md` | Hook 파이프라인에서 프랙탈 구조 검증 흐름 |
| `.metadata/07-RULES-REFERENCE.md` | 분류 우선순위, NodeType 체계, ORGAN_DIR_NAMES 목록 |
| `README.md` | 프랙탈 아키텍처 개요 |

---

## 7. 결합도 분석

### 의존 관계 트리

```
types/fractal.ts (핵심 데이터 모델)
  ├── types/rules.ts (Rule, RuleContext)
  ├── types/drift.ts (DriftItem, SyncPlan)
  ├── types/report.ts (ScanReport, AnalysisReport)
  │
  ├── core/fractal-tree.ts ──→ organ-classifier.ts
  ├── core/rule-engine.ts (7개 내장 규칙)
  ├── core/fractal-validator.ts ──→ fractal-tree + rule-engine
  ├── core/drift-detector.ts ──→ fractal-validator
  ├── core/project-analyzer.ts ──→ 전체 파이프라인
  ├── core/lca-calculator.ts ──→ fractal-tree
  ├── core/index-analyzer.ts (독립)
  ├── core/module-main-analyzer.ts ──→ index-analyzer
  │
  ├── mcp/tools/ (6개 프랙탈 도구)
  ├── hooks/structure-guard.ts ──→ organ-classifier
  ├── hooks/context-injector.ts ──→ rule-engine + fractal-tree + validator + drift
  └── hooks/change-tracker.ts ──→ organ-classifier
```

### 결합 유형별 요약

| 결합 유형 | 파일 수 | 분리 난이도 |
|-----------|---------|-------------|
| **타입 의존** (fractal.ts 직접 import) | 12+ 모듈 | LOW — 타입 패키지 추출 가능 |
| **알고리즘 결합** (fractal-tree 사용) | 8 모듈 | MEDIUM — 핵심 로직 이동 필요 |
| **규칙 결합** (rule-engine 7개 규칙) | 4 모듈 | **HIGH** — 규칙 정의가 filid에 내장 |
| **분류 결합** (organ-classifier) | 3 모듈 | MEDIUM — 설정 기반 주입으로 전환 가능 |
| **파이프라인 결합** (project-analyzer) | 1 모듈 | MEDIUM — 오케스트레이터 분리 가능 |

---

## 8. 권장 방향

filid는 프랙탈 구조를 **정의하지 않고 참조만** 하는 것이 이상적이다.

### 현재 상태
- v2에서 프랙탈 구조 관리 기능이 filid에 **강결합**으로 통합되어 있음
- 7개 내장 규칙, 구조 스캔, 이격 감지, 보정 계획 생성이 모두 filid 내부에 존재
- zero-config 아키텍처로 설정 파일 의존성은 제거됨

### 분리 시나리오 (holon 통합 시)
1. `types/fractal.ts` → 공유 타입 패키지(`@lumy-pack/fractal-types`)로 추출
2. `core/fractal-tree.ts`, `core/organ-classifier.ts` → holon의 fractal-scanner가 대체
3. `core/rule-engine.ts` → holon의 규칙 엔진과 통합 또는 filid 전용 규칙만 유지
4. MCP 도구 6개 → holon MCP 서버로 이동, filid는 FCA-AI 전용 도구만 보유
5. hook의 프랙탈 참조 → holon API를 통한 간접 참조로 전환
6. 에이전트/스킬 → holon 플러그인으로 이동

### 현실적 접근
- **단기**: filid에 프랙탈 관리를 유지하되, "프랙탈 구조를 따름" 수준의 참조로 문서화
- **중기**: 타입 패키지 분리 → 코어 로직 분리 → hook 간접 참조 전환
- **장기**: holon이 프랙탈 구조 관리를 전담, filid는 FCA-AI 규칙 시행에 집중
