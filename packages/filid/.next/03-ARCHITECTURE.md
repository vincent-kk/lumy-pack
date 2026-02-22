# 아키텍처 및 페르소나 매핑

> 원본: BLUE-PRINT.md §1-2 | 관련: [01-COMPONENTS.md](./01-COMPONENTS.md), [04-SKILL-INTERFACES.md](./04-SKILL-INTERFACES.md)

---

## 1. 전체 아키텍처

### 1.1 기존 4-Layer + 거버넌스 프레임워크

```
+-----------------------------------------------------------------+
|                     Claude Code Runtime                          |
|                                                                   |
|  Layer 1: HOOKS (automatic, event-driven) — 변경 없음             |
|  +-----------------------------------------------------------+  |
|  | PreToolUse  → pre-tool-validator, structure-guard          |  |
|  | SubagentStart → agent-enforcer                            |  |
|  | UserPromptSubmit → context-injector                       |  |
|  +-----------------------------------------------------------+  |
|                                                                   |
|  Layer 2: MCP TOOLS (on-demand analysis) — 2개 신규 추가          |
|  +-----------------------------------------------------------+  |
|  | ast-analyze | fractal-navigate | doc-compress              |  |
|  | test-metrics | fractal-scan | drift-detect                 |  |
|  | lca-resolve | rule-query | structure-validate              |  |
|  | ★ review-manage | debt-manage               ← 신규        |  |
|  +-----------------------------------------------------------+  |
|                                                                   |
|  Layer 3: AGENTS (role-restricted) — 변경 없음                    |
|  +-----------------------------------------------------------+  |
|  | fractal-architect(RO) | implementer | context-manager      |  |
|  | qa-reviewer(RO) | drift-analyzer(RO) | restructurer        |  |
|  +-----------------------------------------------------------+  |
|                                                                   |
|  Layer 4: SKILLS (user-invoked) — 3개 신규 추가                   |
|  +-----------------------------------------------------------+  |
|  | /init | /scan | /sync | /structure-review | /promote       |  |
|  | /context-query | /guide | /restructure                     |  |
|  |                                                            |  |
|  | ★ /code-review | /resolve-review | /re-validate  ← 신규   |  |
|  +-----------------------------------------------------------+  |
|                                                                   |
|  ┄┄┄ Governance Framework (code-review 스킬 내부 프레임워크) ┄┄┄  |
|  +-----------------------------------------------------------+  |
|  | 의장 (Chairperson) — code-review 스킬의 root agent          |  |
|  |   ├── 위원회 선출 로직 (복잡도 기반)                          |  |
|  |   ├── 페르소나 프레임워크 (6개, 지연 로딩)                    |  |
|  |   ├── 상태 머신 (PROPOSAL→DEBATE→VETO/SYNTHESIS/ABSTAIN)    |  |
|  |   └── 부채 바이어스 주입                                     |  |
|  |                                                            |  |
|  | .filid/ 디렉토리 (리뷰 산출물 + 부채 관리)                    |  |
|  |   ├── review/<branch>/ — 리뷰 세션 파일                     |  |
|  |   └── debt/ — 누적 기술 부채 파일                            |  |
|  +-----------------------------------------------------------+  |
+-----------------------------------------------------------------+
```

### 1.2 실행 흐름 개요 — 의장-위임 패턴 (Chairperson Delegation Pattern)

code-review 스킬은 단일 SKILL.md가 모든 작업을 직접 수행하는 대신, **의장이 수집/검증을 위임하고 합의에만 집중**하는 위임 패턴을 채택한다. 이는 설계 문서에서 강조한 관심사의 분리(SoC) 원칙을 SKILL.md 자체에도 적용한 것이다.

#### 설계 근거: 단일 SKILL 과부하 방지

단일 SKILL.md가 git diff 분석, MCP tool 12개 호출, 페르소나 6개 로딩, 상태 머신 5라운드를 모두 처리하면 LLM 컨텍스트 윈도우에 과부하가 발생한다. 특히 MCP tool의 원시 출력 데이터가 윈도우를 점유한 상태에서 "정치적 합의"라는 고차원 추론을 수행해야 하므로, 추론 품질 저하가 불가피하다.

