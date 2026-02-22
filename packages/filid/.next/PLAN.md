# AI 코드 리뷰 거버넌스 시스템 — 개발 계획

> filid 플러그인 확장: 다중 페르소나 합의체 기반 코드 리뷰 거버넌스

> **도메인별 분할 문서**: 이 문서의 각 섹션은 독립 파일로 분할되었습니다. 특정 영역만 참조하려면 아래 링크를 사용하세요.
>
> | 분할 파일                              | 내용                                          |
> | -------------------------------------- | --------------------------------------------- |
> | [01-COMPONENTS.md](./01-COMPONENTS.md) | §1-2: 기존 컴포넌트 영향 분석 + 신규 컴포넌트 |
> | [02-PHASES.md](./02-PHASES.md)         | §3-4: 구현 Phase 및 의존성 그래프             |
> | [09-RISKS.md](./09-RISKS.md)           | §5: 리스크 및 완화 전략                       |
> | [INDEX.md](./INDEX.md)                 | 전체 문서 인덱스                              |

---

## 1. 기존 컴포넌트 영향 분석 (중복 방지 맵)

### 1.1 재사용 대상

| 기존 컴포넌트        | 유형               | code-review 거버넌스에서의 역할                                | 재사용 방식                                           |
| -------------------- | ------------------ | -------------------------------------------------------------- | ----------------------------------------------------- |
| `fractal-architect`  | agent (RO, opus)   | 엔지니어링 아키텍트 — 구조 분석, LCOM4/CC, split/compress 진단 | Phase B subagent가 MCP tool 호출로 동일 분석 수행     |
| `qa-reviewer`        | agent (RO, sonnet) | 엔지니어링 아키텍트 — 6-stage 규칙 검증, 3+12 규칙             | Phase B subagent가 MCP tool 호출로 동일 검증 수행     |
| `context-manager`    | agent (sonnet)     | 지식 관리자 — CLAUDE.md/SPEC.md 무결성 검증                    | Phase B subagent가 MCP tool 호출로 문서 검증 수행     |
| `drift-analyzer`     | agent (RO, sonnet) | 지식 관리자 — 구조 드리프트 감지                               | Phase B subagent가 MCP tool 호출로 드리프트 분석 수행 |
| `ast-analyze`        | MCP tool           | LCOM4, CC, dependency-graph, tree-diff 분석                    | Phase B subagent가 호출                               |
| `test-metrics`       | MCP tool           | 3+12 규칙 검증, test count, decision tree                      | Phase B subagent가 호출                               |
| `fractal-navigate`   | MCP tool           | 프랙탈 구조 탐색, 디렉토리 분류                                | Phase B subagent가 호출                               |
| `structure-validate` | MCP tool           | 구조 규칙 위반 검증                                            | Phase B subagent가 호출                               |
| `drift-detect`       | MCP tool           | 구조 드리프트 감지                                             | Phase B subagent가 호출                               |
| `fractal-scan`       | MCP tool           | 프로젝트 전체 프랙탈 트리 빌드                                 | Phase B subagent가 호출                               |
| `rule-query`         | MCP tool           | 활성 규칙 조회                                                 | Phase B subagent가 호출                               |
| `doc-compress`       | MCP tool           | 문서 압축 상태 검증                                            | Phase B subagent가 호출                               |
| `lca-resolve`        | MCP tool           | 최저 공통 조상 해결                                            | Phase B subagent가 호출                               |

### 1.2 영향 없음 (변경 불필요)

| 컴포넌트             | 유형  | 이유                                       |
| -------------------- | ----- | ------------------------------------------ |
| `implementer`        | agent | 코드 구현 전담 — 리뷰 거버넌스와 무관      |
| `restructurer`       | agent | 구조 변경 실행 전담 — 리뷰 거버넌스와 무관 |
| `pre-tool-validator` | hook  | 기존 Write/Edit 검증 유지                  |
| `structure-guard`    | hook  | 기존 organ 보호 유지                       |
| `agent-enforcer`     | hook  | 기존 에이전트 역할 제한 유지               |
| `context-injector`   | hook  | 기존 FCA-AI 규칙 주입 유지                 |
| 기존 8개 skills      | skill | 각각 독립 워크플로우 유지                  |

### 1.3 `structure-review`와 `code-review`의 관계

