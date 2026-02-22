# .metadata — filid 플러그인 설계 문서 아카이브

> **목적**: 코드를 읽지 않아도 filid 플러그인의 전체상을 이해할 수 있는 역설계 문서 모음.
>
> FCA-AI (Fractal Context Architecture for AI Agents) 규칙 시행 플러그인의 구조, 설계 의도,
> 라이프사이클, 사용법, 비용 분석, 동작 메커니즘을 문서화한다.

---

## 문서 목록

| # | 문서 | 설명 |
|---|------|------|
| 01 | [ARCHITECTURE.md](./01-ARCHITECTURE.md) | 전체 구조 & 설계 철학 — FCA-AI 이론 매핑, 4계층 아키텍처, 디렉토리 구조, ADR |
| 02 | [BLUEPRINT.md](./02-BLUEPRINT.md) | 모듈별 기술 청사진 — 6개 도메인 30+ 모듈의 목적, 알고리즘, 입출력, 의존 관계 |
| 03 | [LIFECYCLE.md](./03-LIFECYCLE.md) | 라이프사이클 & 워크플로우 — 11개 스킬 기반, 에이전트 협업, Hook 타임라인, 거버넌스 파이프라인 |
| 04 | [USAGE.md](./04-USAGE.md) | 설치, 설정, 사용 방법 — 빌드, 설정 파일, 스킬/MCP/에이전트 사용법, 트러블슈팅 |
| 05 | [COST-ANALYSIS.md](./05-COST-ANALYSIS.md) | 운영 비용 & 성능 영향 — Hook 오버헤드, MCP 비용, 컨텍스트 토큰, 번들 크기 |
| 06 | [HOW-IT-WORKS.md](./06-HOW-IT-WORKS.md) | 내부 동작 메커니즘 — Hook 파이프라인, AST 엔진, 의사결정 트리, MCP 라우팅, 압축 |
| 07 | [RULES-REFERENCE.md](./07-RULES-REFERENCE.md) | FCA-AI 규칙 레퍼런스 — 전체 상수, 임계값, 규칙 매트릭스, 분류 우선순위 |
| 08 | [API-SURFACE.md](./08-API-SURFACE.md) | 전체 공개 API — 33 함수 + 30 타입 export, MCP 도구 스키마, 타입 정의 |

---

## 읽기 순서 가이드

### 처음 접하는 경우

1. **[01-ARCHITECTURE](./01-ARCHITECTURE.md)** — 전체 그림 파악
2. **[07-RULES-REFERENCE](./07-RULES-REFERENCE.md)** — FCA-AI 규칙 이해
3. **[03-LIFECYCLE](./03-LIFECYCLE.md)** — 실제 사용 흐름 이해
4. **[04-USAGE](./04-USAGE.md)** — 설치 및 사용

### 구현 이해가 필요한 경우

1. **[02-BLUEPRINT](./02-BLUEPRINT.md)** — 모듈별 상세
2. **[06-HOW-IT-WORKS](./06-HOW-IT-WORKS.md)** — 내부 동작
3. **[08-API-SURFACE](./08-API-SURFACE.md)** — API 레퍼런스

### 운영/최적화가 필요한 경우

1. **[05-COST-ANALYSIS](./05-COST-ANALYSIS.md)** — 성능 영향 분석

---

## 문서 갱신 규칙

| 변경 유형 | 갱신 필요 문서 |
|-----------|---------------|
| 새 모듈 추가 | 02-BLUEPRINT, 08-API-SURFACE |
| 상수/임계값 변경 | 07-RULES-REFERENCE |
| Hook 추가/수정 | 03-LIFECYCLE, 06-HOW-IT-WORKS, 05-COST-ANALYSIS |
| MCP 도구 추가/수정 | 04-USAGE, 06-HOW-IT-WORKS, 08-API-SURFACE |
| 스킬 추가/수정 | 03-LIFECYCLE, 04-USAGE |
| 에이전트 추가/수정 | 03-LIFECYCLE, 04-USAGE, 07-RULES-REFERENCE |
| 아키텍처 변경 | 01-ARCHITECTURE, 02-BLUEPRINT |
| 빌드/의존성 변경 | 04-USAGE, 05-COST-ANALYSIS |

---

## 플러그인 핵심 수치

| 항목 | 값 |
|------|-----|
| 소스 파일 | 43개 `.ts` (테스트 제외) |
| 타입/인터페이스 | 30개+ |
| 공개 함수/클래스 | 35개+ |
| MCP 도구 | 11개 (ast-analyze, fractal-navigate, doc-compress, test-metrics, fractal-scan, drift-detect, lca-resolve, rule-query, structure-validate, review-manage, debt-manage) |
| Hook 스크립트 | 5개 (pre-tool-validator, structure-guard, agent-enforcer, context-injector, change-tracker _(disabled)_) |
| 에이전트 | 6개 (fractal-architect, implementer, context-manager, qa-reviewer, drift-analyzer, restructurer) |
| 스킬 | 11개 (/init, /scan, /sync, /structure-review, /promote, /context-query, /code-review, /resolve-review, /re-validate, /guide, /restructure) |
| 번들 크기 | ~525KB (MCP 516KB + Hooks 8.5KB) |
