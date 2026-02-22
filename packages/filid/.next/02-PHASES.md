# 구현 Phase 및 의존성 그래프

> 원본: PLAN.md §3-4 | 관련: [01-COMPONENTS.md](./01-COMPONENTS.md), [09-RISKS.md](./09-RISKS.md)

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
- [ ] `review-manage` 5개 액션 단위 테스트 통과
- [ ] `debt-manage` 4개 액션 단위 테스트 통과
- [ ] 브랜치 정규화 엣지 케이스 테스트 통과 (`feature/deep/nested`, `main`, `release-v1.0`, `fix/bug#123`)
- [ ] 위원회 선출 결정론적 테스트 통과 (LOW→2명, MED→4명, HIGH→6명, 적대적 짝짓기 검증)
- [ ] 부채 가중치 계산 정확성 테스트 통과 (2^n 공식, cap=16, 멱등성)
- [ ] MCP 서버에서 11개 tool (기존 9 + 신규 2) 정상 노출 확인
- [ ] `src/types/debt.ts`, `src/types/review.ts` 타입 정의 완료

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
- [ ] 스킬 실행 시 `.filid/review/<branch>/session.md` 생성 (Phase A)
- [ ] 스킬 실행 시 `.filid/review/<branch>/verification.md` 생성 (Phase B)
- [ ] 스킬 실행 시 `.filid/review/<branch>/review-report.md` 생성 (Phase C)
- [ ] 스킬 실행 시 `.filid/review/<branch>/fix-requests.md` 생성 (Phase C)
- [ ] `review-manage(elect-committee)`로 위원회 선출이 결정론적으로 동작
- [ ] 상태 머신 전이가 생략 없이 추적됨
- [ ] `debt-manage(calculate-bias)`로 부채 바이어스가 결정론적으로 반영됨
- [ ] `review-manage(checkpoint)`로 체크포인트 재개 정상 동작
- [ ] `--force` 옵션 시 기존 리뷰 파일 삭제 후 Phase A 재시작 확인
- [ ] `--scope=pr` 시 `gh pr comment` 또는 `gh pr review`로 PR에 요약 게시 (환경 의존)
- [ ] `gh` CLI 미설치/미인증 환경에서 PR 코멘트 실패 시 graceful skip 확인
- [ ] Phase A/B subagent 위임 시 `CLAUDE_PLUGIN_ROOT` 기반 경로 해결 확인
- [ ] SKILL.md 120줄 이내, personas/*.md 각 150줄 이내

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
resolve_commit_sha: <git rev-parse HEAD 결과>  # re-validate Delta 기준점
resolved_at: <ISO 8601>
---
```

**완료 기준 (DoD)**:
- [ ] `fix-requests.md`에서 수정 항목을 Select List로 제시
- [ ] 수용된 항목에 대한 자동 수정 안내 출력
- [ ] 미수용 항목에 대한 소명 수집 완료
- [ ] 소명 → ADR 정제 결과가 `justifications.md`에 기록
- [ ] `justifications.md` frontmatter에 `resolve_commit_sha` 기록 확인
- [ ] `debt-manage(create)` 호출로 거부 항목이 `.filid/debt/`에 부채 파일로 생성
- [ ] `review-manage(normalize-branch)` 호출로 현재 브랜치 자동 감지 정상 동작

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
- [ ] `resolve_commit_sha` 기반 Delta 추출이 정확히 동작
- [ ] Delta 기반 재검증이 전체 재리뷰 없이 동작
- [ ] PASS 판정 시 `re-validate.md` 생성 (리뷰 디렉토리는 유지)
- [ ] FAIL 판정 시 구체적 미해소 항목 명시
- [ ] `debt-manage(resolve)` 호출로 부채 해소 시 파일 삭제
- [ ] `review-manage(normalize-branch)` 호출로 현재 브랜치 자동 감지 정상 동작
- [ ] `gh` 인증 성공 환경에서 PR 코멘트 정상 게시 확인
- [ ] `gh` 미설치/미인증 환경에서 graceful skip 확인

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
- [ ] 모든 시나리오 정상 동작 확인
- [ ] 스킬 간 데이터 흐름 (.filid/ 파일 기반) 정합성 확인
- [ ] MCP tool 결정론적 연산 일관성 확인
- [ ] 브랜치 이름 엣지 케이스 통과
- [ ] 부채 누적/해소 메커니즘 정상 동작
- [ ] PR 코멘트 연동 정상 동작 (환경 의존적 graceful degradation 포함)

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
- [ ] 모든 `.metadata` 문서가 현재 시스템 상태를 정확히 반영
- [ ] README.md가 최신 컴포넌트 목록을 포함
- [ ] 문서 간 상호 참조 링크 정합성 확인

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
