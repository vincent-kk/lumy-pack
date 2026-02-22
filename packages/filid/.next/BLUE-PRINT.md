# AI 코드 리뷰 거버넌스 시스템 — 기술 청사진

> filid 플러그인 확장: 다중 페르소나 합의체 기반 코드 리뷰 거버넌스의 기술 설계

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
|  Layer 2: MCP TOOLS (on-demand analysis) — 변경 없음              |
|  +-----------------------------------------------------------+  |
|  | ast-analyze | fractal-navigate | doc-compress              |  |
|  | test-metrics | fractal-scan | drift-detect                 |  |
|  | lca-resolve | rule-query | structure-validate              |  |
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

| 항목 | 단일 실행 (기존) | 의장-위임 (개선) |
|------|------------------|------------------|
| 의장 윈도우에 git diff 원본 | 있음 | **없음** (Phase A에서 처리) |
| 의장 윈도우에 MCP 원시 출력 | 12개 누적 | **없음** (Phase B에서 처리) |
| 의장에게 전달되는 것 | 모든 것 | session.md(30줄) + verification.md(50줄) + 페르소나 + 부채 |
| HIGH 최악 케이스 추정 | 2,500줄+ | **~1,130줄** |

```
사용자: /filid:code-review
         │
         ▼
   ┌─────────────────────────────────────────────────────┐
   │  SKILL.md (의장 = 오케스트레이터, ~80줄)              │
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
   │  → PASS: 리뷰 디렉토리 정리               │
   │  → FAIL: 미해소 항목 명시                 │
   └─────────────────────────────────────────┘
```

#### 체크포인트 재개 로직

의장은 실행 시 `.filid/review/<branch>/` 디렉토리의 중간 산출물을 확인하여 마지막 완료 Phase에서 이어간다:

```
1. git branch --show-current → 브랜치명 → 정규화
2. .filid/review/<branch>/ 디렉토리 탐색
3. 체크포인트 판정:
   - session.md 없음 → Phase A부터 시작
   - session.md 있고 verification.md 없음 → Phase B부터 시작
   - 둘 다 있고 review-report.md 없음 → Phase C 실행
   - 셋 다 있음 → "이미 리뷰가 완료되었습니다" 안내
```

이 로직은 SKILL.md에 5줄 이내의 분기문으로 명시된다. 실패 시 해당 Phase만 재실행하면 된다.

---

## 2. 페르소나 → 컴포넌트 매핑 상세

### 2.1 매핑 테이블

| 페르소나 | 거버넌스 역할 | 기존 agent 재사용 | 실행 형태 | 사용 MCP Tools |
|---|---|---|---|---|
| 엔지니어링 아키텍트 | 입법부 | fractal-architect + qa-reviewer | 의장이 MCP tool 직접 호출 | `ast-analyze`, `test-metrics`, `fractal-scan`, `structure-validate` |
| 지식 관리자 | 사법부 | context-manager + drift-analyzer | 의장이 MCP tool 직접 호출 | `doc-compress`, `drift-detect`, `fractal-navigate`, `rule-query` |
| 운영/SRE | 사법부 | — (신규 페르소나) | SKILL.md 내장 프레임워크 | `ast-analyze` (dependency-graph) |
| 비즈니스 드라이버 | 행정부 | — (신규 페르소나) | SKILL.md 내장 프레임워크 | 없음 (순수 LLM 추론) |
| 프로덕트 매니저 | 번역가 | — (신규 페르소나) | SKILL.md 내장 프레임워크 | 없음 (순수 LLM 추론) |
| 디자인/HCI | 인본주의자 | — (신규 페르소나) | SKILL.md 내장 프레임워크 | 없음 (순수 LLM 추론) |

### 2.2 기존 agent 재사용 경계 분석

#### fractal-architect 재사용 범위

| 기존 기능 | code-review에서 재사용 | 방식 |
|---|---|---|
| LCOM4 분석 → split 권고 | ✅ | `ast-analyze(lcom4)` 직접 호출 |
| CC 분석 → compress 권고 | ✅ | `ast-analyze(cyclomatic-complexity)` 직접 호출 |
| 프랙탈 구조 스캔 | ✅ | `fractal-scan` 직접 호출 |
| 구조 규칙 검증 | ✅ | `structure-validate` 직접 호출 |
| SPEC.md 초안 작성 | ❌ | code-review 범위 밖 |
| 리스트럭처링 제안 | ❌ | code-review 범위 밖 |

#### qa-reviewer 재사용 범위

| 기존 기능 | code-review에서 재사용 | 방식 |
|---|---|---|
| 3+12 규칙 검증 | ✅ | `test-metrics(check-312)` 직접 호출 |
| 테스트 카운트 | ✅ | `test-metrics(count)` 직접 호출 |
| 의사결정 트리 | ✅ | `test-metrics(decide)` 직접 호출 |
| CLAUDE.md 라인 수 검증 | ✅ | 의장이 Read로 직접 확인 |
| 6-stage 파이프라인 전체 | ❌ | structure-review 전용 |

#### context-manager 재사용 범위

| 기존 기능 | code-review에서 재사용 | 방식 |
|---|---|---|
| CLAUDE.md 무결성 검사 | ✅ | 의장이 Read로 3-tier 구조 확인 |
| SPEC.md append-only 감지 | ✅ | 의장이 Read로 직접 확인 |
| 문서 압축 상태 검증 | ✅ | `doc-compress(auto)` 직접 호출 |
| CLAUDE.md/SPEC.md 수정 | ❌ | code-review는 수정 안 함 (리포트만 출력) |

#### drift-analyzer 재사용 범위

| 기존 기능 | code-review에서 재사용 | 방식 |
|---|---|---|
| 구조 드리프트 감지 | ✅ | `drift-detect` 직접 호출 |
| 드리프트 심각도 분류 | ✅ | 의장이 결과 해석 |
| 교정 계획 생성 | ❌ | code-review 범위 밖 |

### 2.3 신규 페르소나 설계 원칙

신규 4개 페르소나(운영/SRE, 비즈니스 드라이버, 프로덕트 매니저, 디자인/HCI)는 다음 원칙으로 설계:

