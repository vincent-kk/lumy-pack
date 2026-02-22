# 출력 포맷 및 데이터 저장소

> 원본: BLUE-PRINT.md §6-7 | 관련: [04-SKILL-INTERFACES.md](./04-SKILL-INTERFACES.md), [08-DEBT-SYSTEM.md](./08-DEBT-SYSTEM.md)

## 6. 리뷰 보고서 / 수정 요청 사항 출력 포맷

### 6.1 리뷰 보고서 (`review-report.md`)

```markdown
# Code Review Report — <branch name>

**Date**: <ISO 8601>
**Scope**: <branch|pr|commit>
**Base**: <base ref>
**Verdict**: APPROVED | REQUEST_CHANGES | INCONCLUSIVE

## 위원회 구성

| 페르소나            | 선출 근거                          | 최종 입장        |
| ------------------- | ---------------------------------- | ---------------- |
| 엔지니어링 아키텍트 | LCOM4 검증 필요 (클래스 변경 감지) | SYNTHESIS        |
| 지식 관리자         | CLAUDE.md 변경 감지                | SYNTHESIS        |
| 비즈니스 드라이버   | 기능 추가 PR                       | SYNTHESIS        |
| 운영/SRE            | 보안 관련 코드 변경                | VETO → SYNTHESIS |

## 기술 검증 결과

### FCA-AI 구조 검증

| 검증 항목      | 결과 | 상세                                        |
| -------------- | ---- | ------------------------------------------- |
| 프랙탈 경계    | PASS | 모든 변경이 올바른 프랙탈 내                |
| CLAUDE.md 규정 | WARN | src/auth/CLAUDE.md — 95줄 (한도 100줄)      |
| 3+12 규칙      | FAIL | src/auth/auth.spec.ts — 18 케이스 (한도 15) |
| LCOM4          | FAIL | src/auth/validator.ts — LCOM4=3 (한도 2)    |
| CC             | PASS | 최대 CC=12 (한도 15)                        |
| 순환 의존성    | PASS | 사이클 없음                                 |
| 구조 드리프트  | PASS | 드리프트 없음                               |

### 부채 현황

| 기존 부채 수 | 이번 PR 관련 부채             | 가중치 합계 |
| ------------ | ----------------------------- | ----------- |
| 3건          | 1건 (src/auth 관련, 가중치 2) | 5.0         |

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

````markdown
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
````

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

````

### 6.3 소명 기록 (`justifications.md`)

```markdown
---
resolve_commit_sha: <git rev-parse HEAD 결과>
resolved_at: <ISO 8601>
---

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
````

### 6.4 재검증 결과 (`re-validate.md`)

```markdown
# Re-validation Result — <branch name>

**Date**: <ISO 8601>
**Verdict**: PASS | FAIL

## Delta 분석

| 파일                       | 변경 유형               | 관련 Fix     |
| -------------------------- | ----------------------- | ------------ |
| src/auth/auth.spec.ts      | modified (18→12 케이스) | FIX-001 해소 |
| src/auth/auth-edge.spec.ts | added (6 케이스)        | FIX-001 해소 |

## 검증 결과

| Fix ID  | 상태               | 상세                                              |
| ------- | ------------------ | ------------------------------------------------- |
| FIX-001 | ✅ RESOLVED        | spec.ts가 12케이스, edge.spec.ts가 6케이스로 분할 |
| FIX-002 | ⏳ DEFERRED (부채) | 소명 수용됨, 부채 발행 완료                       |

## 부채 변동

| 변동 | 부채 파일                    | 상세            |
| ---- | ---------------------------- | --------------- |
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

| 파일                           | 변경 유형 | 프랙탈            | 줄 수 변경 |
| ------------------------------ | --------- | ----------------- | ---------- |
| src/features/auth/validator.ts | modified  | src/features/auth | +45 -12    |
| ...                            |           |                   |            |

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

| 검증 항목      | 결과           | 상세 |
| -------------- | -------------- | ---- |
| 프랙탈 경계    | PASS/WARN/FAIL | ...  |
| CLAUDE.md 규정 | PASS/WARN/FAIL | ...  |
| 3+12 규칙      | PASS/WARN/FAIL | ...  |
| LCOM4          | PASS/WARN/FAIL | ...  |
| CC             | PASS/WARN/FAIL | ...  |
| 순환 의존성    | PASS/WARN/FAIL | ...  |
| 구조 드리프트  | PASS/WARN/FAIL | ...  |

## 부채 현황

| 기존 부채 수 | 이번 PR 관련 부채           | 가중치 합계 | 바이어스 수준   |
| ------------ | --------------------------- | ----------- | --------------- |
| N건          | M건 (관련 프랙탈, 가중치 X) | Y           | <바이어스 수준> |

### 관련 부채 목록

| ID  | 프랙탈 경로 | 규칙 위반 | 가중치 | 생성일 |
| --- | ----------- | --------- | ------ | ------ |
| ... |             |           |        |        |
```

**필수 frontmatter 필드**: `session_ref`, `all_passed`, `critical_failures`, `debt_bias_level`, `created_at`

### 7.3 브랜치 이름 정규화 규칙

| 원본 브랜치 이름           | 정규화 결과                   | 규칙                                   |
| -------------------------- | ----------------------------- | -------------------------------------- |
| `feature/issue-6`          | `feature--issue-6`            | `/` → `--`                             |
| `feature/deep/nested/path` | `feature--deep--nested--path` | 모든 `/` → `--`                        |
| `main`                     | `main`                        | 변환 없음                              |
| `release-v1.0`             | `release-v1.0`                | 변환 없음                              |
| `fix/bug#123`              | `fix--bug_123`                | `/` → `--`, `#` → `_`                  |
| `user@feature`             | `user_feature`                | `@` → `_`                              |
| `feature/--special`        | `feature----special`          | `/` → `--`, 연속 `--` 유지 (충돌 방지) |

**정규화 규칙**:

1. `/` → `--` (가장 핵심, 디렉토리 구분자 충돌 방지)
2. `#`, `@`, `~`, `^`, `:`, `?`, `*`, `[`, `]`, `\` → `_` (파일시스템 안전 문자)
3. 선행/후행 `.`, `-` 제거

> **Note**: 연속 `--`는 축약하지 않는다. `feature/--special` → `feature----special`로 유지하여 `feature/special`(`feature--special`)과의 충돌을 방지한다. 디렉토리 이름이 다소 길어질 수 있으나 고유성이 우선이다.

**역정규화**: 불필요. `resolve-review`와 `re-validate`는 `git branch --show-current` 결과를 정규화하여 디렉토리를 매칭하므로 역변환이 필요 없음.

### 7.4 라이프사이클 자동 정리

| 트리거             | 동작                                         | 메커니즘                         |
| ------------------ | -------------------------------------------- | -------------------------------- |
| `re-validate` PASS | 유지 (PR에 리뷰 이력 보존)                   | —                                |
| `re-validate` FAIL | 유지 (재수정 후 재검증 필요)                 | —                                |
| PR 머지 후         | `.filid/review/<branch>/` 디렉토리 삭제      | **수동** (개발자가 머지 후 정리) |
| 브랜치 삭제 후     | `.filid/review/<branch>/` 디렉토리 잔존 가능 | **수동** 정리 또는 `--gc`        |

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
