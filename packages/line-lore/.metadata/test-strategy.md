# line-lore 테스트 전략

> 참조: [PLAN.md](./PLAN.md), [02-pipeline.md](./02-pipeline.md), [03-platform.md](./03-platform.md)

## 테스트 원칙

1. **mock 경계를 명확히**: `git/executor`와 `platform/` 어댑터가 외부 세계와의 유일한 접점.
   이 두 계층만 mock하고, 나머지는 실제 로직을 테스트한다.
2. **결정론적 검증**: 동일 입력 → 동일 출력 보장. 파이프라인의 모든 단계가
   결정론적이므로 스냅샷 기반 검증이 유효하다.
3. **Phase별 독립 테스트**: 각 Phase의 모듈은 하위 의존성을 mock하여 독립적으로 테스트 가능.

## mock 경계도

```
┌─ 실제 로직 (mock 하지 않음) ─────────────────────┐
│  core/blame/parsing/   → 파싱 로직                │
│  core/blame/detection/ → 휴리스틱 판별             │
│  core/ast-diff/        → 심볼 추출, 해싱, 비교     │
│  core/ancestry/        → 출력 파싱 로직             │
│  core/patch-id/        → 충돌 매핑 로직             │
│  core/pr-lookup/       → 폴백 체인 로직             │
│  core/issue-graph/     → 그래프 순회 로직           │
│  output/               → 정규화 로직               │
│  cache/                → 파일 캐시 (임시 디렉토리)   │
├─ mock 대상 ──────────────────────────────────────┤
│  git/executor          → git 명령 실행 결과 mock    │
│  platform/github/      → gh CLI 응답 mock          │
│  platform/gitlab/      → glab CLI 응답 mock        │
│  ast/parser            → @ast-grep/napi 결과 mock  │
│  fs (캐시 통합 테스트)  → 임시 디렉토리 사용         │
└──────────────────────────────────────────────────┘
```

## Phase 0: 기반 인프라 테스트

### git/executor

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | git 명령 실행 및 stdout 반환 | execa 호출 → stdout 문자열 반환 |
| 2 | git 명령 실패 시 에러 래핑 | exit code ≠ 0 → LineLoreError 변환 |
| 3 | 타임아웃 처리 | 지정 시간 초과 → 타임아웃 에러 |

### git/remote

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | HTTPS URL 파싱 (github.com) | `{ platform: 'github', owner, repo }` |
| 2 | SSH URL 파싱 (github.com) | `git@github.com:owner/repo.git` → 동일 결과 |
| 3 | GitLab URL 파싱 | gitlab.com 인식 |
| 4 | Enterprise 호스트 감지 | 미지의 호스트 → 감지 로직 트리거 |
| 5 | 잘못된 URL 처리 | 에러 반환 |

### git/health

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | commit-graph 활성 상태 감지 | `core.commitGraph=true` 파싱 |
| 2 | commit-graph 미설정 감지 | 힌트 메시지 포함 |
| 3 | bloom filter 가용성 | git 버전 2.27+ 확인 |

### cache/file-cache

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 캐시 쓰기 → 읽기 | 동일 데이터 복원 |
| 2 | 캐시 미스 | null/undefined 반환 |
| 3 | 원자적 교체 | 쓰기 중 실패해도 기존 데이터 보존 |
| 4 | 최대 항목 초과 시 FIFO 정리 | 가장 오래된 항목 제거 |
| 5 | 손상된 JSON 처리 | CACHE_CORRUPTED 에러 + 자동 초기화 |

### utils/line-range

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 단일 라인 "42" | `{ start: 42, end: 42 }` |
| 2 | 범위 "10,50" | `{ start: 10, end: 50 }` |
| 3 | 역순 범위 "50,10" | 에러 또는 자동 정렬 |
| 4 | 음수/0/비숫자 | INVALID_LINE 에러 |

## Phase 1: 1단계 파이프라인 테스트

### blame/parsing (blame-parser)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 정상 porcelain 출력 파싱 | BlameResult 정확성 (hash, author, date, content) |
| 2 | 파일 이름 변경 포함 출력 | `originalFile` 필드 정확 추출 |
| 3 | 라인 이동 포함 출력 | `originalLine` 필드 정확 추출 |
| 4 | 경계 커밋 (^로 시작하는 해시) | 루트 커밋 처리 |
| 5 | 빈 파일 / 빈 라인 | 적절한 에러 반환 |