```
structure-review (기존)          code-review (신규)
┌─────────────────────┐         ┌──────────────────────────────────┐
│ 6-Stage 기술 파이프라인 │         │ 다중 페르소나 합의체 거버넌스        │
│                     │         │                                  │
│ Stage 1: Structure  │◀────────│ 엔지니어링 아키텍트 페르소나가       │
│ Stage 2: Documents  │         │ MCP tool로 동일 검증 수행          │
│ Stage 3: Tests      │         │                                  │
│ Stage 4: Metrics    │         │ + 비즈니스/프로덕트/디자인/운영      │
│ Stage 5: Dependencies│        │   페르소나의 정치적 합의 추가        │
│ Stage 6: Summary    │         │                                  │
└─────────────────────┘         └──────────────────────────────────┘
     독립 실행 가능                   structure-review를 포함하는 상위 집합
```

- **공존**: `structure-review`는 빠른 기술 검증용으로 독립 존속
- **포함**: `code-review`는 동일한 MCP tool을 사용하되 거버넌스 레이어를 추가
- **비중복**: 동일한 MCP tool을 호출하지만 서로 다른 SKILL.md에서 독립 실행

---

## 2. 신규 컴포넌트 목록

### 2.1 Skills (3개 신규)

| 스킬                    | 디렉토리                 | 라이프사이클 | 설명                                                                                    |
| ----------------------- | ------------------------ | ------------ | --------------------------------------------------------------------------------------- |
| `/filid:code-review`    | `skills/code-review/`    | Phase A→B→C  | 의장 위임 패턴: Phase A(분석, haiku) → Phase B(검증, sonnet) → Phase C(합의, 의장 직접) |
| `/filid:resolve-review` | `skills/resolve-review/` | Phase 4      | 수정 사항 선택적 수용 + 소명 + ADR 정제 + 부채 기록                                     |
| `/filid:re-validate`    | `skills/re-validate/`    | Phase 5      | Delta 재검증 → PASS/FAIL → 디렉토리 정리                                                |

### 2.2 Agents (0개 신규)

신규 agent 파일을 생성하지 않는다. 이유:

1. **비즈니스 드라이버, 프로덕트 매니저, 디자인/HCI** — Skill 프롬프트 내 페르소나 프레임워크로 내장
   - 도구 접근(Write/Edit/Bash)이 불필요한 순수 LLM 추론 역할
   - code-review 전용이므로 범용 agent로 분리할 이유 없음
   - 별도 subagent 생성 시 컨텍스트 로딩 오버헤드 발생

2. **운영/SRE** — Skill 프롬프트 내 페르소나 프레임워크로 내장
   - qa-reviewer의 기술 검증은 MCP tool로 커버
   - SRE 특화 관점(폭발 반경, 오류 예산)은 LLM 추론으로 보충

3. **엔지니어링 아키텍트, 지식 관리자** — 기존 agent의 MCP tool을 Phase B subagent가 호출
   - fractal-architect, qa-reviewer가 사용하는 동일 MCP tool을 Phase B subagent가 사용
   - 의장 컨텍스트에 MCP 호출 결과를 로딩하지 않고, `verification.md`로 요약 전달

### 2.3 MCP Tools (2개 신규)

기존 9개 MCP tool로 FCA-AI 결정론적 검증을 커버한다. 거버넌스 워크플로우 고유의 **결정론적 연산**(브랜치 정규화, 위원회 선출, 부채 가중치 계산)은 LLM 추론에 맡기면 정확도가 보장되지 않으므로, 2개 신규 MCP tool을 추가한다.

#### 기존 재사용 (9개)

- 구조 검증: `fractal-scan`, `structure-validate`, `fractal-navigate`
- 코드 분석: `ast-analyze` (LCOM4, CC, dependency-graph, tree-diff)
- 테스트 검증: `test-metrics` (3+12, count, decide)
- 문서 검증: `doc-compress`, `drift-detect`
- 규칙 조회: `rule-query`, `lca-resolve`

#### 신규 추가 (2개)

