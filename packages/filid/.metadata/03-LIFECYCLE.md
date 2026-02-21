# 03. 플러그인 라이프사이클 & 워크플로우

> 6개 스킬 기반 라이프사이클 단계, 에이전트 협업 시퀀스, Hook 이벤트 타임라인.

---

## 라이프사이클 개요

```
┌──────┐    ┌──────┐    ┌──────┐    ┌────────┐    ┌─────────┐    ┌───────┐
│ /init │───→│ /scan │───→│ /sync │───→│ /review │───→│ /promote │───→│ /query │
│      │    │      │    │      │    │        │    │         │    │       │
│ 초기화 │    │ 검증  │    │ 동기화 │    │ PR 리뷰 │    │ 테스트   │    │ 질의   │
│      │    │      │    │      │    │        │    │ 승격     │    │       │
└──────┘    └──────┘    └──────┘    └────────┘    └─────────┘    └───────┘
  1회성       수시        PR 시점     PR 시점      안정화 후      수시
```

---

## 단계 1: /init — 프로젝트 초기화

### 트리거 조건
- 프로젝트에 FCA-AI 구조가 없을 때 (최초 1회)
- 사용자가 `/init [path]` 명령 실행

### 관여 에이전트
- **architect** (주도): 디렉토리 분석 및 프랙탈 경계 설계
- **context-manager** (보조): CLAUDE.md/SPEC.md 생성

### 사용 MCP 도구
- `fractal-navigate` (action: `tree`): 전체 계층 구조 스캔
- `fractal-navigate` (action: `classify`): 개별 디렉토리 분류

### 워크플로우

```
1. 디렉토리 트리 스캔
   fractal-navigate(action: 'tree', entries: [...])
       │
       ▼
2. 각 디렉토리 분류
   ├── CLAUDE.md 존재 → fractal (유지)
   ├── Organ 패턴 매칭 → organ (CLAUDE.md 생성 안 함)
   ├── 사이드이펙트 없음 → pure-function
   └── 기본 → fractal (CLAUDE.md 생성 필요)
       │
       ▼
3. fractal 디렉토리에 CLAUDE.md 생성
   - 100줄 이내
   - 3-tier 경계 섹션 포함 (Always do / Ask first / Never do)
   - 프로젝트 구조 및 명령어 기록
       │
       ▼
4. 필요 시 SPEC.md 생성
   - 모듈의 기능 요구사항
   - API 인터페이스 정의
       │
       ▼
5. 초기화 요약 보고
   - 스캔된 디렉토리 수
   - 생성된 CLAUDE.md 수
   - 경고/이슈
```

### 입출력
- **입력**: 대상 디렉토리 경로 (기본: cwd)
- **출력**: 초기화 보고서 (디렉토리 수, 생성 파일 수, 경고)

---

## 단계 2: /scan — 규칙 위반 검출

### 트리거 조건
- 개발 중 수시로 실행
- 사용자가 `/scan [path] [--fix]` 명령 실행

### 관여 에이전트
- **qa-reviewer** (주도): 규칙 위반 검출 및 보고
- **context-manager** (--fix 시): 자동 수정 가능한 위반 해결

### 사용 MCP 도구
- `fractal-navigate` (action: `tree`): 프로젝트 구조 스캔
- `test-metrics` (action: `check-312`): 3+12 규칙 검사

### 워크플로우

```
1. 프로젝트 트리 구축
   fractal-navigate(action: 'tree')
       │
       ▼
2. CLAUDE.md 검증
   각 fractal 노드의 CLAUDE.md에 대해:
   ├── 100줄 초과 검사
   └── 3-tier 경계 섹션 존재 검사
       │
       ▼
3. Organ 디렉토리 검증
   각 organ 노드에 대해:
   └── CLAUDE.md 존재 여부 검사 (있으면 위반)
       │
       ▼
4. 테스트 파일 검증
   test-metrics(action: 'check-312', files: [...])
   └── spec.ts 파일별 15 케이스 초과 검사
       │
       ▼
5. 위반 보고서 생성
   - 총 검사 수
   - 위반 수 (severity별)
   - 자동 수정 가능 수 (--fix 시 실행)
```

---

## 단계 3: /sync — 코드 변경 → 문서 동기화

### 트리거 조건
- PR 생성 시점 (매 커밋이 아닌 PR 단위)
- 사용자가 `/sync [--dry-run]` 명령 실행

### 관여 에이전트
- **context-manager** (주도): 문서 갱신
- **architect** (보조): 구조 변경 시 자문