의장-위임 패턴은 Phase A/B의 컨텍스트를 subagent에 격리하여 의장의 윈도우를 합의 추론에 전용으로 확보한다.

| 항목                        | 단일 실행 (기존) | 의장-위임 (개선)                                           |
| --------------------------- | ---------------- | ---------------------------------------------------------- |
| 의장 윈도우에 git diff 원본 | 있음             | **없음** (Phase A에서 처리)                                |
| 의장 윈도우에 MCP 원시 출력 | 12개 누적        | **없음** (Phase B에서 처리)                                |
| 의장에게 전달되는 것        | 모든 것          | session.md(30줄) + verification.md(50줄) + 페르소나 + 부채 |
| HIGH 최악 케이스 추정       | 2,500줄+         | **~1,130줄**                                               |

```
사용자: /filid:code-review
         │
         ▼
   ┌─────────────────────────────────────────────────────┐
   │  SKILL.md (의장 = 오케스트레이터, ~120줄)             │
   │                                                     │
   │  1. 체크포인트 감지 (session.md / verification.md)    │
   │                                                     │
   │  2. [위임] Phase A: 분석 Agent (Task, haiku)          │
   │     ├── git diff 수집                                │
   │     ├── 프랙탈 경로 식별                              │
   │     ├── 복잡도 판정 + 위원회 선출                      │
   │     └── Write → session.md                           │
   │                                                     │
   │  3. [위임] Phase B: 검증 Agent (Task, sonnet)         │
   │     ├── Read session.md → 대상 확인                   │
   │     ├── MCP tool 호출 (기술 검증)                     │
   │     ├── 부채 현황 수집                                │
   │     └── Write → verification.md                      │
   │                                                     │
   │  4. [직접] Phase C: 합의 (의장 자신)                   │
   │     ├── Read session.md + verification.md             │
   │     ├── Read personas/<선출 위원>.md (지연 로딩)       │
   │     ├── Read state-machine.md (전이 규칙)             │
   │     ├── 상태 머신 실행 (정치적 합의)                   │
   │     └── Write → review-report.md + fix-requests.md   │
   └─────────────────────────────────────────────────────┘
         │
         ▼
사용자: /filid:resolve-review
         │
         ▼
   ┌─────────────────────────────────────────┐
   │  fix-requests.md 로딩                    │
   │  → Select List 제시                      │
   │  → 수용/거부 선택                         │
   │  → 소명(Justification) 수집              │
   │  → ADR 정제                              │
   │  → .filid/debt/ 부채 파일 생성            │
   │  → justifications.md 출력                │
   └─────────────────────────────────────────┘
         │
         ▼
사용자: /filid:re-validate
         │
         ▼
   ┌─────────────────────────────────────────┐
   │  Delta 추출 (수정된 코드 + 소명)          │
   │  → 경량 재검증                           │
   │  → PASS: re-validate.md 생성 (디렉토리 유지) │
   │  → FAIL: 미해소 항목 명시                 │
   └─────────────────────────────────────────┘
```

#### 체크포인트 재개 로직

의장은 실행 시 `.filid/review/<branch>/` 디렉토리의 중간 산출물을 확인하여 마지막 완료 Phase에서 이어간다:

```
1. git branch --show-current → 브랜치명 → `review-manage(normalize-branch)` 호출로 정규화
2. `review-manage(checkpoint)` MCP tool 호출로 Phase 상태 감지
3. 체크포인트 판정:
   - session.md 없음 → Phase A부터 시작
   - session.md 있고 verification.md 없음 → Phase B부터 시작
   - 둘 다 있고 review-report.md 없음 → Phase C 실행
   - 셋 다 있음 → "이미 리뷰가 완료되었습니다" 안내 (`--force` 옵션으로 강제 재시작 가능)
```

이 로직은 SKILL.md에 5줄 이내의 분기문으로 명시된다. 실패 시 해당 Phase만 재실행하면 된다.

---

## 2. 페르소나 → 컴포넌트 매핑 상세

### 2.1 매핑 테이블