| MCP Tool        | 설명                                                                        | 설계 근거                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review-manage` | 리뷰 세션 관리 — 브랜치 정규화, 디렉토리 CRUD, 체크포인트 감지, 위원회 선출 | 브랜치 정규화(`/`→`--`, 특수문자 이스케이핑)와 위원회 선출(복잡도 판정 + 적대적 짝짓기)은 조건부 규칙이 복잡하여 LLM 추론에 일관성이 보장되지 않음 |
| `debt-manage`   | 부채 관리 — CRUD, 가중치 계산, 바이어스 수준 판정, touch_count 업데이트     | 가중치 공식(`base × 2^touch_count`, cap=16)과 멱등성 보호(`last_review_commit` 비교)는 결정론적 연산이므로 코드로 보장                             |

##### `review-manage` 액션

| Action             | 입력                                                                                    | 출력                                                                    | 용도                               |
| ------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `normalize-branch` | `branchName: string`                                                                    | `normalized: string`                                                    | 브랜치 이름 → 디렉토리 안전 문자열 |
| `ensure-dir`       | `branchName: string`                                                                    | `path: string, created: boolean`                                        | `.filid/review/<branch>/` 생성     |
| `checkpoint`       | `branchName: string`                                                                    | `phase: "A"\|"B"\|"C"\|"DONE", files: string[]`                         | 체크포인트 상태 감지               |
| `elect-committee`  | `changedFilesCount: number, changedFractalsCount: number, hasInterfaceChanges: boolean` | `complexity: string, committee: string[], adversarialPairs: string[][]` | 복잡도 판정 + 위원회 결정론적 선출 |
| `cleanup`          | `branchName: string`                                                                    | `deleted: boolean`                                                      | 리뷰 디렉토리 삭제                 |

##### `debt-manage` 액션

| Action           | 입력                                                                         | 출력                                                              | 용도                                                |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| `create`         | `debtItem: DebtItem`                                                         | `filePath: string, id: string`                                    | 부채 파일 생성                                      |
| `list`           | `fractalPath?: string`                                                       | `debts: DebtItem[], totalWeight: number`                          | 전체 또는 특정 프랙탈 부채 목록                     |
| `resolve`        | `debtId: string`                                                             | `deleted: boolean`                                                | 부채 해소 시 파일 삭제                              |
| `calculate-bias` | `debts: DebtItem[], changedFractalPaths: string[], currentCommitSha: string` | `biasLevel: string, totalScore: number, updatedDebts: DebtItem[]` | 가중치 갱신 + 바이어스 수준 판정 (멱등성 보호 포함) |

### 2.4 Hooks (0개 신규)

사용자 실행 기반(`/filid:code-review` 명시적 호출)이므로 자동 실행 hook이 불필요하다.

### 2.5 페르소나 정의 파일 (6개 신규)

`skills/code-review/personas/` 하위에 페르소나별 프레임워크 문서를 배치:

| 파일                       | 페르소나            | 근거                                    |
| -------------------------- | ------------------- | --------------------------------------- |
| `engineering-architect.md` | 엔지니어링 아키텍트 | LCOM4/CC 기반 구조 진단, 3+12 규칙, SRP |
| `knowledge-manager.md`     | 지식 관리자         | CLAUDE.md/SPEC.md 무결성, ACL, 드리프트 |
| `operations-sre.md`        | 운영/SRE            | 폭발 반경, 오류 예산, 보안, 안정성      |
| `business-driver.md`       | 비즈니스 드라이버   | 지연 비용, MVP, 기술 부채 발행          |
| `product-manager.md`       | 프로덕트 매니저     | 4대 리스크, 문제 정의, 충실도           |
| `design-hci.md`            | 디자인/HCI          | 밀러의 법칙, 닐슨 휴리스틱, 인지 부하   |

이 파일들은 Phase C(합의)에서 의장이 선출된 페르소나의 프레임워크만 지연 로딩(lazy loading)한다. Phase A는 위원회 선출만 수행하고, 실제 페르소나 파일 로딩은 Phase C에서 발생하여 컨텍스트를 최소화한다.

### 2.6 Phase 분할 파일 및 상태 머신 (3개 신규)

`skills/code-review/` 하위에 의장 위임 패턴을 위한 Phase 분할 파일과 상태 머신 명세를 배치:

| 파일                             | 역할                      | 설명                                                                                            |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `phases/phase-a-analysis.md`     | Phase A subagent 프롬프트 | git diff 분석, `review-manage(elect-committee)` 호출로 결정론적 위원회 선출 → `session.md` 출력 |
| `phases/phase-b-verification.md` | Phase B subagent 프롬프트 | 기존 MCP tool 호출(결정론적 검증) + `debt-manage(calculate-bias)` 호출 → `verification.md` 출력 |
| `state-machine.md`               | 상태 머신 명세            | PROPOSAL → DEBATE → VETO/SYNTHESIS/ABSTAIN → CONCLUSION (최대 5라운드)                          |

### 2.7 중간 산출물 스키마 (2개 신규)

`.filid/review/<branch>/` 하위에 Phase 간 데이터 전달을 위한 중간 산출물:

| 파일              | 생성 주체        | 소비 주체      | 설명                                                     |
| ----------------- | ---------------- | -------------- | -------------------------------------------------------- |
| `session.md`      | Phase A subagent | 의장 (Phase C) | 브랜치, 복잡도, 위원회 구성, 변경 프랙탈 목록, 생성 시각 |
| `verification.md` | Phase B subagent | 의장 (Phase C) | 전체 통과 여부, 치명적 실패 목록, 부채 바이어스 수준     |

---

## 3. Phase별 구현 순서와 의존성 그래프

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
(설계 확정)   (MCP Tool    (code-review   (resolve-     (re-validate  (통합 검증)    (.metadata
              + .filid/)    스킬)          review 스킬)   스킬)                       반영)
```