1. **도구 독립성**: Write/Edit/Bash 접근 없이 순수 LLM 추론으로 동작
2. **지연 로딩**: 선출된 페르소나의 프레임워크만 로딩 (Read로 파일 읽기)
3. **코드 리뷰 전용**: 범용 agent가 아닌 거버넌스 맥락에서만 활성화
4. **중복 배제**: 기존 agent의 기술 검증을 참조하되 재정의하지 않음

---

## 3. 3개 스킬 입출력 인터페이스 명세

### 3.1 `/filid:code-review`

#### 호출 인터페이스

```
/filid:code-review [--scope=branch|pr|commit] [--base=<ref>] [--verbose]
```

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `--scope` | `branch\|pr\|commit` | `branch` | 리뷰 범위 |
| `--base` | string | merge-base 자동 감지 | 비교 기준 ref |
| `--verbose` | flag | off | 위원회 토론 과정 상세 출력 |

#### 입력

| 입력 소스 | 수집 방법 | 용도 |
|---|---|---|
| git diff | `git diff <base>..HEAD` (Bash) | 변경 파일/내용 분석 |
| 현재 브랜치 이름 | `git branch --show-current` (Bash) | .filid/ 디렉토리 식별 |
| PR 메타데이터 (scope=pr 시) | `gh pr view` (Bash) | 의도 맥락 정보 |
| 기존 부채 목록 | `.filid/debt/*.md` (Read) | 위원회 바이어스 |
| 프랙탈 구조 | `fractal-scan` (MCP) | 구조 분석 |
| 코드 메트릭 | `ast-analyze`, `test-metrics` (MCP) | 기술 검증 |

#### 출력

| 출력 파일 | 경로 | 내용 |
|---|---|---|
| 리뷰 보고서 | `.filid/review/<branch>/review-report.md` | 합의 과정, 페르소나 의견, 기술 지표, 전체 판정 |
| 수정 요청 사항 | `.filid/review/<branch>/fix-requests.md` | 조치 필요 항목 리스트 (코드 패치 포함) |

#### 내부 워크플로우 — 의장-위임 패턴

```
Phase A: 분석 및 위원회 선출 (위임 → Task agent, haiku)
  A.1 git diff 수집 (Bash)
  A.2 변경 파일의 프랙탈 경로 식별 (fractal-navigate)
  A.3 복잡도 판정 (변경 파일 수, 프랙탈 수, 인터페이스 변경 여부)
  A.4 위원회 선출 (복잡도 기반 + 적대적 짝짓기)
  A.5 session.md 출력 (Write)

Phase B: 기술 검증 (위임 → Task agent, sonnet)
  B.1 session.md 로딩 (Read) → 대상 파일/모듈 확인
  B.2 ast-analyze(lcom4) — 선출된 경우만
  B.3 ast-analyze(cyclomatic-complexity) — 선출된 경우만
  B.4 test-metrics(check-312) — 항상
  B.5 structure-validate — 항상
  B.6 drift-detect — 선출된 경우만
  B.7 ast-analyze(dependency-graph) — 항상
  B.8 ast-analyze(tree-diff) — 항상
  B.9 .filid/debt/ 기존 부채 로딩 + 바이어스 수준 판정
  B.10 verification.md 출력 (Write)

Phase C: 정치적 합의 (의장 직접 실행)
  C.1 session.md + verification.md 로딩 (Read)
  C.2 선출된 페르소나 프레임워크 지연 로딩 (Read, 2~6개)
  C.3 state-machine.md 로딩 (Read)
  C.4 PROPOSAL: 기술 검증 결과를 바탕으로 각 페르소나가 의견 개진
  C.5 DEBATE: 상충하는 의견 간 논쟁 및 타협 시도
  C.6 VETO/SYNTHESIS/ABSTAIN: 최종 상태 결정
  C.7 리뷰 보고서 + 수정 요청 사항 파일 출력 (Write)
```

> **설계 결정**: Phase A/B를 subagent에 위임함으로써 git diff 원본과 MCP tool 원시 출력이 의장의 컨텍스트 윈도우에 누적되지 않는다. 의장(Phase C)은 정제된 중간 산출물(session.md, verification.md)만 Read하여 합의 추론에 집중한다.

---

### 3.2 `/filid:resolve-review`

#### 호출 인터페이스

```
/filid:resolve-review
```

매개변수 없음. 현재 브랜치 자동 감지.

#### 입력

| 입력 소스 | 수집 방법 | 용도 |
|---|---|---|
| 현재 브랜치 이름 | `git branch --show-current` (Bash) | .filid/ 디렉토리 식별 |
| 수정 요청 사항 | `.filid/review/<branch>/fix-requests.md` (Read) | Select List 구성 |

#### 출력

| 출력 파일 | 경로 | 내용 |
|---|---|---|
| 소명 기록 | `.filid/review/<branch>/justifications.md` | 거부 항목 + 소명 + 정제된 ADR |
| 부채 파일 (N개) | `.filid/debt/<fractal-path>-<hash>.md` | 개별 부채 항목 |

#### 내부 워크플로우

```
1. 현재 브랜치 감지 → .filid/review/<branch>/ 탐색
2. fix-requests.md 파싱 → 수정 항목 목록 추출
3. AskUserQuestion으로 Select List 제시
   - 각 항목에 대해 수용(✅) / 거부(❌) 선택
4. 수용된 항목:
   - 자동 수정 코드 패치 적용 안내 (직접 적용 또는 수동 적용)
5. 거부된 항목:
   - 각 항목에 대해 AskUserQuestion으로 소명 텍스트 수집
   - 소명 → ADR 정제 (지식 관리자 페르소나 프레임워크 활용)
   - .filid/debt/ 하위에 부채 파일 생성
6. justifications.md 출력
```

---

### 3.3 `/filid:re-validate`

#### 호출 인터페이스

```
/filid:re-validate
```

매개변수 없음. 현재 브랜치 자동 감지.

#### 입력

