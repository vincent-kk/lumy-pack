# 컴포넌트 영향 분석 및 신규 컴포넌트

> 원본: PLAN.md §1-2 | 관련: [03-ARCHITECTURE.md](./03-ARCHITECTURE.md), [06-MCP-TOOLS.md](./06-MCP-TOOLS.md)

## 1. 기존 컴포넌트 영향 분석 (중복 방지 맵)

### 1.1 재사용 대상

| 기존 컴포넌트 | 유형 | code-review 거버넌스에서의 역할 | 재사용 방식 |
|---|---|---|---|
| `fractal-architect` | agent (RO, opus) | 엔지니어링 아키텍트 — 구조 분석, LCOM4/CC, split/compress 진단 | Phase B subagent가 MCP tool 호출로 동일 분석 수행 |
| `qa-reviewer` | agent (RO, sonnet) | 엔지니어링 아키텍트 — 6-stage 규칙 검증, 3+12 규칙 | Phase B subagent가 MCP tool 호출로 동일 검증 수행 |
| `context-manager` | agent (sonnet) | 지식 관리자 — CLAUDE.md/SPEC.md 무결성 검증 | Phase B subagent가 MCP tool 호출로 문서 검증 수행 |
| `drift-analyzer` | agent (RO, sonnet) | 지식 관리자 — 구조 드리프트 감지 | Phase B subagent가 MCP tool 호출로 드리프트 분석 수행 |
| `ast-analyze` | MCP tool | LCOM4, CC, dependency-graph, tree-diff 분석 | Phase B subagent가 호출 |
| `test-metrics` | MCP tool | 3+12 규칙 검증, test count, decision tree | Phase B subagent가 호출 |
| `fractal-navigate` | MCP tool | 프랙탈 구조 탐색, 디렉토리 분류 | Phase B subagent가 호출 |
| `structure-validate` | MCP tool | 구조 규칙 위반 검증 | Phase B subagent가 호출 |
| `drift-detect` | MCP tool | 구조 드리프트 감지 | Phase B subagent가 호출 |
| `fractal-scan` | MCP tool | 프로젝트 전체 프랙탈 트리 빌드 | Phase B subagent가 호출 |
| `rule-query` | MCP tool | 활성 규칙 조회 | Phase B subagent가 호출 |
| `doc-compress` | MCP tool | 문서 압축 상태 검증 | Phase B subagent가 호출 |
| `lca-resolve` | MCP tool | 최저 공통 조상 해결 | Phase B subagent가 호출 |

### 1.2 영향 없음 (변경 불필요)

| 컴포넌트 | 유형 | 이유 |
|---|---|---|
| `implementer` | agent | 코드 구현 전담 — 리뷰 거버넌스와 무관 |
| `restructurer` | agent | 구조 변경 실행 전담 — 리뷰 거버넌스와 무관 |
| `pre-tool-validator` | hook | 기존 Write/Edit 검증 유지 |
| `structure-guard` | hook | 기존 organ 보호 유지 |
| `agent-enforcer` | hook | 기존 에이전트 역할 제한 유지 |
| `context-injector` | hook | 기존 FCA-AI 규칙 주입 유지 |
| 기존 8개 skills | skill | 각각 독립 워크플로우 유지 |

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

| 스킬 | 디렉토리 | 라이프사이클 | 설명 |
|---|---|---|---|
| `/filid:code-review` | `skills/code-review/` | Phase A→B→C | 의장 위임 패턴: Phase A(분석, haiku) → Phase B(검증, sonnet) → Phase C(합의, 의장 직접) |
| `/filid:resolve-review` | `skills/resolve-review/` | Phase 4 | 수정 사항 선택적 수용 + 소명 + ADR 정제 + 부채 기록 |
| `/filid:re-validate` | `skills/re-validate/` | Phase 5 | Delta 재검증 → PASS/FAIL → 디렉토리 정리 |

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

| MCP Tool | 설명 | 설계 근거 |
|---|---|---|
| `review-manage` | 리뷰 세션 관리 — 브랜치 정규화, 디렉토리 CRUD, 체크포인트 감지, 위원회 선출 | 브랜치 정규화(`/`→`--`, 특수문자 이스케이핑)와 위원회 선출(복잡도 판정 + 적대적 짝짓기)은 조건부 규칙이 복잡하여 LLM 추론에 일관성이 보장되지 않음 |
| `debt-manage` | 부채 관리 — CRUD, 가중치 계산, 바이어스 수준 판정, touch_count 업데이트 | 가중치 공식(`base × 2^touch_count`, cap=16)과 멱등성 보호(`last_review_commit` 비교)는 결정론적 연산이므로 코드로 보장 |