### blame/detection (cosmetic-detector)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 공백만 변경된 diff | cosmetic = true |
| 2 | import 순서만 변경 | cosmetic = true |
| 3 | 실제 로직 변경 포함 | cosmetic = false |
| 4 | 포맷팅 변경 (prettier 등) | cosmetic = true |
| 5 | 혼합 변경 (공백 + 로직) | cosmetic = false |

### ast-diff/extraction (symbol-extractor)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | TypeScript 함수 선언 추출 | 이름, 위치, 본문 범위 |
| 2 | 화살표 함수 추출 | `const fn = () => {}` 패턴 |
| 3 | 클래스 메서드 추출 | 클래스 내 메서드 분리 |
| 4 | 중첩 함수 처리 | 가장 가까운 외부 심볼 반환 |
| 5 | 지원하지 않는 언어 | 적절한 폴백 또는 에러 |

### ast-diff/extraction (signature-hasher)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 공백 차이만 있는 두 코드 | 동일 해시 |
| 2 | 변수명만 다른 두 코드 | 구조적 해시 동일, 정확 해시 다름 |
| 3 | 로직이 다른 두 코드 | 두 해시 모두 다름 |
| 4 | 주석만 다른 두 코드 | 동일 해시 |

### ast-diff/comparison (structure-comparator)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 함수 이름 변경 감지 | 동일 해시, 다른 이름 → "rename" |
| 2 | 다른 파일로 이동 감지 | 파일 A에서 사라지고 B에 동일 해시 → "move" |
| 3 | 메서드 추출 감지 | 큰 함수 → 작은 함수 + 새 함수 → "extract" |
| 4 | 변경 없는 코드 | 동일 심볼 맵 → 변화 없음 |
| 5 | 완전히 새로운 코드 | 매칭 없음 → "new" |

## Phase 2: 2~3단계 파이프라인 테스트

### ancestry

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | Merge commit 존재 | 최초 병합 커밋 반환 |
| 2 | 다중 병합 (동일 위상 레벨) | 배열로 모든 병합 커밋 반환 |
| 3 | 병합 커밋 없음 (squash) | null 반환 → 3단계 전달 신호 |
| 4 | 메시지에서 PR 번호 파싱 | "Merge pull request #102" → 102 |

### patch-id

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 동일 diff의 patch-id 일치 | rebase 전후 커밋 매칭 |
| 2 | 다른 diff의 patch-id 불일치 | 매칭 없음 |
| 3 | 캐시 적중 | 두 번째 조회는 캐시에서 |
| 4 | 스캔 범위 초과 | 지정된 depth 내에서만 탐색 |

## Phase 3: 플랫폼 계층 테스트

### platform (공통)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 플랫폼 자동 감지 | remote URL → 올바른 어댑터 선택 |
| 2 | 인증 실패 처리 | Level 1로 폴백 |
| 3 | 어댑터 팩토리 | 감지 결과 → 올바른 어댑터 인스턴스 |

### github 어댑터

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | getPRForCommit 정상 | SHA → PRInfo 매핑 |
| 2 | getPRForCommit 404 | null 반환 |
| 3 | getLinkedIssues GraphQL | IssueInfo[] 파싱 |
| 4 | Enterprise --hostname 전달 | gh api 호출 시 hostname 포함 |
| 5 | GHES GraphQL 미지원 폴백 | REST 전용 경로 |

### gitlab 어댑터

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 커밋 → MR 매핑 | merge_requests 엔드포인트 |
| 2 | project ID 추론 | remote URL에서 자동 추출 |
| 3 | Self-Hosted hostname 전달 | glab api --hostname 포함 |

### scheduler (request-scheduler)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 캐시 히트 시 API 미호출 | 요청 발생 안 함 |
| 2 | ETag 304 응답 처리 | 캐시 데이터 반환, rate-limit 미소비 |
| 3 | rate-limit 임계값 도달 | Level 1 자동 폴백 |
| 4 | 429 응답 처리 | Retry-After 존중 + 폴백 |
| 5 | GraphQL 배치 조립 | N개 SHA → 단일 쿼리 문자열 |

## Phase 4: 오케스트레이터 + 출력 테스트