| 입력 소스 | 수집 방법 | 용도 |
|---|---|---|
| 현재 브랜치 이름 | `git branch --show-current` (Bash) | .filid/ 디렉토리 식별 |
| 리뷰 보고서 | `.filid/review/<branch>/review-report.md` (Read) | 원래 지적 사항 참조 |
| 수정 요청 사항 | `.filid/review/<branch>/fix-requests.md` (Read) | 원래 수정 요청 참조 |
| 소명 기록 | `.filid/review/<branch>/justifications.md` (Read) | 소명 내용 참조 |
| 코드 변경분 | `git diff` (Bash) + `ast-analyze(tree-diff)` (MCP) | Delta 추출 |

#### 출력

| 출력 파일 | 경로 | 내용 |
|---|---|---|
| 재검증 결과 | `.filid/review/<branch>/re-validate.md` | PASS/FAIL + 상세 판정 |

#### 내부 워크플로우

```
1. 현재 브랜치 감지 → .filid/review/<branch>/ 탐색
2. 기존 리뷰 파일 로딩 (review-report, fix-requests, justifications)
3. 코드 변경분(Delta) 추출
   - resolve-review 이후 추가된 커밋 대상
   - ast-analyze(tree-diff)로 의미론적 변경 분석
4. 경량 재검증
   - 수용된 수정 사항이 원래 지적을 해소했는지 확인
   - 소명이 시스템 헌법에 치명적으로 위배되지 않는지 확인
   - 신규 위반 사항 도입 여부 확인
5. 부채 해소 판정
   - 수정 사항 중 기존 .filid/debt/ 항목을 해소하는 것이 있는지 확인
   - 해소된 부채 파일 삭제
6. 최종 판정
   - PASS: re-validate.md 생성 (리뷰 디렉토리는 유지 — PR 머지 후 수동 정리)
   - FAIL: re-validate.md에 미해소 항목 명시
```

---

## 4. 상태 머신 전이 규칙

### 4.1 상태 정의

```
┌──────────┐     ┌────────┐     ┌──────────────────────┐
│ PROPOSAL │────→│ DEBATE │────→│ VETO / SYNTHESIS /   │
│          │     │        │     │ ABSTAIN              │
└──────────┘     └────────┘     └──────────────────────┘
                      │                    │
                      │     ┌──────────────┤
                      │     │              │
                      ▼     ▼              ▼
                 ┌─────────────┐    ┌───────────┐
                 │ PROPOSAL    │    │ CONCLUSION │
                 │ (재제출)     │    │ (종료)      │
                 └─────────────┘    └───────────┘
```

### 4.2 상태 전이 규칙

| 현재 상태 | 전이 조건 | 다음 상태 | 설명 |
|---|---|---|---|
| **PROPOSAL** | 의장이 코드를 상정 | DEBATE | 기술 검증 결과를 바탕으로 페르소나들이 의견 개진 시작 |
| **DEBATE** | 치명적 결함 발견 (FCA-AI 규칙 초과, 하드코딩 시크릿 등) | VETO | 운영/지식 관리자가 절대적 거부권 행사 |
| **DEBATE** | 합의 도달 (파레토 최적 타협점) | SYNTHESIS | 의장이 타협안을 종합하여 최종 합의안 선언 |
| **DEBATE** | 특정 페르소나의 확신도 임계값 미달 | ABSTAIN | 해당 페르소나가 기권 선언 |
| **VETO** | 발의자가 코드 수정 후 재제출 | PROPOSAL | 수정된 코드로 새 라운드 시작 |
| **VETO** | 비즈니스 드라이버가 CoD 근거 타협안 제시 | DEBATE | 타협 조건 하에 논쟁 재개 |
| **VETO** | 해소 불가능 | CONCLUSION | 리뷰 FAIL로 종료 |
| **SYNTHESIS** | — | CONCLUSION | 합의안 확정, 리뷰 보고서 출력 |
| **ABSTAIN** | 1명 이상 기권 | 아래 정족수 규칙 참조 | 정족수에 따라 CONCLUSION 또는 DEBATE 재진입 |

### 4.3 정족수(Quorum) 규칙

혼합 결과(일부 SYNTHESIS + 일부 ABSTAIN) 처리를 위한 결정론적 규칙:

| 상황 | 판정 | 설명 |
|---|---|---|
| 선출 위원의 ≥ 2/3가 SYNTHESIS | CONCLUSION (APPROVED/REQUEST_CHANGES) | 다수 합의 성립. 기권자는 정족수 분모에서 제외. |
| VETO 1건 이상 발생 | VETO (비즈니스 타협 시도 가능) | 단일 VETO가 SYNTHESIS를 무효화. |
| SYNTHESIS < 2/3, VETO 없음 | CONCLUSION (INCONCLUSIVE) | 합의 미도달, 인간 에스컬레이션 권고. |

**정족수 계산 예시**:
- 위원 4명: SYNTHESIS 3 + ABSTAIN 1 → 유효 위원 3명, SYNTHESIS 3/3 = 100% ≥ 2/3 → **CONCLUSION**
- 위원 6명: SYNTHESIS 3 + ABSTAIN 2 + VETO 1 → VETO 존재 → **VETO**
- 위원 4명: SYNTHESIS 1 + ABSTAIN 3 → 유효 위원 1명, SYNTHESIS 1/1 = 100% ≥ 2/3 → **CONCLUSION** (단, 기권 과반 경고 추가)

### 4.4 상태 추적 형식

의장은 상태 전이를 리뷰 보고서에 명시적으로 기록한다:

```markdown
## 합의 과정 (Deliberation Log)

### Round 1
- **상태**: PROPOSAL
- **상정**: 엔지니어링 아키텍트 — "LCOM4=3, split 필요"
- **전이**: PROPOSAL → DEBATE

### Round 2
- **상태**: DEBATE
- **비즈니스 드라이버**: "split 작업은 2일 소요, CoD=$X. 다음 스프린트로 연기 제안"
- **엔지니어링 아키텍트**: "LCOM4=3은 구조적 결함. 즉시 수정 필수"
- **의장 중재**: "부분 분할 타협안 — 핵심 로직만 분리, 나머지는 부채로 기록"
- **전이**: DEBATE → SYNTHESIS

### Round 3
- **상태**: SYNTHESIS
- **합의안**: "validator 모듈을 tokenValidator + inputValidator로 분할. 나머지 리팩토링은 기술 부채로 발행."
- **전이**: SYNTHESIS → CONCLUSION
```