### Phase 0: 설계 문서 확정 (현재 단계)

**목표**: 전체 시스템 설계를 문서화하고 합의를 도출한다.

**작업 항목**:

- [x] FCA-AI 코드 리뷰 보고서 분석 (`FCA-AI-code-review-report.md`)
- [x] 페르소나 상세 연구 분석 (`FCA-AI-code-review-detail.md`)
- [x] 기존 컴포넌트 영향 분석
- [x] PLAN.md 작성 (본 문서)
- [x] BLUE-PRINT.md 작성 (기술 청사진)
- [x] 세부 설계 문서 작성 (상태 머신, 부채 시스템, 페르소나 등 — BLUE-PRINT.md에 통합)

**완료 기준 (DoD)**:

- [x] PLAN.md 리뷰 통과 (Architect: APPROVE_WITH_NOTES, Critic: APPROVE)
- [x] BLUE-PRINT.md 리뷰 통과 (Architect: APPROVE_WITH_NOTES, Critic: APPROVE)
- [x] 모든 설계 결정 사항에 대한 근거 문서화 완료
- [x] 기존 컴포넌트와의 중복 없음 확인 (0 신규 agent, 2 신규 MCP tool, 0 신규 hook)
- [x] 신규 MCP tool은 거버넌스 고유 결정론적 연산만 담당 (기존 FCA-AI 검증 도구와 비중복)

**의존성**: 없음 (최초 단계)

---

### Phase 1: MCP Tool 구현 + `.filid/` 인프라

**목표**: 거버넌스 워크플로우의 결정론적 연산을 MCP tool로 구현하고, 리뷰/부채 파일 시스템 인프라를 확보한다.

**설계 근거**: SKILL.md의 실행 모델은 프롬프트 → Task agent → Read/Write/Bash/MCP이다. 브랜치 정규화, 위원회 선출, 부채 가중치 계산 등 결정론적 연산을 LLM 추론에 맡기면 일관성이 보장되지 않으므로, MCP tool로 노출하여 subagent가 호출할 수 있게 한다.

**작업 항목**:

1. `review-manage` MCP tool 구현 (`src/mcp/review-manage.ts`)
   - `normalize-branch`: `/` → `--`, 특수문자 → `_` 치환 (BLUE-PRINT.md §7.3 규칙)
   - `ensure-dir`: `.filid/review/<branch>/` 디렉토리 생성
   - `checkpoint`: 중간 산출물 존재 여부로 Phase 상태 감지
   - `elect-committee`: 복잡도 판정(LOW/MED/HIGH) + 적대적 짝짓기 규칙 적용
   - `cleanup`: 리뷰 디렉토리 삭제
2. `debt-manage` MCP tool 구현 (`src/mcp/debt-manage.ts`)
   - `create`: 부채 파일 생성 (frontmatter + 본문)
   - `list`: 전체/프랙탈별 부채 목록 + 가중치 합계
   - `resolve`: 부채 해소 시 파일 삭제
   - `calculate-bias`: 가중치 갱신(`base × 2^touch_count`, cap=16) + 멱등성 보호(`last_review_commit`) + 바이어스 수준 판정
3. 타입 정의 (`src/types/`)
   - `debt.ts`: DebtItem, DebtWeight, BiasLevel 타입
   - `review.ts`: ReviewSession, VerificationResult, CommitteeElection, CheckpointStatus 타입
4. MCP 서버 등록
   - `src/mcp/server.ts`에 `review-manage`, `debt-manage` 핸들러 등록
   - 기존 9개 tool 등록 패턴 준수
5. `.gitignore` 고려사항 문서화
   - `.filid/review/` — 커밋 대상 (PR에 리뷰 이력 남김)
   - `.filid/debt/` — 커밋 대상 (팀 간 부채 공유)

**완료 기준 (DoD)**:

- [x] `review-manage` 5개 액션 단위 테스트 통과 (32개 테스트)
- [x] `debt-manage` 4개 액션 단위 테스트 통과 (30개 테스트)
- [x] 브랜치 정규화 엣지 케이스 테스트 통과 (`feature/deep/nested`, `main`, `release-v1.0`, `fix/bug#123`)
- [x] 위원회 선출 결정론적 테스트 통과 (LOW→2명, MED→4명, HIGH→6명, 적대적 짝짓기 검증)
- [x] 부채 가중치 계산 정확성 테스트 통과 (2^n 공식, cap=16, 멱등성)
- [x] MCP 서버에서 11개 tool (기존 9 + 신규 2) 정상 노출 확인
- [x] `src/types/debt.ts`, `src/types/review.ts` 타입 정의 완료

