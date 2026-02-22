# core — 핵심 비즈니스 로직

## Purpose

FCA-AI 아키텍처의 핵심 알고리즘을 구현한다. 프랙탈 트리 구조 구축, 드리프트 감지, 규칙 평가, 프로젝트 분석, 의존성 그래프, LCA 계산 등 12개 모듈로 구성된다.

## Structure

| 파일 | 역할 |
|------|------|
| `fractal-tree.ts` | FractalTree 빌드 · 탐색 (`buildFractalTree`, `scanProject`) |
| `organ-classifier.ts` | 노드 타입 분류 (`classifyNode`, `isOrganDirectory`) |
| `drift-detector.ts` | 구조 드리프트 감지 + SyncPlan 생성 |
| `rule-engine.ts` | 7개 내장 규칙 평가 (`loadBuiltinRules`, `evaluateRules`) |
| `fractal-validator.ts` | 구조 유효성 검증 (`validateStructure`, `validateNode`) |
| `document-validator.ts` | CLAUDE.md/SPEC.md 100줄 + 3-tier 검증 |
| `project-analyzer.ts` | 프로젝트 건강도 분석 + 리포트 생성 |
| `dependency-graph.ts` | DAG 구축 · 위상 정렬 · 사이클 탐지 |
| `lca-calculator.ts` | Lowest Common Ancestor 계산 |
| `index-analyzer.ts` | index.ts export 분석 |
| `module-main-analyzer.ts` | 모듈 진입점 · 공개 API 추출 |
| `change-queue.ts` | 변경 이벤트 큐 (`ChangeQueue`) |

## Conventions

- 외부 I/O는 `fractal-tree.ts`(`scanProject`)와 `rule-engine.ts`(`loadBuiltinRules`)에만 허용
- 나머지 모듈은 순수 함수 지향 (입력 → 출력, 사이드 이펙트 없음)
- `classifyNode()`는 구조 기반 분류 우선 (이름 기반 `ORGAN_DIR_NAMES`는 deprecated)

## Boundaries

### Always do

- 새 규칙 추가 시 `rule-engine.ts`의 `loadBuiltinRules`에 등록
- `document-validator.ts`를 통해 CLAUDE.md/SPEC.md 100줄 제한 강제
- 공개 함수는 `src/index.ts`에 re-export

### Ask first

- 내장 규칙 임계값 변경 (LCOM4 ≥ 2, CC > 20, 500줄)
- `classifyNode` 우선순위 로직 변경

### Never do

- `mcp/`, `hooks/`, `ast/` 모듈 직접 import (상위 레이어가 core에 의존, 역방향 금지)
- `ChangeQueue`를 비동기 없이 블로킹 방식으로 사용
- `ORGAN_DIR_NAMES` 이름 기반 분류를 신규 코드에 사용

## Dependencies

- `../types/` — 전체 타입 정의
- `fast-glob` — `scanProject` 내 파일시스템 탐색