### core (오케스트레이터)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | 정상 경로 (merge commit) | 1→2→4 파이프라인 완주, TraceNode[] 정확 |
| 2 | 외관상 커밋 경로 | 1A→1B→2→4, AST 단계 포함 |
| 3 | squash/rebase 경로 | 1→2(miss)→3→4 |
| 4 | 완전 오프라인 | Level 0 동작, 메시지 파싱만 |
| 5 | 범위 추적 중복 제거 | 40줄 → N개 고유 커밋만 처리 |
| 6 | --no-ast 플래그 | AST 단계 건너뜀 |

### output (normalizer)

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | success 응답 구조 | NormalizedResponse 스키마 준수 |
| 2 | partial 응답 | warnings + partialData 포함 |
| 3 | error 응답 | code, message, stage, recoverable 포함 |
| 4 | human 출력 형식 | 사람이 읽을 수 있는 텍스트 |
| 5 | llm 출력 형식 | JSON 스키마 + hints |
| 6 | help --json 스키마 | 명령어/옵션/타입 정보 정확 |

## Phase 6: 확장 기능 테스트

### issue-graph

| # | 테스트 항목 | 검증 내용 |
|---|-----------|----------|
| 1 | PR → 연결 이슈 조회 | IssueInfo[] 반환 |
| 2 | 이슈 → 관련 PR 역탐색 | PRInfo[] 반환 |
| 3 | graph-depth 제한 | depth 초과 시 탐색 중단 |
| 4 | 순환 참조 방지 | 방문 Set으로 무한 루프 차단 |
| 5 | API 불가 시 | 이슈 탐색 건너뜀 + 경고 |

## E2E 테스트 설계

### E2E 테스트 원칙

1. **실제 git 저장소 사용**: 각 시나리오별로 임시 git 저장소를 프로그래밍 방식으로 생성.
   `git init` → 커밋 → 브랜치 → 병합까지 완전한 히스토리를 구축한다.
2. **플랫폼 API만 mock**: git 명령은 실제 실행. `platform/` 어댑터만 mock하여
   gh/glab CLI 의존 없이 API 응답을 시뮬레이션.
3. **결정론적 커밋 해시**: `GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`를 고정하여
   동일 내용 → 동일 해시를 보장. 스냅샷 검증 가능.
4. **테스트 격리**: 각 테스트는 독립된 임시 디렉토리에서 실행. `afterEach`에서 정리.

### fixture 저장소 빌더

```typescript
// __tests__/helpers/repo-builder.ts — 개념적 인터페이스 (구현 전 설계)

interface RepoBuilder {
  /** 임시 디렉토리에 git init */
  init(): Promise<RepoBuilder>;

  /** 파일 쓰기 + git add + git commit */
  commit(files: Record<string, string>, message: string): Promise<string>; // → SHA

  /** 브랜치 생성 + 체크아웃 */
  branch(name: string): Promise<RepoBuilder>;

  /** 체크아웃 */
  checkout(name: string): Promise<RepoBuilder>;

  /** merge commit 방식 병합 */
  merge(branch: string, message?: string): Promise<string>; // → merge commit SHA

  /** squash merge 방식 병합 */
  squashMerge(branch: string, message: string): Promise<string>;

  /** rebase 방식 병합 */
  rebaseMerge(branch: string): Promise<string>;

  /** cherry-pick */
  cherryPick(sha: string): Promise<string>;

  /** 파일 이동 */
  moveFile(from: string, to: string, message: string): Promise<string>;

  /** 현재 저장소 경로 */
  readonly path: string;

  /** 정리 */
  cleanup(): Promise<void>;
}
```

### E2E 시나리오 상세

---

#### E1: Merge Commit 전략 — 기본 추적

**검증 대상**: 1단계(blame) → 2단계(ancestry-path) → 4단계(메시지 파싱)

```
저장소 구축:
  main:     A ─── B ─────── M (merge commit)
                  │         ↑
  feature:        └── C ────┘

  A: 초기 파일 (src/utils.ts)
  B: main에서 다른 파일 변경
  C: feature 브랜치에서 src/utils.ts 라인 10에 함수 추가
  M: "Merge pull request #42 from feature"
```

**추적 입력**: `trace('src/utils.ts', line: 10)`

**기대 TraceNode[]:**
```
[
  { type: 'original_commit', sha: C, trackingMethod: 'blame-CMw', confidence: 'exact' },
  { type: 'merge_commit',    sha: M, trackingMethod: 'ancestry-path', confidence: 'exact' },
  { type: 'pull_request', prNumber: 42, trackingMethod: 'message-parse', confidence: 'exact' }
]
```

