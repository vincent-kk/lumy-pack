# 스킬 입출력 인터페이스 및 파일 구조

> 원본: BLUE-PRINT.md §3, §10 | 관련: [03-ARCHITECTURE.md](./03-ARCHITECTURE.md), [05-GOVERNANCE.md](./05-GOVERNANCE.md)

---

## 3. 3개 스킬 입출력 인터페이스 명세

### 3.1 `/filid:code-review`

#### 호출 인터페이스

```
/filid:code-review [--scope=branch|pr|commit] [--base=<ref>] [--force] [--verbose]
```

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `--scope` | `branch\|pr\|commit` | `branch` | 리뷰 범위 |
| `--base` | string | merge-base 자동 감지 | 비교 기준 ref |
| `--force` | flag | off | 기존 리뷰 파일 삭제 후 Phase A 강제 재시작 |
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
| PR 코멘트 (선택) | GitHub PR 코멘트 | `--scope=pr` 시 `gh` CLI로 리뷰 요약 게시 (환경 의존적, 실패 시 skip) |

#### 내부 워크플로우 — 의장-위임 패턴

```
Phase A: 분석 및 위원회 선출 (위임 → Task agent, haiku)
  A.1 git diff 수집 (Bash)
  A.2 변경 파일의 프랙탈 경로 식별 (fractal-navigate)
  A.3 `review-manage(elect-committee)` MCP tool 호출로 복잡도 판정 + 위원회 결정론적 선출
  A.4 `review-manage(ensure-dir)` MCP tool 호출로 리뷰 디렉토리 생성
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
  B.9 `debt-manage(calculate-bias)` MCP tool 호출로 기존 부채 로딩 + 바이어스 수준 결정론적 판정
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
1. 현재 브랜치 감지 → `review-manage(normalize-branch)` 호출 → .filid/review/<branch>/ 탐색
2. fix-requests.md 파싱 → 수정 항목 목록 추출
3. AskUserQuestion으로 Select List 제시
   - 각 항목에 대해 수용(✅) / 거부(❌) 선택
4. 수용된 항목:
   - 자동 수정 코드 패치 적용 안내 (직접 적용 또는 수동 적용)
5. 거부된 항목:
   - 각 항목에 대해 AskUserQuestion으로 소명 텍스트 수집
   - 소명 → ADR 정제 (지식 관리자 페르소나 프레임워크 활용)
   - `debt-manage(create)` MCP tool 호출로 .filid/debt/ 하위에 부채 파일 생성
6. justifications.md 출력 — frontmatter에 `resolve_commit_sha` 포함 (Delta 재검증 기준점)
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
| 소명 기록 | `.filid/review/<branch>/justifications.md` (Read) | 소명 내용 + `resolve_commit_sha` (Delta 기준점) 참조 |
| 코드 변경분 | `git diff <resolve_commit_sha>..HEAD` (Bash) + `ast-analyze(tree-diff)` (MCP) | Delta 추출 |

#### 출력

| 출력 파일 | 경로 | 내용 |
|---|---|---|
| 재검증 결과 | `.filid/review/<branch>/re-validate.md` | PASS/FAIL + 상세 판정 |
| PR 코멘트 (선택) | GitHub PR 코멘트 | PASS/FAIL 판정 결과를 `gh` CLI로 PR에 게시 (환경 의존적, 실패 시 skip) |

#### 내부 워크플로우

```
1. 현재 브랜치 감지 → `review-manage(normalize-branch)` 호출 → .filid/review/<branch>/ 탐색
2. 기존 리뷰 파일 로딩 (review-report, fix-requests, justifications)
3. 코드 변경분(Delta) 추출
   - `justifications.md`의 `resolve_commit_sha` frontmatter로 Delta 기준점 확보
   - `git diff <resolve_commit_sha>..HEAD` + `ast-analyze(tree-diff)`로 의미론적 변경 분석
4. 경량 재검증
   - 수용된 수정 사항이 원래 지적을 해소했는지 확인
   - 소명이 시스템 헌법에 치명적으로 위배되지 않는지 확인
   - 신규 위반 사항 도입 여부 확인
5. 부채 해소 판정
   - 수정 사항 중 기존 .filid/debt/ 항목을 해소하는 것이 있는지 확인
   - `debt-manage(resolve)` MCP tool 호출로 해소된 부채 파일 삭제
6. 최종 판정
   - PASS: re-validate.md 생성 (리뷰 디렉토리는 유지 — PR 머지 후 수동 정리)
   - FAIL: re-validate.md에 미해소 항목 명시
7. PR 코멘트 (환경 의존적)
   - `gh auth status`로 GitHub CLI 인증 상태 확인
   - 인증 성공 시 `gh pr comment`로 PASS/FAIL 판정 결과 게시
   - 인증 실패 또는 `gh` 미설치 시 skip (로컬 파일 출력만 수행)
```

---

## 10. 스킬 파일 구조 명세

### 10.1 `code-review` 스킬 디렉토리

```
skills/code-review/
├── SKILL.md                          # 의장 오케스트레이터 (~120줄)
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
| `SKILL.md` | **120줄** | 오케스트레이션 + 체크포인트 재개 + `--force` + PR 코멘트 로직 포함 |
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
              ${CLAUDE_PLUGIN_ROOT}/skills/code-review/phases/phase-a-analysis.md

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
              ${CLAUDE_PLUGIN_ROOT}/skills/code-review/phases/phase-b-verification.md

              실행 컨텍스트:
              - 리뷰 디렉토리: .filid/review/<정규화된 브랜치명>/
              - 입력: session.md (리뷰 디렉토리에서 Read)
              - 출력: verification.md를 리뷰 디렉토리에 Write"
  )
```

> **Note**: `CLAUDE_PLUGIN_ROOT`는 Claude Code가 플러그인 설치 시 자동 설정하는 환경변수이다. 미설정 시 Glob fallback(`**/skills/code-review/phases/*.md`)으로 탐색한다.
