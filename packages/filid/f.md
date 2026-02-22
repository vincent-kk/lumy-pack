# filid 프랙탈 구조 참조 맵

> filid 내에서 프랙탈 구조를 참조하는 모든 위치를 정리한 문서.
> 프랙탈 구조의 구체적 정의/설정은 이 문서에 포함하지 않으며, 참조 위치와 역할만 기술한다.
> 프랙탈 구조 관리는 별도 플러그인(holon) 또는 통합 모듈이 담당한다.

---

## 1. 소스코드 내 프랙탈 참조

### 핵심 정의 (이동/통합 대상)

| 파일 | 참조 내용 | 비고 |
|------|-----------|------|
| `src/types/fractal.ts` | `NodeType`, `FractalNode`, `FractalTree`, `DependencyEdge`, `DependencyDAG` 타입 정의 | 프랙탈 구조의 데이터 모델. holon 통합 시 CategoryType(4종)으로 확장 필요 |
| `src/core/fractal-tree.ts` | `buildFractalTree()`, `findNode()`, `getAncestors()`, `getDescendants()` 알고리즘 | 프랙탈 트리 구축/탐색. holon의 fractal-scanner로 대체 가능 |
| `src/core/organ-classifier.ts` | `ORGAN_DIR_NAMES` (9개 하드코딩), `isOrganDirectory()`, `classifyNode()` 분류 규칙 | 프랙탈 구조 분류의 핵심. 설정 기반 주입으로 전환 권장 |

### 직접 참조

| 파일 | 참조 내용 | 참조 방식 |
|------|-----------|-----------|
| `src/mcp/tools/fractal-navigate.ts` | `buildFractalTree`, `findNode`, `classifyNode` import | fractal-tree + organ-classifier 래핑 |
| `src/hooks/organ-guard.ts` | `isOrganDirectory` import | organ 디렉토리 내 CLAUDE.md 차단에 사용 |
| `src/core/dependency-graph.ts` | `DependencyEdge`, `DependencyDAG` import | DAG 구축/순환 감지에 프랙탈 타입 사용 |
| `src/index.ts` | 모든 프랙탈 모듈 re-export | 공개 API 표면 |

### 인라인 참조 (import 없이 하드코딩)

| 파일 | 참조 내용 | 문제점 |
|------|-----------|--------|
| `src/hooks/context-injector.ts:21` | `"Organ directories (components, utils, types, hooks, helpers, lib, styles, assets, constants)"` 문자열 | `ORGAN_DIR_NAMES`를 import하지 않고 인라인으로 나열. 이중 하드코딩 |

### 텍스트 참조 (코드 동작에 무관)

| 파일 | 참조 내용 |
|------|-----------|
| `src/metrics/decision-tree.ts:45` | `"Extract into sub-fractals along component boundaries."` — split 액션 설명 텍스트 |

---

## 2. 문서/스킬 내 프랙탈 참조

| 파일 | 참조 내용 | 참조 유형 |
|------|-----------|-----------|
| `.metadata/01-ARCHITECTURE.md` | FCA-AI 이론(프랙탈 분리, Organ 격리, 상향식 파싱), 이론→구현 매핑 테이블 | 설계 문서 |
| `.metadata/06-HOW-IT-WORKS.md` | Hook 파이프라인에서 프랙탈 구조 검증 흐름, MCP 도구 라우팅 | 동작 설명 |
| `.metadata/07-RULES-REFERENCE.md` | `ORGAN_DIR_NAMES` 전체 목록, 분류 우선순위 알고리즘, NodeType 분류 체계 | 규칙 레퍼런스 |
| `skills/init/SKILL.md` | `fractal-navigate(action: "tree")`, `fractal-navigate(action: "classify")` 호출 | 스킬 워크플로우 |
| `skills/scan/SKILL.md` | `fractal-navigate(action: "tree")` 호출, 프랙탈 규칙 스캔 | 스킬 워크플로우 |
| `README.md` | 프랙탈 아키텍처 개요, 4계층 구조 설명 | 사용자 문서 |

---

## 3. 결합도 요약

### 프랙탈 구조에 대한 filid의 의존 관계

```
types/fractal.ts (핵심 정의)
    ├── core/fractal-tree.ts (직접 의존)
    ├── core/organ-classifier.ts (직접 의존)
    ├── core/dependency-graph.ts (직접 의존)
    ├── mcp/tools/fractal-navigate.ts (간접: fractal-tree + organ-classifier)
    ├── hooks/organ-guard.ts (간접: organ-classifier)
    └── hooks/context-injector.ts (인라인: organ 목록 하드코딩)
```

### 결합 유형별 분류

| 결합 유형 | 대상 | 분리 난이도 |
|-----------|------|-------------|
| 타입 결합 | `fractal.ts` → 6개 모듈 | LOW — 인터페이스 패키지 추출 가능 |
| 알고리즘 결합 | `fractal-tree.ts` → `fractal-navigate.ts` | LOW — 모듈 이동으로 해결 |
| 규칙 결합 | `organ-classifier.ts` → `organ-guard.ts`, `context-injector.ts` | MEDIUM — 설정 기반 주입 필요 |
| 하드코딩 결합 | `context-injector.ts` 인라인 organ 목록 | MEDIUM — config-loader 도입 필요 |
| 의미적 결합 | `decision-tree.ts` "sub-fractals" 텍스트 | LOW — 텍스트만 변경 |

---

## 4. 권장 방향

filid는 프랙탈 구조를 **정의하지 않고 참조만** 하는 것이 이상적이다.

- `types/fractal.ts`, `core/fractal-tree.ts`, `core/organ-classifier.ts`는 프랙탈 구조 관리 모듈로 이동하거나 통합
- `ORGAN_DIR_NAMES` 하드코딩은 설정 파일(.holonrc.yml) 기반 외부 주입으로 전환
- `context-injector.ts`의 인라인 organ 목록은 `ORGAN_DIR_NAMES` import 또는 config-loader 참조로 교체
- `fractal-navigate` MCP 도구는 구조 관리 도구(fractal-scan)와 통합
- 프랙탈 구조 분류 규칙은 "프랙탈 구조를 따름" 수준의 참조로 유지하고, 구체적 분류 로직은 위임