**검증 포인트:**
- blame이 커밋 C를 정확히 반환하는가
- ancestry-path가 merge commit M을 찾는가
- 메시지에서 `#42`를 파싱하는가 (API 호출 없이)

---

#### E2: Squash Merge — 메시지 파싱 경로

**검증 대상**: 1단계 → 2단계(miss) → 3단계(skip) → 4단계(메시지 파싱)

```
저장소 구축:
  main:     A ─── S ("feat: add validation (#55)")
                  ↑
  feature:  (C1, C2, C3 → squash into S)

  C1~C3: feature 브랜치에서 src/auth.ts에 여러 커밋
  S: squash merge 커밋 (메시지에 #55 포함)
```

**추적 입력**: `trace('src/auth.ts', line: 15)`

**기대 TraceNode[]:**
```
[
  { type: 'original_commit', sha: S, trackingMethod: 'blame-CMw', confidence: 'exact' },
  { type: 'pull_request', prNumber: 55, trackingMethod: 'message-parse', confidence: 'heuristic' }
]
```

**검증 포인트:**
- ancestry-path에서 merge commit을 찾지 못하는가 (squash라서)
- 커밋 메시지 끝의 `(#55)` 정규식 파싱
- confidence가 `heuristic`인가 (API 미사용)

---

#### E3: Rebase Merge — Patch-ID 매핑 경로

**검증 대상**: 1단계 → 2단계(miss) → 3단계(patch-id 일치) → 4단계

```
저장소 구축:
  main:     A ─── B ─── C' (rebased commit, 새 해시)

  feature:  A ─── C (원본 커밋)
  → git rebase main && git checkout main && git merge feature (fast-forward)

  C와 C'는 같은 diff, 다른 해시
```

**추적 입력**: `trace('src/index.ts', line: 5)`

**기대 TraceNode[]:**
```
[
  { type: 'original_commit', sha: C', trackingMethod: 'blame-CMw', confidence: 'exact' },
  { type: 'rebased_commit',  sha: C', trackingMethod: 'patch-id', confidence: 'exact',
    patchId: '<computed>' }
]
```

**검증 포인트:**
- blame이 rebased commit C'를 반환하는가
- ancestry-path에서 merge commit이 없는가 (fast-forward)
- patch-id 계산이 정확한가
- C'의 patch-id가 원본 C의 것과 일치하는가

---

#### E4: 외관상 커밋 관통 — AST 역추적

**검증 대상**: 1단계-A(blame → cosmetic) → 1단계-B(AST diff) → 2~4단계

```
저장소 구축:
  main:     A ─── M1 (merge "feature") ─── F (formatting commit)

  A: src/app.ts에 함수 추가
  M1: feature 브랜치에서 함수 로직 작성, merge commit
  F: prettier 실행 — 들여쓰기/세미콜론만 변경

  F 커밋의 diff: 공백/세미콜론만 변경, AST 구조 동일
```

**추적 입력**: `trace('src/app.ts', line: 10)` (함수 본문 내부)

**기대 TraceNode[]:**
```
[
  { type: 'cosmetic_commit', sha: F, trackingMethod: 'blame-CMw',
    note: '외관상 변경 감지, AST 역추적 수행' },
  { type: 'original_commit', sha: <M1에 포함된 원본 커밋>,
    trackingMethod: 'ast-signature', confidence: 'exact' },
  { type: 'merge_commit', sha: M1, trackingMethod: 'ancestry-path' },
  { type: 'pull_request', prNumber: ..., trackingMethod: 'message-parse' }
]
```

**검증 포인트:**
- blame이 formatting 커밋 F를 반환하는가
- cosmetic-detector가 F를 외관상으로 판별하는가
- AST signature-hasher가 F 전후 동일 해시를 생성하는가
- 부모 커밋으로 거슬러 올라가 원본 커밋을 찾는가

---

#### E5: 함수 이름 변경 — AST rename 감지

**검증 대상**: 1단계-B의 구조적 해시 비교

```
저장소 구축:
  main:     A ─── B ─── R (rename commit)

  A: src/utils.ts에 `function calcTotal(items) { ... }` 작성
  B: 다른 파일 변경
  R: src/utils.ts에서 `calcTotal` → `calculateTotal`로 이름만 변경

  R의 diff: 함수 이름만 변경, 본문 동일
```