### 4.5 루프 제한

- 최대 라운드 수: **5회**
- 5회 내 합의 미도달 시: CONCLUSION (INCONCLUSIVE) → 인간 에스컬레이션
- 이유: 무한 루프 방지 + LLM 컨텍스트 절약

---

## 5. 기존 MCP Tool 재사용 지점

### 5.1 Phase별 MCP Tool 사용 맵

의장-위임 패턴에 따라, Phase A/B의 MCP tool 호출은 **검증 Agent(Phase B subagent)**가 수행한다. 의장(Phase C)은 MCP tool을 직접 호출하지 않으며, verification.md에 정리된 결과만 Read한다.

| Phase | 실행 주체 | MCP Tool | 호출 시점 | 목적 |
|---|---|---|---|---|
| Phase A (분석) | 분석 Agent | `fractal-navigate(classify)` | 변경된 디렉토리에 대해 | fractal/organ 분류 확인 |
| Phase A | 분석 Agent | `fractal-scan` | 프로젝트 루트에 대해 | 전체 프랙탈 트리 구축 |
| Phase B (검증) | 검증 Agent | `ast-analyze(lcom4)` | 변경된 클래스/모듈에 대해 | 응집도 검증 (split 필요 여부) |
| Phase B | 검증 Agent | `ast-analyze(cyclomatic-complexity)` | 변경된 함수에 대해 | 복잡도 검증 (compress 필요 여부) |
| Phase B | 검증 Agent | `ast-analyze(dependency-graph)` | 변경된 모듈에 대해 | 순환 의존성 검증 |
| Phase B | 검증 Agent | `ast-analyze(tree-diff)` | 변경 전후 코드에 대해 | 의미론적 변경 분석 |
| Phase B | 검증 Agent | `test-metrics(check-312)` | 변경된 spec.ts에 대해 | 3+12 규칙 위반 검증 |
| Phase B | 검증 Agent | `test-metrics(count)` | 변경된 test/spec에 대해 | 테스트 케이스 수 확인 |
| Phase B | 검증 Agent | `test-metrics(decide)` | 임계값 초과 모듈에 대해 | split/compress/parameterize 결정 |
| Phase B | 검증 Agent | `structure-validate` | 변경된 모듈에 대해 | FCA-AI 구조 규칙 검증 |
| Phase B | 검증 Agent | `drift-detect` | 변경된 경로에 대해 | 구조 드리프트 감지 |
| Phase B | 검증 Agent | `doc-compress(auto)` | CLAUDE.md 검증 시 | 문서 압축 상태 검증 |
| Phase B | 검증 Agent | `rule-query(list)` | 리뷰 시작 시 | 활성 규칙 목록 로딩 |
| Phase C (합의) | 의장 | — | — | MCP tool 직접 호출 없음. verification.md를 Read하여 결과 참조 |
| re-validate | 스킬 직접 | `ast-analyze(tree-diff)` | resolve 후 변경분에 대해 | Delta 기반 의미론적 변경 분석 |

### 5.2 신규 MCP Tool 필요 여부: **불필요**

모든 결정론적 검증은 기존 9개 MCP tool로 커버된다. 정치적 합의와 페르소나 추론은 LLM이 담당하므로 tool이 아닌 프롬프트로 해결한다.

---

## 6. 리뷰 보고서 / 수정 요청 사항 출력 포맷

### 6.1 리뷰 보고서 (`review-report.md`)

```markdown
# Code Review Report — <branch name>

**Date**: <ISO 8601>
**Scope**: <branch|pr|commit>
**Base**: <base ref>
**Verdict**: APPROVED | REQUEST_CHANGES | INCONCLUSIVE

## 위원회 구성

| 페르소나 | 선출 근거 | 최종 입장 |
|---|---|---|
| 엔지니어링 아키텍트 | LCOM4 검증 필요 (클래스 변경 감지) | SYNTHESIS |
| 지식 관리자 | CLAUDE.md 변경 감지 | SYNTHESIS |
| 비즈니스 드라이버 | 기능 추가 PR | SYNTHESIS |
| 운영/SRE | 보안 관련 코드 변경 | VETO → SYNTHESIS |

## 기술 검증 결과

### FCA-AI 구조 검증
| 검증 항목 | 결과 | 상세 |
|---|---|---|
| 프랙탈 경계 | PASS | 모든 변경이 올바른 프랙탈 내 |
| CLAUDE.md 규정 | WARN | src/auth/CLAUDE.md — 95줄 (한도 100줄) |
| 3+12 규칙 | FAIL | src/auth/auth.spec.ts — 18 케이스 (한도 15) |
| LCOM4 | FAIL | src/auth/validator.ts — LCOM4=3 (한도 2) |
| CC | PASS | 최대 CC=12 (한도 15) |
| 순환 의존성 | PASS | 사이클 없음 |
| 구조 드리프트 | PASS | 드리프트 없음 |

### 부채 현황
| 기존 부채 수 | 이번 PR 관련 부채 | 가중치 합계 |
|---|---|---|
| 3건 | 1건 (src/auth 관련, 가중치 2) | 5.0 |

## 합의 과정 (Deliberation Log)

### Round 1 — PROPOSAL
[상세 기록...]

### Round 2 — DEBATE
[상세 기록...]

### Round N — CONCLUSION
[최종 합의안...]

## 최종 판정

**REQUEST_CHANGES** — 2건의 수정 요청 사항이 발생함.
수정 요청 사항은 `fix-requests.md`를 참조.
```

### 6.2 수정 요청 사항 (`fix-requests.md`)