### 사용 MCP 도구
- `doc-compress` (mode: `auto`): 문서 줄 수 초과 시 압축
- `fractal-navigate` (action: `tree`): 영향 받는 모듈 파악

### 워크플로우

```
1. 변경 큐 소비
   ChangeQueue.drain() → ChangeRecord[]
   (PostToolUse hook으로 누적된 변경 이력)
       │
       ▼
2. 영향 프랙탈 식별
   ChangeQueue.getAffectedFractals()
   → 변경 파일의 부모 디렉토리들 (중복 제거)
       │
       ▼
3. 모듈별 변경 그룹화
   ChangeQueue.getChangesByPath()
   → Map<filePath, ChangeRecord[]>
       │
       ▼
4. CLAUDE.md 갱신 필요성 판단
   각 영향 프랙탈에 대해:
   ├── 새 export 추가/제거 → 구조 섹션 갱신
   ├── 의존성 변경 → dependencies 갱신
   └── 100줄 제한 접근 → doc-compress로 압축
       │
       ▼
5. SPEC.md 갱신 (해당 시)
   - 기능 요구사항 변경 반영
   - append-only 금지 → 재구조화
       │
       ▼
6. 검증
   갱신된 모든 문서에 validateClaudeMd/validateSpecMd 실행
```

### 동기화 시점이 PR인 이유

- 매 커밋마다 동기화하면 에이전트 오버헤드 과다
- PR 시점 = 코드 리뷰 시점 → 문서 정확성이 가장 중요한 순간
- ChangeQueue로 중간 변경을 누적 → 배치 처리로 효율성 확보

---

## 단계 4: /review — 6단계 PR 검증 파이프라인

### 트리거 조건
- PR 제출 시
- 사용자가 `/review [--stage=1-6] [--verbose]` 명령 실행

### 관여 에이전트
- **qa-reviewer** (주도): 전체 파이프라인 실행
- **architect** (Stage 1, 5 보조): 구조/의존성 검증

### 사용 MCP 도구
- `fractal-navigate`: Stage 1 (구조), Stage 5 (의존성)
- `test-metrics`: Stage 3 (테스트), Stage 4 (메트릭)
- `doc-compress`: Stage 2 (문서 크기 검사)

### 6단계 파이프라인

```
┌─ Stage 1: Structure ─────────────────────────┐
│ fractal/organ 경계 준수 검증                    │
│ - 모든 fractal에 CLAUDE.md 존재?               │
│ - organ 디렉토리에 CLAUDE.md 없음?              │
│ - 분류가 올바른지?                              │
└──────────────────────────────────────────────┘
         │ pass/fail
         ▼
┌─ Stage 2: Documents ─────────────────────────┐
│ CLAUDE.md/SPEC.md 규정 준수 검증                │
│ - CLAUDE.md: 100줄 제한 + 3-tier 경계          │
│ - SPEC.md: append-only 패턴 없음               │
│ - 문서-코드 동기화 상태                          │
└──────────────────────────────────────────────┘
         │ pass/fail
         ▼
┌─ Stage 3: Tests ─────────────────────────────┐
│ 3+12 규칙 + 테스트 커버리지 검증                 │
│ - spec.ts별 15 케이스 이내?                     │
│ - basic/complex 분포 적절?                      │
│ - 테스트 커버리지 충분?                          │
└──────────────────────────────────────────────┘
         │ pass/fail
         ▼
┌─ Stage 4: Metrics ───────────────────────────┐
│ LCOM4 + CC 메트릭 분석                          │
│ - LCOM4 >= 2인 모듈 → split 권고               │
│ - CC > 15인 함수 → compress 권고               │
│ - 의사결정 트리 결과 보고                        │
└──────────────────────────────────────────────┘
         │ pass/fail
         ▼
┌─ Stage 5: Dependencies ──────────────────────┐
│ 순환 의존성 검증                                │
│ - DAG 구축 + detectCycles()                    │
│ - 순환 발견 시 경로 보고                         │
│ - 위상 정렬 가능 여부 확인                       │
└──────────────────────────────────────────────┘
         │ pass/fail
         ▼
┌─ Stage 6: Summary ───────────────────────────┐
│ 종합 보고서 생성                                │
│ - 단계별 pass/fail 상태                         │
│ - 발견된 이슈 목록 (severity별)                  │
│ - 실행 가능한 권고사항                           │
│ - 전체 PASS/FAIL 판정                           │
└──────────────────────────────────────────────┘
```

---

## 단계 5: /promote — 테스트 승격

### 트리거 조건
- 안정화 기간(90일) 경과 후
- 사용자가 `/promote [path] [--days=90]` 명령 실행