**추적 입력**: `trace('src/utils.ts', line: <calculateTotal 본문>)`

**기대 결과:**
- blame → R (이름 변경 커밋)
- cosmetic 판별 → false (코드 변경이긴 함)
- 하지만 AST 구조적 해시가 `calcTotal`과 `calculateTotal`에서 동일
- AST diff가 "rename" 감지 → 원본 커밋 A로 거슬러 올라감

**검증 포인트:**
- signature-hasher의 식별자 정규화(`$1`) 후 해시가 동일한가
- structure-comparator가 `{ change: 'rename', from: 'calcTotal', to: 'calculateTotal' }` 반환

---

#### E6: 함수 추출 (Extract Method) — AST move 감지

**검증 대상**: 1단계-B의 메서드 추출 감지

```
저장소 구축:
  main:     A ─── B (extract commit)

  A: src/service.ts에 큰 함수 processOrder() 내부에 검증 로직 포함
  B: 검증 로직을 별도 함수 validateOrder()로 추출

  A의 processOrder():
    function processOrder(order) {
      // 검증 로직 (20줄)
      if (!order.id) throw new Error('...');
      ...
      // 처리 로직
      ...
    }

  B의 변경:
    function validateOrder(order) {   ← 추출된 함수
      if (!order.id) throw new Error('...');
      ...
    }
    function processOrder(order) {
      validateOrder(order);           ← 호출로 대체
      ...
    }
```

**추적 입력**: `trace('src/service.ts', line: <validateOrder 본문>)`

**기대 결과:**
- blame → B (추출 커밋)
- AST diff: B에서 `validateOrder`의 본문 해시 계산
- A에서 `processOrder` 내부에 동일 해시 블록 발견
- `{ change: 'extract', from: 'processOrder', to: 'validateOrder' }` 감지

**검증 포인트:**
- symbol-extractor가 중첩 블록이 아닌 함수 단위로 추출하는가
- 추출 전후의 콘텐츠 해시가 일치하는가
- `trackingMethod: 'ast-signature'`로 기록되는가

---

#### E7: 다른 파일로 함수 이동 — cross-file AST 추적

**검증 대상**: `git blame -C -C` + AST 크로스파일 비교

```
저장소 구축:
  main:     A ─── B (move commit)

  A: src/helpers.ts에 `formatDate()` 함수 존재
  B: src/helpers.ts에서 삭제, src/date-utils.ts로 이동
```

**추적 입력**: `trace('src/date-utils.ts', line: <formatDate 본문>)`

**기대 결과:**
- blame `-C -C`가 원본 파일 `src/helpers.ts`와 원본 커밋 A를 반환
- `originalFile: 'src/helpers.ts'` 포함

**검증 포인트:**
- blame의 `-C -C` 플래그가 cross-file 이동을 추적하는가
- `originalFile` 필드가 정확한가
- AST 폴백 없이 blame만으로 해결되는 케이스

---

#### E8: Cherry-pick — patch-id 교차 매핑

**검증 대상**: 3단계 patch-id의 체리픽 시나리오

```
저장소 구축:
  main:       A ─── B ─── CP (cherry-picked)
                    │
  hotfix:           └── H (원본 hotfix 커밋)

  H: hotfix 브랜치에서 버그 수정 커밋
  CP: git cherry-pick H → 새 해시, 동일 diff
  CP 메시지: "fix: critical bug\n\n(cherry picked from commit <H-sha>)"
```

**추적 입력**: `trace('src/core.ts', line: <cherry-pick된 수정 라인>)`

**기대 TraceNode[]:**
```
[
  { type: 'original_commit', sha: CP, trackingMethod: 'blame-CMw' },
  { type: 'rebased_commit', sha: CP, trackingMethod: 'patch-id',
    note: 'cherry-pick: 원본 커밋 <H-sha>와 patch-id 일치' }
]
```

**검증 포인트:**
- cherry-pick 메시지에서 원본 SHA 파싱 가능 여부 (보조 휴리스틱)
- patch-id가 H와 CP에서 동일한가
- 두 경로(메시지 파싱 + patch-id)의 결과가 일관적인가

---

#### E9: 범위 추적 — 중복 제거 + 배치