```markdown
# Fix Requests — <branch name>

**Generated**: <ISO 8601>
**Total Items**: N

---

## FIX-001: spec.ts 3+12 규칙 위반

- **Severity**: HIGH
- **Path**: `src/auth/auth.spec.ts`
- **Rule**: 3+12 규칙 (최대 15 케이스)
- **Current**: 18 케이스
- **Raised by**: 엔지니어링 아키텍트
- **Recommended Action**: auth-happy.spec.ts + auth-edge.spec.ts로 분할
- **Code Patch**:
  ```typescript
  // 제안된 분할 구조
  // auth-happy.spec.ts: 기본 동작 3건
  // auth-edge.spec.ts: 엣지 케이스 12건 이하
  ```

---

## FIX-002: LCOM4 임계값 초과

- **Severity**: HIGH
- **Path**: `src/auth/validator.ts`
- **Rule**: LCOM4 < 2
- **Current**: LCOM4 = 3
- **Raised by**: 엔지니어링 아키텍트
- **Recommended Action**: tokenValidator + inputValidator로 분할
- **Code Patch**:
  ```typescript
  // 제안된 분할 구조
  // tokenValidator.ts: 토큰 검증 로직
  // inputValidator.ts: 입력 검증 로직
  ```

---
```

### 6.3 소명 기록 (`justifications.md`)

```markdown
# Justifications — <branch name>

**Date**: <ISO 8601>
**Accepted Fixes**: N / M
**Rejected Fixes**: K

---

## JUST-001: FIX-002 거부 소명

- **Original Fix**: LCOM4 임계값 초과 → validator 분할
- **Developer Decision**: REJECTED
- **Developer's Justification**: "현재 스프린트 마감이 2일 남았으며, 분할 작업은 기존 테스트 전체 수정이 필요. 다음 스프린트에서 처리 예정."
- **Refined ADR**: "ADR-2026-02-22: validator.ts 모듈 분할 연기. 사유: 스프린트 마감 압박으로 인한 비즈니스 가치 실현 우선. LCOM4=3 상태를 기술 부채로 발행하며, 다음 스프린트 초에 tokenValidator/inputValidator 분리를 계획한다. 예상 소요: 1일."
- **Debt Created**: `.filid/debt/src-auth-validator-a1b2c3.md`

---
```

### 6.4 재검증 결과 (`re-validate.md`)

```markdown
# Re-validation Result — <branch name>

**Date**: <ISO 8601>
**Verdict**: PASS | FAIL

## Delta 분석

| 파일 | 변경 유형 | 관련 Fix |
|---|---|---|
| src/auth/auth.spec.ts | modified (18→12 케이스) | FIX-001 해소 |
| src/auth/auth-edge.spec.ts | added (6 케이스) | FIX-001 해소 |

## 검증 결과

| Fix ID | 상태 | 상세 |
|---|---|---|
| FIX-001 | ✅ RESOLVED | spec.ts가 12케이스, edge.spec.ts가 6케이스로 분할 |
| FIX-002 | ⏳ DEFERRED (부채) | 소명 수용됨, 부채 발행 완료 |

## 부채 변동

| 변동 | 부채 파일 | 상세 |
|---|---|---|
| 신규 | src-auth-validator-a1b2c3.md | LCOM4 분할 연기 |

## 최종 판정

**PASS** — 모든 수정 사항이 해소되었거나 유효한 소명으로 부채 전환됨.
PR 머지 후 `.filid/review/<branch>/` 디렉토리를 수동으로 정리하세요.
```

---

## 7. `.filid/` 디렉토리 구조 명세

### 7.1 전체 구조

```
<project-root>/
└── .filid/
    ├── review/                          # 진행 중인 리뷰 세션
    │   └── <normalized-branch-name>/    # 브랜치별 디렉토리
    │       ├── session.md               # Phase A 출력 (중간 체크포인트)
    │       ├── verification.md          # Phase B 출력 (중간 체크포인트)
    │       ├── review-report.md         # Phase C 출력
    │       ├── fix-requests.md          # Phase C 출력
    │       ├── justifications.md        # resolve-review 출력
    │       └── re-validate.md           # re-validate 출력
    └── debt/                            # 누적 기술 부채
        ├── <fractal-path>-<hash>.md     # 부채 항목별 개별 파일
        └── ...
```

### 7.2 중간 산출물 스키마

Phase A/B의 subagent가 생성하는 중간 산출물의 스키마를 정의한다. 의장(Phase C)은 이 파일들만 Read하여 합의를 수행하므로, 스키마의 일관성이 Phase 간 데이터 정합성의 핵심이다.

#### `session.md` (Phase A → Phase C 전달)

```markdown
---
branch: <원본 브랜치 이름>
normalized_branch: <정규화된 브랜치 이름>
base_ref: <merge-base commit SHA>
complexity: LOW | MEDIUM | HIGH
committee:
  - <페르소나 ID>
  - ...
changed_files_count: <숫자>
changed_fractals:
  - <프랙탈 경로>
  - ...
interface_changes: true | false
created_at: <ISO 8601>
---

## 변경 파일 요약

| 파일 | 변경 유형 | 프랙탈 | 줄 수 변경 |
|------|-----------|--------|------------|
| src/features/auth/validator.ts | modified | src/features/auth | +45 -12 |
| ... | | | |

## 복잡도 판정 근거

변경 파일 N개, 프랙탈 M개, 인터페이스 변경 <있음/없음> → <등급>

## 위원회 선출 근거

<등급> 등급에 따른 필수 선출: ...
적대적 짝짓기: <페르소나 A> ↔ <페르소나 B> + <페르소나 C>.
```

**필수 frontmatter 필드**: `branch`, `complexity`, `committee`, `changed_fractals`, `created_at`

#### `verification.md` (Phase B → Phase C 전달)