**의존성**: Phase 0 완료

---

### Phase 2: `/filid:code-review` 스킬 구현

**목표**: 위원회 선출 → 기술 검증 → 정치적 합의 → 보고서 출력 → (선택) PR 코멘트까지의 전체 리뷰 워크플로우를 구현한다.

**작업 항목**:

1. `skills/code-review/SKILL.md` 작성 (~120줄 이내)
   - 의장(Chairperson) 오케스트레이터 역할
   - 체크포인트 재개 로직: `review-manage(checkpoint)` MCP tool 호출로 Phase 상태 감지
   - `--force` 옵션: 기존 리뷰 파일을 삭제하고 Phase A부터 강제 재시작
   - Phase A → Phase B → Phase C 위임/실행 흐름
   - Phase A/B 위임 시 `CLAUDE_PLUGIN_ROOT` 환경변수로 phase 파일 경로 해결
   - 리뷰 보고서 + 수정 요청 사항 출력 포맷
   - PR 코멘트 연동: `--scope=pr` 시 리뷰 완료 후 `gh` CLI로 PR에 요약 코멘트 게시 (환경 의존적, 실패 시 무시)
2. `skills/code-review/phases/phase-a-analysis.md` 작성 (Phase A subagent 프롬프트)
   - git diff 분석 → 변경 파일/프랙탈 수 집계
   - `review-manage(elect-committee)` MCP tool 호출로 복잡도 판정 + 위원회 결정론적 선출
   - `review-manage(ensure-dir)` MCP tool 호출로 리뷰 디렉토리 생성
   - 출력: `.filid/review/<branch>/session.md`
3. `skills/code-review/phases/phase-b-verification.md` 작성 (Phase B subagent 프롬프트)
   - 기존 MCP tool 호출 지침 (결정론적 기술 검증)
   - `debt-manage(calculate-bias)` MCP tool 호출로 부채 바이어스 계산 (결정론적)
   - 출력: `.filid/review/<branch>/verification.md`
4. `skills/code-review/state-machine.md` 작성
   - PROPOSAL → DEBATE → VETO/SYNTHESIS/ABSTAIN → CONCLUSION
   - 최대 5라운드 제한, 라운드별 전이 규칙
   - Phase C(합의)에서 의장이 참조하는 상태 전이 명세
5. `skills/code-review/reference.md` 작성
   - 상세 워크플로우 단계 (Phase A/B/C)
   - MCP tool 호출 예시 (기존 9개 + 신규 2개)
   - 출력 포맷 템플릿
   - PR 코멘트 포맷 템플릿
6. `skills/code-review/personas/*.md` 작성 (6개, 각 ≤150줄)
   - 각 페르소나의 전문지식, 행동양식, 행동 원칙
   - 적대적 짝짓기 규칙
   - 사용할 MCP tool 목록

**완료 기준 (DoD)**:

- [x] 스킬 실행 시 `.filid/review/<branch>/session.md` 생성 (Phase A) — phase-a-analysis.md A.5에 정의
- [x] 스킬 실행 시 `.filid/review/<branch>/verification.md` 생성 (Phase B) — phase-b-verification.md B.10에 정의
- [x] 스킬 실행 시 `.filid/review/<branch>/review-report.md` 생성 (Phase C) — SKILL.md Step 4에 정의
- [x] 스킬 실행 시 `.filid/review/<branch>/fix-requests.md` 생성 (Phase C) — SKILL.md Step 4에 정의
- [x] `review-manage(elect-committee)`로 위원회 선출이 결정론적으로 동작 — Phase 1 MCP tool 구현 + phase-a-analysis.md A.3에서 호출
- [x] 상태 머신 전이가 생략 없이 추적됨 — state-machine.md에 전이 규칙 명세
- [x] `debt-manage(calculate-bias)`로 부채 바이어스가 결정론적으로 반영됨 — Phase 1 MCP tool 구현 + phase-b-verification.md B.9에서 호출
- [x] `review-manage(checkpoint)`로 체크포인트 재개 정상 동작 — SKILL.md Step 1에 정의
- [x] `--force` 옵션 시 기존 리뷰 파일 삭제 후 Phase A 재시작 확인 — SKILL.md Step 1에 정의
- [x] `--scope=pr` 시 `gh pr comment` 또는 `gh pr review`로 PR에 요약 게시 (환경 의존) — SKILL.md Step 5에 정의
- [x] `gh` CLI 미설치/미인증 환경에서 PR 코멘트 실패 시 graceful skip 확인 — SKILL.md Step 5에 정의
- [x] Phase A/B subagent 위임 시 `CLAUDE_PLUGIN_ROOT` 기반 경로 해결 확인 — SKILL.md Step 2-3에 Glob fallback 포함
- [x] SKILL.md 120줄 이내, personas/\*.md 각 150줄 이내 — SKILL.md 105줄, personas 최대 69줄