### 관여 에이전트
- **qa-reviewer** (분석): 승격 후보 식별
- **implementer** (실행): spec.ts 생성

### 사용 MCP 도구
- `test-metrics` (action: `count`): 테스트 케이스 분석

### 워크플로우

```
1. test.ts 파일 탐색 및 분석
   test-metrics(action: 'count', files: [...])
       │
       ▼
2. 승격 자격 검사
   checkPromotionEligibility(input, stabilityThreshold)
   ├── stableDays >= 90?
   └── lastFailure === null?
       │
       ▼
3. 자격 있는 파일에 대해:
   ├── test.ts의 테스트 패턴 분석
   ├── 중복 케이스 식별
   ├── parameterized spec.ts 구조 생성
   └── 3+12 규칙 검증 (15 케이스 이내 확인)
       │
       ▼
4. spec.ts 작성 + 원본 test.ts 삭제
```

---

## 단계 6: /query — 인터랙티브 질의

### 트리거 조건
- 개발 중 수시로 실행
- 사용자가 `/query <question>` 명령 실행

### 관여 에이전트
- **architect** (질의 해석 + 응답)

### 사용 MCP 도구
- `fractal-navigate`: 관련 모듈 탐색
- `doc-compress` (mode: `auto`): 컨텍스트 과다 시 압축

### 3-Prompt Limit 규칙

```
질문 수신
    │
    ▼
Prompt 1: 모듈 위치 파악 + CLAUDE.md 체인 로드
    │
    ▼
Prompt 2: 상세 분석 또는 추가 정보 수집
    │
    ▼
Prompt 3 (최대): 최종 응답 생성
    │
    ▼
3회 이내 답변 불가 시:
    "현재까지 파악한 내용 + 추가 필요한 정보" 보고
```

---

## 에이전트 협업 시퀀스

### 일반적인 개발 사이클

```
                 ┌──────────┐
                 │ Architect │ ← 읽기 전용
                 │ (설계)     │
                 └─────┬────┘
                       │ SPEC.md 초안
                       ▼
                 ┌──────────────┐
                 │ Implementer   │ ← SPEC 범위 내 코드 작성
                 │ (구현)         │
                 └─────┬────────┘
                       │ 코드 변경 (PostToolUse → ChangeQueue)
                       ▼
                 ┌────────────────┐
                 │ Context Manager │ ← 문서만 수정
                 │ (문서 동기화)     │
                 └─────┬──────────┘
                       │ CLAUDE.md/SPEC.md 갱신
                       ▼
                 ┌──────────────┐
                 │ QA Reviewer   │ ← 읽기 전용
                 │ (품질 검증)     │
                 └──────────────┘
                       │ 검증 보고서
                       ▼
                 pass/fail 판정
```

### 역할별 도구 접근 매트릭스

| 에이전트 | Read | Glob | Grep | Write | Edit | Bash | MCP |
|----------|------|------|------|-------|------|------|-----|
| architect | O | O | O | X | X | X | O |
| implementer | O | O | O | O | O | O | O |
| context-manager | O | O | O | O* | O* | O | O |
| qa-reviewer | O | O | O | X | X | X | O |

> *context-manager: CLAUDE.md, SPEC.md 문서만 Write/Edit 가능 (역할 제한)

---

## Hook 이벤트 타임라인

### 단일 코드 수정 사이클

```
시간 →

T0  사용자 프롬프트 입력
    └─ UserPromptSubmit → context-injector
       "[FCA-AI] Active in: /path ..." (~200자 주입)

T1  에이전트가 Write 도구 호출
    └─ PreToolUse (matcher: Write|Edit)
       ├─ pre-tool-validator: CLAUDE.md/SPEC.md 검증
       └─ organ-guard: Organ 디렉토리 보호
       → pass/block 결정

T2  (pass 시) Write 도구 실행 → 파일 생성/수정

T3  PostToolUse (matcher: Write|Edit)
    └─ change-tracker: ChangeQueue에 기록

T4  에이전트가 서브에이전트 생성
    └─ SubagentStart (matcher: *)
       └─ agent-enforcer: 역할 제한 주입
```

---

## 관련 문서

- [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) — 4계층 구조와 에이전트 개요
- [04-USAGE.md](./04-USAGE.md) — 스킬 사용법 상세
- [06-HOW-IT-WORKS.md](./06-HOW-IT-WORKS.md) — Hook/MCP 내부 동작
- [07-RULES-REFERENCE.md](./07-RULES-REFERENCE.md) — 각 단계에서 적용되는 규칙