```markdown
---
session_ref: session.md
tools_executed:
  - <MCP tool 이름>
  - ...
all_passed: true | false
critical_failures: <숫자>
debt_count: <기존 부채 건수>
debt_total_weight: <가중치 합계>
debt_bias_level: LOW_PRESSURE | MODERATE_PRESSURE | HIGH_PRESSURE | CRITICAL_PRESSURE
created_at: <ISO 8601>
---

## FCA-AI 구조 검증

| 검증 항목 | 결과 | 상세 |
|-----------|------|------|
| 프랙탈 경계 | PASS/WARN/FAIL | ... |
| CLAUDE.md 규정 | PASS/WARN/FAIL | ... |
| 3+12 규칙 | PASS/WARN/FAIL | ... |
| LCOM4 | PASS/WARN/FAIL | ... |
| CC | PASS/WARN/FAIL | ... |
| 순환 의존성 | PASS/WARN/FAIL | ... |
| 구조 드리프트 | PASS/WARN/FAIL | ... |

## 부채 현황

| 기존 부채 수 | 이번 PR 관련 부채 | 가중치 합계 | 바이어스 수준 |
|---|---|---|---|
| N건 | M건 (관련 프랙탈, 가중치 X) | Y | <바이어스 수준> |

### 관련 부채 목록

| ID | 프랙탈 경로 | 규칙 위반 | 가중치 | 생성일 |
|---|---|---|---|---|
| ... | | | | |
```

**필수 frontmatter 필드**: `session_ref`, `all_passed`, `critical_failures`, `debt_bias_level`, `created_at`

### 7.3 브랜치 이름 정규화 규칙

| 원본 브랜치 이름 | 정규화 결과 | 규칙 |
|---|---|---|
| `feature/issue-6` | `feature--issue-6` | `/` → `--` |
| `feature/deep/nested/path` | `feature--deep--nested--path` | 모든 `/` → `--` |
| `main` | `main` | 변환 없음 |
| `release-v1.0` | `release-v1.0` | 변환 없음 |
| `fix/bug#123` | `fix--bug_123` | `/` → `--`, `#` → `_` |
| `user@feature` | `user_feature` | `@` → `_` |
| `feature/--special` | `feature----special` | `/` → `--`, 연속 `--` 유지 (충돌 방지) |

**정규화 규칙**:
1. `/` → `--` (가장 핵심, 디렉토리 구분자 충돌 방지)
2. `#`, `@`, `~`, `^`, `:`, `?`, `*`, `[`, `]`, `\` → `_` (파일시스템 안전 문자)
3. 선행/후행 `.`, `-` 제거

> **Note**: 연속 `--`는 축약하지 않는다. `feature/--special` → `feature----special`로 유지하여 `feature/special`(`feature--special`)과의 충돌을 방지한다. 디렉토리 이름이 다소 길어질 수 있으나 고유성이 우선이다.

**역정규화**: 불필요. `resolve-review`와 `re-validate`는 `git branch --show-current` 결과를 정규화하여 디렉토리를 매칭하므로 역변환이 필요 없음.

### 7.4 라이프사이클 자동 정리

| 트리거 | 동작 | 메커니즘 |
|---|---|---|
| `re-validate` PASS | 유지 (PR에 리뷰 이력 보존) | — |
| `re-validate` FAIL | 유지 (재수정 후 재검증 필요) | — |
| PR 머지 후 | `.filid/review/<branch>/` 디렉토리 삭제 | **수동** (개발자가 머지 후 정리) |
| 브랜치 삭제 후 | `.filid/review/<branch>/` 디렉토리 잔존 가능 | **수동** 정리 또는 `--gc` |

**설계 결정**: re-validate PASS에서 자동 삭제하지 않는 이유:
1. 리뷰 파일이 커밋되어 PR에 감사 추적(audit trail)이 남아야 함
2. PR 머지 전에 삭제하면 팀원이 리뷰 결과를 확인할 수 없음
3. PR 머지 후에는 git 히스토리에 이력이 남으므로 디렉토리 삭제 가능

**고아 디렉토리 정리**: `/filid:scan` 실행 시 `.filid/review/` 하위 디렉토리 중 대응하는 브랜치가 없는 항목을 LOW 심각도 경고로 보고. 개발자가 수동 정리하거나 향후 `--gc` 옵션 추가 가능.

### 7.5 커밋 정책

```gitignore
# .filid/ 디렉토리는 커밋 대상
# .gitignore에 추가하지 않음

# 리뷰 파일: PR에 리뷰 이력이 남아 팀 간 공유
# 부채 파일: 프로젝트 전체의 기술 부채 현황 공유
```

---

## 8. 기술 부채(Debt) 관리 시스템

### 8.1 부채 파일 스키마

파일명: `<fractal-path-normalized>-<hash>.md`
- `<fractal-path-normalized>`: 프랙탈 경로의 `/` → `-` 치환 (예: `src-features-auth`)
- `<hash>`: 부채 내용의 첫 6자리 SHA-256 해시 (고유성 보장)

```markdown
---
id: <fractal-path-normalized>-<hash>
fractal_path: src/features/auth
file_path: src/features/auth/validator.ts
created_at: 2026-02-22T10:30:00Z
review_branch: feature/issue-6
original_fix_id: FIX-002
severity: HIGH
weight: 1
touch_count: 0
last_review_commit: null
rule_violated: LCOM4 >= 2
metric_value: "LCOM4=3"
---

# 기술 부채: validator.ts LCOM4 임계값 초과

## 원래 수정 요청

LCOM4=3으로 응집도 결여 임계값(2)을 초과. tokenValidator와 inputValidator로 분할 권고.

## 개발자 소명

현재 스프린트 마감이 2일 남았으며, 분할 작업은 기존 테스트 전체 수정이 필요. 다음 스프린트에서 처리 예정.

## 정제된 ADR