| 페르소나            | 거버넌스 역할 | 기존 agent 재사용                | 실행 형태                 | 사용 MCP Tools                                                      |
| ------------------- | ------------- | -------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| 엔지니어링 아키텍트 | 입법부        | fractal-architect + qa-reviewer  | 의장이 MCP tool 직접 호출 | `ast-analyze`, `test-metrics`, `fractal-scan`, `structure-validate` |
| 지식 관리자         | 사법부        | context-manager + drift-analyzer | 의장이 MCP tool 직접 호출 | `doc-compress`, `drift-detect`, `fractal-navigate`, `rule-query`    |
| 운영/SRE            | 사법부        | — (신규 페르소나)                | SKILL.md 내장 프레임워크  | `ast-analyze` (dependency-graph)                                    |
| 비즈니스 드라이버   | 행정부        | — (신규 페르소나)                | SKILL.md 내장 프레임워크  | 없음 (순수 LLM 추론)                                                |
| 프로덕트 매니저     | 번역가        | — (신규 페르소나)                | SKILL.md 내장 프레임워크  | 없음 (순수 LLM 추론)                                                |
| 디자인/HCI          | 인본주의자    | — (신규 페르소나)                | SKILL.md 내장 프레임워크  | 없음 (순수 LLM 추론)                                                |

### 2.2 기존 agent 재사용 경계 분석

#### fractal-architect 재사용 범위

| 기존 기능               | code-review에서 재사용 | 방식                                           |
| ----------------------- | ---------------------- | ---------------------------------------------- |
| LCOM4 분석 → split 권고 | ✅                     | `ast-analyze(lcom4)` 직접 호출                 |
| CC 분석 → compress 권고 | ✅                     | `ast-analyze(cyclomatic-complexity)` 직접 호출 |
| 프랙탈 구조 스캔        | ✅                     | `fractal-scan` 직접 호출                       |
| 구조 규칙 검증          | ✅                     | `structure-validate` 직접 호출                 |
| SPEC.md 초안 작성       | ❌                     | code-review 범위 밖                            |
| 리스트럭처링 제안       | ❌                     | code-review 범위 밖                            |

#### qa-reviewer 재사용 범위

| 기존 기능               | code-review에서 재사용 | 방식                                |
| ----------------------- | ---------------------- | ----------------------------------- |
| 3+12 규칙 검증          | ✅                     | `test-metrics(check-312)` 직접 호출 |
| 테스트 카운트           | ✅                     | `test-metrics(count)` 직접 호출     |
| 의사결정 트리           | ✅                     | `test-metrics(decide)` 직접 호출    |
| CLAUDE.md 라인 수 검증  | ✅                     | 의장이 Read로 직접 확인             |
| 6-stage 파이프라인 전체 | ❌                     | structure-review 전용               |

#### context-manager 재사용 범위

| 기존 기능                | code-review에서 재사용 | 방식                                     |
| ------------------------ | ---------------------- | ---------------------------------------- |
| CLAUDE.md 무결성 검사    | ✅                     | 의장이 Read로 3-tier 구조 확인           |
| SPEC.md append-only 감지 | ✅                     | 의장이 Read로 직접 확인                  |
| 문서 압축 상태 검증      | ✅                     | `doc-compress(auto)` 직접 호출           |
| CLAUDE.md/SPEC.md 수정   | ❌                     | code-review는 수정 안 함 (리포트만 출력) |

#### drift-analyzer 재사용 범위

| 기존 기능            | code-review에서 재사용 | 방식                     |
| -------------------- | ---------------------- | ------------------------ |
| 구조 드리프트 감지   | ✅                     | `drift-detect` 직접 호출 |
| 드리프트 심각도 분류 | ✅                     | 의장이 결과 해석         |
| 교정 계획 생성       | ❌                     | code-review 범위 밖      |

### 2.3 신규 페르소나 설계 원칙

신규 4개 페르소나(운영/SRE, 비즈니스 드라이버, 프로덕트 매니저, 디자인/HCI)는 다음 원칙으로 설계:

1. **도구 독립성**: Write/Edit/Bash 접근 없이 순수 LLM 추론으로 동작
2. **지연 로딩**: 선출된 페르소나의 프레임워크만 로딩 (Read로 파일 읽기)
3. **코드 리뷰 전용**: 범용 agent가 아닌 거버넌스 맥락에서만 활성화
4. **중복 배제**: 기존 agent의 기술 검증을 참조하되 재정의하지 않음