##### `review-manage` 액션

| Action | 입력 | 출력 | 용도 |
|---|---|---|---|
| `normalize-branch` | `branchName: string` | `normalized: string` | 브랜치 이름 → 디렉토리 안전 문자열 |
| `ensure-dir` | `branchName: string` | `path: string, created: boolean` | `.filid/review/<branch>/` 생성 |
| `checkpoint` | `branchName: string` | `phase: "A"\|"B"\|"C"\|"DONE", files: string[]` | 체크포인트 상태 감지 |
| `elect-committee` | `changedFilesCount: number, changedFractalsCount: number, hasInterfaceChanges: boolean` | `complexity: string, committee: string[], adversarialPairs: string[][]` | 복잡도 판정 + 위원회 결정론적 선출 |
| `cleanup` | `branchName: string` | `deleted: boolean` | 리뷰 디렉토리 삭제 |

##### `debt-manage` 액션

| Action | 입력 | 출력 | 용도 |
|---|---|---|---|
| `create` | `debtItem: DebtItem` | `filePath: string, id: string` | 부채 파일 생성 |
| `list` | `fractalPath?: string` | `debts: DebtItem[], totalWeight: number` | 전체 또는 특정 프랙탈 부채 목록 |
| `resolve` | `debtId: string` | `deleted: boolean` | 부채 해소 시 파일 삭제 |
| `calculate-bias` | `debts: DebtItem[], changedFractalPaths: string[], currentCommitSha: string` | `biasLevel: string, totalScore: number, updatedDebts: DebtItem[]` | 가중치 갱신 + 바이어스 수준 판정 (멱등성 보호 포함) |

### 2.4 Hooks (0개 신규)

사용자 실행 기반(`/filid:code-review` 명시적 호출)이므로 자동 실행 hook이 불필요하다.

### 2.5 페르소나 정의 파일 (6개 신규)

`skills/code-review/personas/` 하위에 페르소나별 프레임워크 문서를 배치:

| 파일 | 페르소나 | 근거 |
|---|---|---|
| `engineering-architect.md` | 엔지니어링 아키텍트 | LCOM4/CC 기반 구조 진단, 3+12 규칙, SRP |
| `knowledge-manager.md` | 지식 관리자 | CLAUDE.md/SPEC.md 무결성, ACL, 드리프트 |
| `operations-sre.md` | 운영/SRE | 폭발 반경, 오류 예산, 보안, 안정성 |
| `business-driver.md` | 비즈니스 드라이버 | 지연 비용, MVP, 기술 부채 발행 |
| `product-manager.md` | 프로덕트 매니저 | 4대 리스크, 문제 정의, 충실도 |
| `design-hci.md` | 디자인/HCI | 밀러의 법칙, 닐슨 휴리스틱, 인지 부하 |

이 파일들은 Phase C(합의)에서 의장이 선출된 페르소나의 프레임워크만 지연 로딩(lazy loading)한다. Phase A는 위원회 선출만 수행하고, 실제 페르소나 파일 로딩은 Phase C에서 발생하여 컨텍스트를 최소화한다.

### 2.6 Phase 분할 파일 및 상태 머신 (3개 신규)

`skills/code-review/` 하위에 의장 위임 패턴을 위한 Phase 분할 파일과 상태 머신 명세를 배치:

| 파일 | 역할 | 설명 |
|---|---|---|
| `phases/phase-a-analysis.md` | Phase A subagent 프롬프트 | git diff 분석, `review-manage(elect-committee)` 호출로 결정론적 위원회 선출 → `session.md` 출력 |
| `phases/phase-b-verification.md` | Phase B subagent 프롬프트 | 기존 MCP tool 호출(결정론적 검증) + `debt-manage(calculate-bias)` 호출 → `verification.md` 출력 |
| `state-machine.md` | 상태 머신 명세 | PROPOSAL → DEBATE → VETO/SYNTHESIS/ABSTAIN → CONCLUSION (최대 5라운드) |

### 2.7 중간 산출물 스키마 (2개 신규)

`.filid/review/<branch>/` 하위에 Phase 간 데이터 전달을 위한 중간 산출물:

| 파일 | 생성 주체 | 소비 주체 | 설명 |
|---|---|---|---|
| `session.md` | Phase A subagent | 의장 (Phase C) | 브랜치, 복잡도, 위원회 구성, 변경 프랙탈 목록, 생성 시각 |
| `verification.md` | Phase B subagent | 의장 (Phase C) | 전체 통과 여부, 치명적 실패 목록, 부채 바이어스 수준 |