ADR-2026-02-22: validator.ts 모듈 분할을 다음 스프린트로 연기.
사유: 스프린트 마감 압박, 비즈니스 가치 실현 우선.
영향 범위: src/features/auth 프랙탈 내부.
예상 해소 시점: 다음 스프린트 (1일 소요 예상).
```

### 8.2 가중치 계산 알고리즘

#### 기본 공식

```
weight(debt) = base_weight × 2^(touch_count)
```

| 변수 | 설명 | 초기값 |
|---|---|---|
| `base_weight` | 부채 생성 시 기본 가중치 | 1 |
| `touch_count` | 해당 프랙탈에 대한 후속 수정 횟수 | 0 |

#### 가중치 증가 규칙

1. 부채 생성 시: `weight = 1` (base_weight × 2^0)
2. 해당 프랙탈에 첫 번째 추가 수정 발생: `weight = 2` (1 × 2^1)
3. 두 번째 추가 수정: `weight = 4` (1 × 2^2)
4. 세 번째 추가 수정: `weight = 8` (1 × 2^3)

#### 상한선

- **최대 가중치: 16** (2^4)
- 이유: 지수적 증가의 경우 5번째 수정에서 32가 되어 과도한 바이어스 발생 방지
- 상한선 도달 시 더 이상 증가하지 않으나, 부채 자체는 유지

#### 전체 부채 점수

```
total_debt_score = Σ weight(debt_i)  for all debt_i in .filid/debt/
```

### 8.3 위원회 바이어스 주입 방식

#### 컨텍스트 프롬프트 기반 주입

의장(Chairperson)의 SKILL.md에 다음 구조로 부채 정보를 주입:

```markdown
## 기존 기술 부채 현황 (위원회 바이어스)

**전체 부채 점수**: 12.0 (5건)
**판정 바이어스**: MODERATE_PRESSURE

### 부채 목록

| ID | 프랙탈 경로 | 규칙 위반 | 가중치 | 생성일 |
|---|---|---|---|---|
| src-auth-validator-a1b2c3 | src/features/auth | LCOM4≥2 | 4 | 2026-01-15 |
| src-auth-flow-d4e5f6 | src/features/auth | CC>15 | 2 | 2026-02-01 |
| src-user-model-g7h8i9 | src/features/user | 3+12 규칙 | 1 | 2026-02-10 |
| ... | | | | |

### 이번 PR 관련 부채

**src/features/auth** 프랙탈에 기존 부채 2건 (가중치 합계: 6).
이번 PR이 해당 프랙탈을 수정하므로 가중치 2배 적용됨.

### 위원회 지침

부채 점수에 따른 바이어스 수준:
- 0~5: LOW_PRESSURE — 일반적 리뷰
- 6~15: MODERATE_PRESSURE — 부채 상환 강력 권고
- 16~30: HIGH_PRESSURE — 신규 부채 발행 거의 불허
- 31+: CRITICAL_PRESSURE — 부채 상환 없이는 PR 승인 불가
```

#### 바이어스 수준별 위원회 행동

| 바이어스 수준 | 위원회 행동 | 비즈니스 드라이버 영향 |
|---|---|---|
| LOW_PRESSURE | 일반 리뷰, 부채 발행 허용 | CoD 주장 수용 가능 |
| MODERATE_PRESSURE | 부채 상환 강력 권고, 신규 부채 발행 시 엄격한 소명 요구 | CoD 주장에 정량적 근거 필수 |
| HIGH_PRESSURE | 신규 부채 발행 거의 불허, 기존 부채 1건 이상 상환 요구 | CoD 주장 사실상 기각 |
| CRITICAL_PRESSURE | 부채 상환 없이는 PR 승인 불가 | VETO 기본 |

### 8.4 부채 해소 판정 기준

#### 해소 조건

부채가 해소되려면 다음 조건을 **모두** 충족해야 한다:

1. **파일 경로 일치**: 수정된 파일이 부채의 `file_path`와 일치
2. **규칙 준수**: 해당 파일에 대해 부채가 위반했던 규칙을 재검증 시 PASS
   - 예: `LCOM4≥2` 부채 → 수정 후 `ast-analyze(lcom4)` 결과 `LCOM4<2`
   - 예: `CC>15` 부채 → 수정 후 `ast-analyze(cyclomatic-complexity)` 결과 `CC≤15`
   - 예: `3+12 규칙` 부채 → 수정 후 `test-metrics(check-312)` 결과 PASS

3. **의장 확인**: 의장(Chairperson)이 MCP tool 결과를 바탕으로 해소를 확정

#### 해소 시 동작

1. 해당 `.filid/debt/<file>.md` 파일 삭제
2. `re-validate.md`에 해소 기록 추가
3. `total_debt_score` 재계산

#### 부분 해소

- 하나의 부채가 여러 규칙 위반을 포함하는 경우는 없음 (1 부채 = 1 규칙 위반)
- 따라서 부분 해소 개념 불필요 — 해소되면 전체 삭제

### 8.5 가중치 2배 규칙 상세 메커니즘

```
code-review 실행 시:

1. .filid/debt/ 전체 로딩
2. 이번 PR에서 변경된 파일의 프랙탈 경로 추출
3. 현재 HEAD 커밋 SHA 획득 (git rev-parse HEAD)
4. for each debt in debts:
     if debt.fractal_path in changed_fractal_paths:
       if debt.last_review_commit == current_commit_sha:
         SKIP (이미 이 커밋에서 카운트됨 — 멱등성 보호)
       else:
         debt.touch_count += 1
         debt.weight = min(base_weight × 2^touch_count, 16)
         debt.last_review_commit = current_commit_sha
         debt 파일 업데이트
