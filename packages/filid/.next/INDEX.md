# AI 코드 리뷰 거버넌스 시스템 — 문서 인덱스

> filid 플러그인 확장: 다중 페르소나 합의체 기반 코드 리뷰 거버넌스

---

## 도메인별 문서 맵

| # | 파일 | 도메인 | 원본 | 줄 수 |
|---|------|--------|------|-------|
| 01 | [01-COMPONENTS.md](./01-COMPONENTS.md) | 기존 컴포넌트 영향 분석 + 신규 컴포넌트 | PLAN §1-2 | ~160 |
| 02 | [02-PHASES.md](./02-PHASES.md) | 구현 Phase 및 의존성 그래프 | PLAN §3-4 | ~305 |
| 03 | [03-ARCHITECTURE.md](./03-ARCHITECTURE.md) | 4-Layer 아키텍처 + 의장-위임 패턴 + 페르소나 매핑 | BLUEPRINT §1-2 | ~209 |
| 04 | [04-SKILL-INTERFACES.md](./04-SKILL-INTERFACES.md) | 3개 스킬 I/O 인터페이스 + 파일 구조 | BLUEPRINT §3, §10 | ~248 |
| 05 | [05-GOVERNANCE.md](./05-GOVERNANCE.md) | 상태 머신 전이 규칙 + 위원회 선출 규칙 | BLUEPRINT §4, §9 | ~112 |
| 06 | [06-MCP-TOOLS.md](./06-MCP-TOOLS.md) | Phase별 MCP Tool 사용 맵 + 신규 2개 Tool | BLUEPRINT §5 | ~42 |
| 07 | [07-DATA-STORAGE.md](./07-DATA-STORAGE.md) | 출력 포맷 스키마 + .filid/ 디렉토리 구조 | BLUEPRINT §6-7 | ~319 |
| 08 | [08-DEBT-SYSTEM.md](./08-DEBT-SYSTEM.md) | 기술 부채 관리 (가중치, 바이어스, 해소) | BLUEPRINT §8 | ~187 |
| 09 | [09-RISKS.md](./09-RISKS.md) | 리스크 및 완화 전략 | PLAN §5 | ~16 |

---

## 참조 문서 (원본 자료)

| 파일 | 설명 |
|------|------|
| [FCA-AI-code-review-report.md](./FCA-AI-code-review-report.md) | 개념적 기반 — FCA-AI 코드 리뷰 보고서 |
| [FCA-AI-code-review-detail.md](./FCA-AI-code-review-detail.md) | 페르소나 상세 연구 분석 |

## 통합 원본 (인덱스 전환됨)

| 파일 | 설명 |
|------|------|
| [PLAN.md](./PLAN.md) | 개발 계획 전체 (인덱스 + 전체 내용) |
| [BLUE-PRINT.md](./BLUE-PRINT.md) | 기술 청사진 전체 (인덱스 + 전체 내용) |

---

## 읽기 가이드

### 개요 파악 시
1. [01-COMPONENTS.md](./01-COMPONENTS.md) → 무엇을 만드는가
2. [03-ARCHITECTURE.md](./03-ARCHITECTURE.md) → 어떤 구조인가
3. [02-PHASES.md](./02-PHASES.md) → 어떤 순서로 만드는가

### 특정 도메인 심층 분석 시
- 스킬 설계 → [04-SKILL-INTERFACES.md](./04-SKILL-INTERFACES.md)
- 합의 규칙 → [05-GOVERNANCE.md](./05-GOVERNANCE.md)
- MCP Tool → [06-MCP-TOOLS.md](./06-MCP-TOOLS.md)
- 데이터 포맷 → [07-DATA-STORAGE.md](./07-DATA-STORAGE.md)
- 부채 시스템 → [08-DEBT-SYSTEM.md](./08-DEBT-SYSTEM.md)
- 리스크 → [09-RISKS.md](./09-RISKS.md)

### 도메인 간 교차 참조

```
01-COMPONENTS ──→ 03-ARCHITECTURE ──→ 04-SKILL-INTERFACES
      │                   │                    │
      ▼                   ▼                    ▼
06-MCP-TOOLS      05-GOVERNANCE        07-DATA-STORAGE
                        │                    │
                        ▼                    ▼
                  08-DEBT-SYSTEM       09-RISKS
```