**검증 대상**: 오케스트레이터의 범위 처리 최적화

```
저장소 구축:
  main:     A ─── M1 ─── M2

  A: src/config.ts 40줄 파일 작성 (초기)
  M1: 라인 1~20을 feature-1 브랜치에서 수정 후 merge
  M2: 라인 21~40을 feature-2 브랜치에서 수정 후 merge

  결과: 40줄 중 라인 1~20은 M1의 커밋, 라인 21~40은 M2의 커밋
```

**추적 입력**: `trace('src/config.ts', line: '1,40')` (전체 범위)

**기대 결과:**
- blame → 2개 고유 커밋 SHA (M1-commit, M2-commit)
- 40줄이지만 처리되는 커밋은 2개뿐
- 각 커밋에 대해 독립적으로 2→4단계 실행
- 최종 결과에 PR 2개 포함

**검증 포인트:**
- 중복 제거: 40개 blame 결과 → 2개 고유 SHA
- 파이프라인 실행 횟수가 2회인가 (40회가 아닌)
- 결과에 두 PR이 모두 포함되는가

---

#### E10: Graceful Degradation — 운영 레벨 전환

**검증 대상**: Level 2 → Level 1 → Level 0 폴백 체인

```
시나리오 A — Level 2 (완전):
  platform mock: getPRForCommit → PRInfo 반환
  기대: API를 통한 완전한 PR 정보 (제목, URL, 작성자)

시나리오 B — Level 1 (부분):
  platform mock: checkAuth → { authenticated: false }
  기대: 메시지 파싱만으로 PR 번호 추출, 상세 정보 없음
  기대: warnings에 "API 사용 불가" 포함

시나리오 C — Level 0 (Git 전용):
  platform mock: CLI 미설치 시뮬레이션 (which gh → 실패)
  기대: Level 1과 동일 결과 + "gh 설치 안내" 힌트

시나리오 D — Level 2 → 1 동적 전환:
  platform mock: 첫 호출 성공 → 두 번째 호출에서 429 응답
  기대: 첫 결과는 완전, 두 번째부터 폴백
```

**검증 포인트:**
- 각 Level에서 올바른 기능이 활성/비활성인가
- 폴백 시 부분 결과 + warnings가 정확한가
- `NormalizedResponse.operatingLevel`이 실제 레벨과 일치하는가

---

#### E11: 캐시 적중 및 무효화

**검증 대상**: 캐시 계층의 정확성과 성능 효과

```
시나리오 A — 캐시 적중:
  1. trace(file, line) 실행 → API 호출 1회 → 결과 캐시 저장
  2. 동일 trace(file, line) 재실행 → API 호출 0회 → 캐시에서 반환
  검증: 두 결과가 동일한가, hints.cacheHit === true인가

시나리오 B — 캐시 무시 (--no-cache):
  1. trace(file, line) 실행 → 캐시 저장됨
  2. trace(file, line, { noCache: true }) → API 호출 재실행
  검증: 캐시가 있어도 API를 호출하는가

시나리오 C — ETag 조건부 요청:
  1. trace → API 호출 → 응답 + ETag 저장
  2. trace → If-None-Match 헤더로 요청 → 304 반환
  검증: rate-limit 토큰이 소비되지 않는가, 캐시 데이터가 반환되는가
```

---

#### E12: LLM 출력 정규화

**검증 대상**: `--output llm` 모드의 스키마 일관성

```
시나리오 A — 성공 응답:
  trace 성공 → NormalizedResponse 검증
  필수 필드: tool, command, version, timestamp, status, operatingLevel, data

시나리오 B — 부분 성공 응답:
  API 실패 + 메시지 파싱 성공 → partial 상태
  필수 필드: status === 'partial', partialData, warnings

시나리오 C — 에러 응답:
  존재하지 않는 파일 추적 → error 상태
  필수 필드: error.code, error.message, error.recoverable

시나리오 D — help --json 스키마:
  명령어 목록, 옵션 타입, 기본값이 모두 포함되는가
```

**검증 포인트:**
- 모든 시나리오에서 `tool === 'line-lore'`
- `timestamp`가 유효한 ISO 8601 형식인가
- `hints.relatedCommands`가 맥락에 맞는 후속 명령어인가

---

### E2E fixture 저장소 패턴 요약