5. total_debt_score 재계산
6. 바이어스 수준 결정
7. 위원회에 바이어스 주입
```

**멱등성 보호**: 동일 커밋에서 `code-review`를 여러 번 실행해도 가중치가 중복 증가하지 않는다. `last_review_commit` 필드가 현재 HEAD SHA와 일치하면 가중치 업데이트를 건너뛴다.

**주의**: 가중치 업데이트는 `code-review` 실행 시에만 발생하며, `resolve-review`나 `re-validate`에서는 가중치를 변경하지 않는다.

### 8.6 부채 목록과 프랙탈 경로 매핑

```
.filid/debt/
├── src-features-auth-validator-a1b2c3.md   ← fractal_path: src/features/auth
├── src-features-auth-flow-d4e5f6.md        ← fractal_path: src/features/auth
├── src-features-user-model-g7h8i9.md       ← fractal_path: src/features/user
└── src-core-api-handler-j0k1l2.md          ← fractal_path: src/core/api
```

매핑 방식:
1. 파일명에서 프랙탈 경로 추출: `src-features-auth-validator-a1b2c3` → frontmatter의 `fractal_path` 읽기
2. 파일명 자체는 **고유 식별자** 역할만 수행 (역변환에 사용하지 않음)
3. 프랙탈 경로 매핑은 항상 frontmatter의 `fractal_path` 필드를 기준으로 수행

---

## 9. 위원회 선출 규칙

### 9.1 복잡도 등급

| 등급 | 조건 | 최소 위원 수 |
|---|---|---|
| **LOW** | 변경 파일 ≤ 3, 단일 프랙탈, 인터페이스 변경 없음 | 2 |
| **MEDIUM** | 변경 파일 4~10, 2~3개 프랙탈, 인터페이스 변경 있음 | 4 |
| **HIGH** | 변경 파일 > 10, 4개+ 프랙탈, 아키텍처 변경 | 6 (전원) |

### 9.2 등급별 필수 선출

| 등급 | 필수 선출 | 선택적 선출 |
|---|---|---|
| LOW | 엔지니어링 아키텍트 + 운영/SRE | — |
| MEDIUM | 엔지니어링 + 지식 관리자 + 비즈니스 드라이버 + 운영/SRE | 프로덕트, 디자인 |
| HIGH | 전원 (6명) | — |

### 9.3 적대적 짝짓기 규칙

| 선출 조건 | 반드시 동시 선출 | 이유 |
|---|---|---|
| 비즈니스 드라이버 선출 | + 지식 관리자 + 운영/SRE | 속도 vs 안정성 견제 |
| 프로덕트 매니저 선출 | + 엔지니어링 아키텍트 | 요구사항 vs 구현 현실 견제 |
| 디자인/HCI 선출 | + 엔지니어링 아키텍트 | 사용성 vs 기술적 제약 견제 |

---

## 10. 스킬 파일 구조 명세

### 10.1 `code-review` 스킬 디렉토리

```
skills/code-review/
├── SKILL.md                          # 의장 오케스트레이터 (~80줄)
├── reference.md                      # 출력 포맷 템플릿
├── state-machine.md                  # 상태 전이 규칙 + 정족수 규칙 (~40줄)
├── phases/
│   ├── phase-a-analysis.md           # Phase A agent 지침 (~60줄)
│   └── phase-b-verification.md       # Phase B agent 지침 (~80줄)
└── personas/
    ├── engineering-architect.md       # ~150줄
    ├── knowledge-manager.md          # ~150줄
    ├── operations-sre.md             # ~120줄
    ├── business-driver.md            # ~120줄
    ├── product-manager.md            # ~100줄
    └── design-hci.md                 # ~100줄
```

### 10.2 파일별 책임 분리

| 파일 | 책임 | 로딩 시점 | 로딩 주체 |
|------|------|-----------|-----------|
| `SKILL.md` | 의장 정체성, 오케스트레이션 절차, Phase C 합의 지침, 체크포인트 재개 | 스킬 실행 시 자동 | Claude Code |
| `reference.md` | review-report.md / fix-requests.md 출력 포맷 템플릿, 예시 | Phase C에서 의장이 Read | 의장 |
| `state-machine.md` | 상태 전이 규칙 (4.1~4.5절의 요약), 정족수 계산 | Phase C에서 의장이 Read | 의장 |
| `phases/phase-a-analysis.md` | git diff 수집, 프랙탈 경로 식별, 복잡도 판정, 위원회 선출, session.md 스키마 | Phase A에서 분석 agent가 Read | 분석 Agent |
| `phases/phase-b-verification.md` | MCP tool 호출 목록, 검증 테이블 포맷, 부채 현황 수집, verification.md 스키마 | Phase B에서 검증 agent가 Read | 검증 Agent |
| `personas/*.md` | 각 페르소나의 전문지식, 행동양식, 행동 원칙 | Phase C에서 선출된 것만 의장이 Read | 의장 |

### 10.3 SKILL.md 크기 제한

| 파일 | 최대 줄 수 | 근거 |
|------|-----------|------|
| `SKILL.md` | **80줄** | 오케스트레이션 지침만 포함. 합의 상세는 state-machine.md에 분리 |
| `reference.md` | **100줄** | 출력 포맷 템플릿. 예시는 최소화 |
| `state-machine.md` | **50줄** | 전이 규칙 테이블 + 정족수 규칙 |
| `phases/*.md` | **각 80줄** | 한 Phase의 지침. subagent가 단독 실행 |
| `personas/*.md` | **각 150줄** | 전문지식 + 행동양식 + 행동 원칙의 3섹션 구조 |

### 10.4 의장의 Task tool 위임 방식

의장이 Phase A/B를 위임할 때 Task tool을 다음과 같이 호출한다:

```
Phase A 위임:
  Task(
    subagent_type = "general-purpose",
    model = "haiku",
    prompt = "다음 파일의 지침을 Read하고 실행하세요:
              <plugin-root>/skills/code-review/phases/phase-a-analysis.md

              실행 컨텍스트:
              - 브랜치: <현재 브랜치명>
              - 리뷰 디렉토리: .filid/review/<정규화된 브랜치명>/
              - 출력: session.md를 리뷰 디렉토리에 Write"
  )

Phase B 위임:
  Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    prompt = "다음 파일의 지침을 Read하고 실행하세요:
              <plugin-root>/skills/code-review/phases/phase-b-verification.md

              실행 컨텍스트:
              - 리뷰 디렉토리: .filid/review/<정규화된 브랜치명>/
              - 입력: session.md (리뷰 디렉토리에서 Read)
              - 출력: verification.md를 리뷰 디렉토리에 Write"
  )
```

> **Note**: `<plugin-root>`는 filid 플러그인의 설치 경로이다. SKILL.md에서 Glob으로 `**/skills/code-review/phases/phase-a-analysis.md`를 탐색하거나, 고정 경로를 사용한다.

---

## 관련 세부 문서

- [PLAN.md](./PLAN.md) — 개발 절차 계획
- [FCA-AI-code-review-report.md](./FCA-AI-code-review-report.md) — 개념적 기반
- [FCA-AI-code-review-detail.md](./FCA-AI-code-review-detail.md) — 페르소나 상세 연구