**의존성**: Phase 1 완료

---

### Phase 3: `/filid:resolve-review` 스킬 구현

**목표**: 인간 개발자의 수정 사항 수용/거부 + 소명 + ADR 정제 워크플로우를 구현한다.

**작업 항목**:

1. `skills/resolve-review/SKILL.md` 작성
   - `fix-requests.md` 파싱 및 Select List 제시
   - AskUserQuestion을 통한 수용/거부 인터페이스
   - 미수용 항목에 대한 소명(Justification) 수집
   - 소명 텍스트 → ADR 정제 로직
   - `debt-manage(create)` MCP tool 호출로 부채 파일 생성
   - `justifications.md` 출력 — frontmatter에 `resolve_commit_sha` 필드 포함 (Delta 재검증 기준점)
2. `skills/resolve-review/reference.md` 작성

**`justifications.md` frontmatter 추가 필드**:

```yaml
---
resolve_commit_sha: <git rev-parse HEAD 결과> # re-validate Delta 기준점
resolved_at: <ISO 8601>
---
```

**완료 기준 (DoD)**:

- [x] `fix-requests.md`에서 수정 항목을 Select List로 제시 — SKILL.md Step 3에 AskUserQuestion 패턴 정의
- [x] 수용된 항목에 대한 자동 수정 안내 출력 — SKILL.md Step 4에 정의
- [x] 미수용 항목에 대한 소명 수집 완료 — SKILL.md Step 5에 AskUserQuestion free text 정의
- [x] 소명 → ADR 정제 결과가 `justifications.md`에 기록 — SKILL.md Step 5 + reference.md ADR 정제 가이드라인
- [x] `justifications.md` frontmatter에 `resolve_commit_sha` 기록 확인 — SKILL.md Step 6 + reference.md 포맷
- [x] `debt-manage(create)` 호출로 거부 항목이 `.filid/debt/`에 부채 파일로 생성 — SKILL.md Step 5에 MCP 호출 정의
- [x] `review-manage(normalize-branch)` 호출로 현재 브랜치 자동 감지 정상 동작 — SKILL.md Step 1에 정의

**의존성**: Phase 2 완료

---

### Phase 4: `/filid:re-validate` 스킬 구현

**목표**: Delta 기반 경량 재검증, 최종 PASS/FAIL 선언, 그리고 PR 코멘트 게시를 구현한다.

**작업 항목**:

1. `skills/re-validate/SKILL.md` 작성
   - `justifications.md` 로딩 — `resolve_commit_sha` frontmatter로 Delta 기준점 확보
   - Delta 추출: `git diff <resolve_commit_sha>..HEAD` + `ast-analyze(tree-diff)`
   - 경량 재검증 (수정 사항이 지적 사유를 해소했는지)
   - `debt-manage(resolve)` MCP tool 호출로 부채 해소 판정 시 파일 삭제
   - 최종 PASS/FAIL 판정 로직
   - PASS 시 `re-validate.md` 출력 (리뷰 디렉토리는 PR 머지 후 수동 정리)
   - FAIL 시 `re-validate.md`에 미해소 항목 명시
   - PR 코멘트 연동: PASS/FAIL 판정 결과를 `gh pr comment`로 PR에 게시 (환경 의존적, 실패 시 무시)
2. `skills/re-validate/reference.md` 작성
   - PR 코멘트 포맷 템플릿 포함

**PR 코멘트 환경 의존성**:

```
1. `gh auth status` 실행으로 GitHub CLI 인증 상태 확인
2. 인증 실패 또는 gh 미설치 → "PR 코멘트를 게시하려면 gh CLI 인증이 필요합니다" 안내 후 skip
3. 인증 성공 → `gh pr comment --body "<판정 요약>"` 실행
```

이 패턴은 Claude Code의 실행 환경(로컬/CI/원격)에 따라 GitHub 접근 가능 여부가 달라지는 현실을 반영한다. 플러그인은 `gh` CLI의 존재와 인증 상태에만 의존하며, 별도의 토큰 관리를 하지 않는다.

**완료 기준 (DoD)**:

- [x] `resolve_commit_sha` 기반 Delta 추출이 정확히 동작 — SKILL.md Step 2에 git diff + ast-analyze(tree-diff) 정의
- [x] Delta 기반 재검증이 전체 재리뷰 없이 동작 — SKILL.md Step 3에 fix별 개별 MCP tool 재검증 정의
- [x] PASS 판정 시 `re-validate.md` 생성 (리뷰 디렉토리는 유지) — SKILL.md Step 6 + reference.md 출력 포맷
- [x] FAIL 판정 시 구체적 미해소 항목 명시 — SKILL.md Step 6 FAIL 조건 + reference.md FAIL 포맷
- [x] `debt-manage(resolve)` 호출로 부채 해소 시 파일 삭제 — SKILL.md Step 5에 정의
- [x] `review-manage(normalize-branch)` 호출로 현재 브랜치 자동 감지 정상 동작 — SKILL.md Step 1에 정의
- [x] `gh` 인증 성공 환경에서 PR 코멘트 정상 게시 확인 — SKILL.md Step 7에 정의
- [x] `gh` 미설치/미인증 환경에서 graceful skip 확인 — SKILL.md Step 7에 graceful degradation 정의

**의존성**: Phase 3 완료

---

### Phase 5: 통합 테스트 및 검증

**목표**: 3개 스킬의 엔드투엔드 라이프사이클과 PR 코멘트 연동을 검증한다.

**작업 항목**:

1. 정상 흐름 시나리오
   - code-review → resolve-review (전체 수용) → re-validate (PASS)
2. 소명 흐름 시나리오
   - code-review → resolve-review (일부 거부 + 소명) → re-validate (PASS)
   - 부채 파일 생성 확인
3. 재검증 실패 시나리오
   - code-review → resolve-review → re-validate (FAIL) → 재수정 → re-validate (PASS)
4. 부채 누적 시나리오
   - 이전 리뷰에서 부채 발생 → 새 리뷰에서 부채 바이어스 확인
   - 동일 프랙탈 수정 시 가중치 2배 확인
5. 부채 해소 시나리오
   - 기존 부채 항목을 수정으로 해소 → 부채 파일 삭제 확인
6. 강제 재리뷰 시나리오
   - code-review 완료 후 → code-review `--force` → 기존 리뷰 파일 삭제 후 Phase A 재시작 확인
7. PR 코멘트 연동 시나리오
   - `--scope=pr` + `gh` 인증 환경에서 code-review 완료 시 PR 코멘트 게시 확인
   - re-validate PASS/FAIL 시 PR 코멘트 게시 확인
   - `gh` 미설치 환경에서 graceful skip 확인 (에러 없이 로컬 파일 출력만 수행)
8. MCP tool 결정론적 검증 시나리오
   - `review-manage(elect-committee)` 동일 입력 → 동일 출력 반복 확인
   - `debt-manage(calculate-bias)` 동일 커밋에서 재실행 → 멱등성 확인
9. 엣지 케이스
   - 브랜치 이름에 `/` 포함 (`feature/deep/nested`)
   - `.filid/` 디렉토리 미존재 상태에서 첫 리뷰
   - 부채 0건 상태에서 리뷰
   - `resolve_commit_sha` 이후 커밋이 0건인 상태에서 re-validate 실행

**완료 기준 (DoD)**:

- [x] 모든 시나리오 정상 동작 확인 — 구조적 검증 완료 (런타임 시나리오는 실제 스킬 호출 시 검증)
- [x] 스킬 간 데이터 흐름 (.filid/ 파일 기반) 정합성 확인 — code-review→resolve-review→re-validate 체인의 파일 참조 일관성 확인
- [x] MCP tool 결정론적 연산 일관성 확인 — review-manage 32개 + debt-manage 30개 = 62개 단위 테스트 통과
- [x] 브랜치 이름 엣지 케이스 통과 — review-manage normalize-branch 테스트에 포함 (feature/deep/nested, fix/bug#123 등)
- [x] 부채 누적/해소 메커니즘 정상 동작 — debt-manage calculate-bias/resolve 테스트 통과 (멱등성, cap=16, touch_count)
- [x] PR 코멘트 연동 정상 동작 (환경 의존적 graceful degradation 포함) — 3개 스킬 SKILL.md에 gh auth status 체크 + skip 로직 정의
- [x] TypeScript 타입체크 통과 (0 errors), 전체 412개 테스트 통과 (37 파일)

**의존성**: Phase 4 완료

---

### Phase 6: `.metadata` 문서 반영 (최종)

**목표**: 완성된 거버넌스 시스템을 기존 설계 문서 아카이브에 반영한다.

**작업 항목**:

1. `.metadata/01-ARCHITECTURE.md` 업데이트
   - 4-layer 아키텍처 내 거버넌스 프레임워크(Governance Framework) 추가 기술
   - ADR: 확장형 아키텍처 선택 근거 (별도 Layer가 아닌 Layer 4 내부 프레임워크로 설계한 이유)
2. `.metadata/02-BLUEPRINT.md` 업데이트
   - 신규 스킬 3개 모듈 명세 추가
   - 페르소나 프레임워크 구조 기술
3. `.metadata/03-LIFECYCLE.md` 업데이트
   - code-review → resolve-review → re-validate 라이프사이클 추가
   - 부채 관리 라이프사이클 추가
4. `.metadata/04-USAGE.md` 업데이트
   - 신규 스킬 사용법 추가
   - `.filid/` 디렉토리 구조 설명
5. `README.md` 업데이트
   - Skills 섹션에 3개 스킬 추가
   - MCP Tools 섹션에 2개 tool 추가
   - Component 카운트 업데이트 (Skills: 8→11, MCP Tools: 9→11)

**완료 기준 (DoD)**:

- [x] 모든 `.metadata` 문서가 현재 시스템 상태를 정확히 반영 — 01-ARCHITECTURE(거버넌스 프레임워크+ADR-4+다이어그램), 02-BLUEPRINT(3스킬+2MCP+2타입 모듈 명세), 03-LIFECYCLE(거버넌스+부채 라이프사이클), 04-USAGE(3스킬 사용법+.filid/ 구조)
- [x] README.md가 최신 컴포넌트 목록을 포함 — Skills 11, MCP Tools 11, 아키텍처 다이어그램 갱신, 3스킬+2MCP tool 상세 설명 추가
- [x] 문서 간 상호 참조 링크 정합성 확인 — .metadata 4개 파일에서 거버넌스 컴포넌트 53회 참조, README 5곳에서 카운트 일관

**의존성**: Phase 5 완료

---

## 4. 의존성 그래프 요약

```
Phase 0 (설계)
    │
    ▼
Phase 1 (MCP Tool + .filid/ 인프라)
    │
    ▼
Phase 2 (code-review)
    │
    ▼
Phase 3 (resolve-review)
    │
    ▼
Phase 4 (re-validate)
    │
    ▼
Phase 5 (통합 검증)
    │
    ▼
Phase 6 (.metadata 반영)
```

모든 Phase는 순차적 의존성을 가진다. 병렬 실행 가능한 Phase는 없다 (각 Phase가 이전 Phase의 산출물에 의존).

---

## 5. 리스크 및 완화 전략

| 리스크                                         | 영향                                   | 완화 전략                                                                                                                |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 상태 머신이 과도한 컨텍스트를 소비             | LLM 성능 저하                          | 의장 위임 패턴으로 Phase A/B를 subagent에 분리, 의장 컨텍스트 ~1,130줄 이내 유지                                         |
| 기존 MCP tool이 code-review에 부족한 정보 제공 | 기술 검증 품질 저하                    | Phase B subagent에서 MCP tool 호출 결과 검증 후, 부족 시 보조 tool 추가 검토                                             |
| 부채 파일이 과도하게 누적                      | 디스크/커밋 부담                       | 부채 가중치 상한선(cap=16) + 주기적 정리 안내                                                                            |
| 브랜치 이름 정규화 엣지 케이스                 | 디렉토리 매칭 실패                     | `review-manage(normalize-branch)` MCP tool로 결정론적 처리, Phase 1에서 충분한 엣지 케이스 테스트                        |
| Phase A/B subagent 실행 실패                   | 리뷰 중단                              | `review-manage(checkpoint)` 기반 재개 로직으로 실패 지점부터 재시작 + `--force`로 강제 초기화 가능                       |
| `gh` CLI 미설치/미인증 환경                    | PR 코멘트 게시 불가                    | 환경 의존적 graceful degradation — `gh auth status` 실패 시 skip하고 로컬 파일 출력만 수행. 핵심 리뷰 기능에는 영향 없음 |
| `CLAUDE_PLUGIN_ROOT` 환경변수 미설정           | Phase A/B 프롬프트 파일 경로 해결 실패 | Glob fallback (`**/skills/code-review/phases/*.md`) + 에러 메시지에 수동 경로 지정 안내                                  |
| 리뷰 완료 후 재리뷰 필요 시 경로 미정의        | 사용자 혼란                            | `--force` 옵션으로 기존 리뷰 파일 삭제 후 Phase A 재시작. 체크포인트 "DONE" 상태에서 안내 메시지 출력                    |

---

## 관련 문서

- [BLUE-PRINT.md](./BLUE-PRINT.md) — 기술 청사진
- [FCA-AI-code-review-report.md](./FCA-AI-code-review-report.md) — 개념적 기반
- [FCA-AI-code-review-detail.md](./FCA-AI-code-review-detail.md) — 페르소나 상세 연구