| 패턴 | 사용 시나리오 | 핵심 git 연산 |
|------|-------------|--------------|
| merge-basic | E1 | `git merge --no-ff` |
| squash | E2 | `git merge --squash` + `git commit` |
| rebase | E3, E8 | `git rebase` / `git cherry-pick` |
| cosmetic | E4 | 공백/포맷만 변경하는 커밋 |
| rename | E5 | 함수명만 변경 |
| extract | E6 | 함수 본문 추출 |
| cross-file | E7 | `git mv` 또는 수동 이동 |
| cherry-pick | E8 | `git cherry-pick` |
| multi-commit | E9 | 여러 PR에서 다른 라인 수정 |
| degradation | E10 | platform mock 제어 |
| cache | E11 | 동일 쿼리 반복 |
| output | E12 | 출력 형식 검증 |

### E2E 실행 환경 요구사항

```
필수:
  - git >= 2.27 (commit-graph, bloom filter 지원)
  - Node.js >= 20
  - 임시 디렉토리 쓰기 권한 (os.tmpdir())

선택 (성능 테스트용):
  - git commit-graph write --changed-paths 실행 가능한 환경

mock 범위:
  - git/executor: E2E에서는 mock 하지 않음 (실제 git 사용)
  - platform/: 모든 E2E에서 mock (gh/glab CLI 의존 제거)
  - ast/parser: @ast-grep/napi가 설치되어 있으면 실제 사용,
                미설치 시 fixture 기반 mock으로 폴백
  - fs/cache: 임시 디렉토리 사용 (실제 I/O)
```

## 테스트 fixture 디렉토리 구조

```
__tests__/
├── fixtures/
│   ├── porcelain/               # git blame --porcelain 출력 샘플
│   │   ├── basic.txt            # 기본 blame 출력
│   │   ├── with-rename.txt      # 파일 이동 포함
│   │   └── boundary-commit.txt  # ^해시 루트 커밋
│   ├── diffs/                   # git diff 출력 샘플
│   │   ├── whitespace-only.txt  # 공백만 변경
│   │   ├── import-reorder.txt   # import 순서 변경
│   │   ├── logic-change.txt     # 실제 로직 변경
│   │   └── mixed.txt            # 공백 + 로직 혼합
│   ├── api-responses/           # 플랫폼 API 응답 JSON
│   │   ├── github/
│   │   │   ├── commits-pulls.json
│   │   │   ├── pulls-commits.json
│   │   │   ├── graphql-pr-issues.json
│   │   │   ├── rate-limit.json
│   │   │   └── 429-response.json
│   │   └── gitlab/
│   │       ├── commits-merge-requests.json
│   │       ├── mr-closes-issues.json
│   │       └── rate-limit.json
│   └── source-files/            # AST 파싱용 샘플 소스 코드
│       ├── typescript/
│       │   ├── functions.ts     # 함수 선언, 화살표, export
│       │   ├── classes.ts       # 클래스 + 메서드
│       │   ├── renamed.ts       # 이름 변경 후 버전
│       │   └── extracted.ts     # 메서드 추출 후 버전
│       ├── python/
│       │   ├── functions.py
│       │   └── classes.py
│       └── go/
│           └── functions.go
├── helpers/
│   ├── setup.ts                 # vitest 공통 설정
│   ├── mock-git.ts              # git/executor mock 헬퍼
│   ├── mock-platform.ts         # platform 어댑터 mock 헬퍼
│   └── repo-builder.ts          # E2E용 임시 git 저장소 빌더
└── e2e/
    ├── merge-trace.test.ts      # E1: merge commit 추적
    ├── squash-trace.test.ts     # E2: squash merge 추적
    ├── rebase-trace.test.ts     # E3: rebase merge 추적
    ├── cosmetic-trace.test.ts   # E4: 외관상 커밋 관통
    ├── rename-trace.test.ts     # E5: 함수 이름 변경
    ├── extract-trace.test.ts    # E6: 메서드 추출
    ├── cross-file-trace.test.ts # E7: 파일 간 이동
    ├── cherry-pick-trace.test.ts # E8: cherry-pick
    ├── range-trace.test.ts      # E9: 범위 추적
    ├── degradation.test.ts      # E10: 운영 레벨 전환
    ├── cache.test.ts            # E11: 캐시 적중/무효화
    └── output-format.test.ts    # E12: LLM 출력 정규화
```
