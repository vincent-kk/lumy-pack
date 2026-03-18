# line-lore 아키텍처 블루프린트

> Line-to-PR Trace CLI — 결정론적 코드 계보 추적기

## 1. 시스템 개요

line-lore는 코드 라인에서 출발하여 해당 라인이 도입된 원본 Pull Request를
4단계 결정론적 파이프라인으로 역추적하는 CLI 도구다.
ML/LLM을 사용하지 않으며, 동일한 저장소 상태에서 항상 동일한 결과를 보장한다.

**이중 배포**: CLI 도구인 동시에 node_modules로 import 가능한 프로그래밍 라이브러리.
외부 도구(IDE 플러그인, CI 파이프라인, LLM 에이전트)가 프로그래밍 방식으로 호출할 수 있다.

```
입력:  파일 경로 + 라인 번호
출력:  TraceNode[] (계보 노드의 정렬된 배열)

┌─────────────────────────────────────────────────────────────────┐
│               CLI (commander + ink)  /  Programmatic API        │
├─────────────────────────────────────────────────────────────────┤
│                       추적 오케스트레이터                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ 1단계    │→ │ 2단계    │→ │ 3단계    │→ │  4단계       │    │
│  │ 라인 →   │  │ 커밋 →   │  │ 단절    │  │  PR 매핑     │    │
│  │ 커밋     │  │ 병합     │  │ 해소     │  │  + 이슈 그래프│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  플랫폼 어댑터       캐시      AST 엔진      Git 실행기          │
│  (gh/glab 프록시)    (fs)   (ast-grep/napi)   (execa)           │
│  + Enterprise 지원   + API 응답                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 모듈 아키텍처

FCA(Fractal Component Architecture) 원칙에 따라 구성한다.

**zero-peer-file 규칙:**
fractal 노드에서 허용되는 peer 파일은 다음뿐이다:
- `index.ts` (barrel, 순수 re-export)
- `INTENT.md` / `DETAIL.md` (문서)
- **eponymous 파일**: 디렉토리 이름과 동일한 이름의 `.ts` 파일 **1개만**

그 외 모든 파일은 반드시 하위 organ 또는 fractal 디렉토리로 분리해야 한다.

**분류:**
- **[fractal]**: 독립된 경계를 가진 모듈. INTENT.md + index.ts(barrel) 필수.
  형제 간 직접 import 금지 → 부모의 공개 인터페이스를 통해 소통.
- **[organ]**: 말단 디렉토리. INTENT.md 없음. 파일을 플랫하게 배치 가능.
- 공유 타입은 소비자의 최소 공통 조상(LCA)인 `types/`에 배치.

```
src/
├── cli.ts                              # CLI 진입점 (commander)
├── index.ts                            # 공개 API barrel (라이브러리 진입점)
├── errors.ts                           # 에러 코드 + 커스텀 에러 클래스
├── version.ts                          # 주입된 버전 정보
│
│ ┈┈┈┈┈┈ 핵심 파이프라인 ┈┈┈┈┈┈
│
├── core/                               # [fractal] 추적 파이프라인 루트
│   ├── INTENT.md
│   ├── index.ts                        # barrel: trace() 공개
│   ├── core.ts                         # ★ eponymous: 파이프라인 오케스트레이터
│   │
│   ├── blame/                          # [fractal] 1단계-A: blame 분석
│   │   ├── INTENT.md
│   │   ├── index.ts                    # barrel: parseBlame, detectCosmetic 공개
│   │   ├── blame.ts                    # ★ eponymous: blame 파싱 + 외관상 판별 진입점
│   │   │
│   │   ├── parsing/                    # [organ] porcelain 출력 파서
│   │   │   ├── index.ts
│   │   │   └── blame-parser.ts         # git blame --porcelain 파싱 구현
│   │   │
│   │   └── detection/                  # [organ] 외관상 커밋 판별
│   │       ├── index.ts
│   │       └── cosmetic-detector.ts    # 공백/포맷/import 변경 판별 휴리스틱
│   │
│   ├── ast-diff/                       # [fractal] 1단계-B: AST 구조 비교
│   │   ├── INTENT.md
│   │   ├── index.ts                    # barrel: traceByAst 공개
│   │   ├── ast-diff.ts                 # ★ eponymous: AST 기반 역추적 진입점
│   │   │
│   │   ├── extraction/                 # [organ] 심볼 추출 + 해싱
│   │   │   ├── index.ts
│   │   │   ├── symbol-extractor.ts     # 함수/클래스/메서드 시그니처 추출
│   │   │   └── signature-hasher.ts     # 콘텐츠 해시 (정규화 + SHA-256)
│   │   │
│   │   └── comparison/                 # [organ] 구조 비교
│   │       ├── index.ts
│   │       └── structure-comparator.ts # 심볼 맵 비교 → 이동/이름변경/추출
│   │
│   ├── ancestry/                       # [fractal] 2단계: DAG 순회
│   │   ├── INTENT.md
│   │   ├── index.ts                    # barrel: findMergeCommit 공개
│   │   └── ancestry.ts                 # ★ eponymous: ancestry-path 병합 커밋 탐색
│   │
│   ├── patch-id/                       # [fractal] 3단계: 단절 해소
│   │   ├── INTENT.md
│   │   ├── index.ts                    # barrel: matchByPatchId 공개
│   │   └── patch-id.ts                 # ★ eponymous: patch-id --stable 충돌 매핑
│   │
│   ├── pr-lookup/                      # [fractal] 4단계: PR 매핑
│   │   ├── INTENT.md
│   │   ├── index.ts                    # barrel: resolvePR 공개
│   │   └── pr-lookup.ts               # ★ eponymous: API → 메시지 파싱 → 폴백 체인
│   │
│   └── issue-graph/                    # [fractal] 확장: 이슈 그래프 탐색
│       ├── INTENT.md
│       ├── index.ts                    # barrel: resolveIssues, traverseGraph 공개
│       └── issue-graph.ts             # ★ eponymous: PR↔이슈 양방향 탐색
│
│ ┈┈┈┈┈┈ 인프라 계층 ┈┈┈┈┈┈
│
├── platform/                           # [fractal] 호스팅 플랫폼 추상화
│   ├── INTENT.md
│   ├── index.ts                        # barrel: detectPlatform, createAdapter 공개
│   ├── platform.ts                     # ★ eponymous: 플랫폼 감지 + 어댑터 팩토리
│   │
│   ├── github/                         # [organ] GitHub 어댑터 (gh CLI 프록시)
│   │   ├── index.ts
│   │   ├── github-adapter.ts           # GitHub.com 어댑터
│   │   └── github-enterprise-adapter.ts # GHES 어댑터 (--hostname 분기)
│   │
│   ├── gitlab/                         # [organ] GitLab 어댑터 (glab CLI 프록시)
│   │   ├── index.ts
│   │   ├── gitlab-adapter.ts           # GitLab.com 어댑터
│   │   └── gitlab-self-hosted-adapter.ts # Self-Hosted 어댑터
│   │
│   └── scheduler/                      # [organ] API 요청 스케줄러
│       ├── index.ts
│       └── request-scheduler.ts        # 배치, rate-limit, ETag, 폴백
│
├── ast/                                # [organ] AST 파싱 엔진 래퍼
│   ├── index.ts
│   └── parser.ts                       # @ast-grep/napi 다중 언어 파서 래퍼
│
│ ┈┈┈┈┈┈ 공유 인프라 ┈┈┈┈┈┈
│
├── cache/                              # [organ] 캐시 계층
│   ├── index.ts
│   └── file-cache.ts                   # JSON 파일 기반 영속 캐시 (~/.line-lore/)
│
├── git/                                # [organ] Git 실행 계층
│   ├── index.ts
│   ├── executor.ts                     # 저수준 git 명령 실행기 (execa 래퍼)
│   ├── remote.ts                       # Remote URL 파서 + 플랫폼 감지
│   └── health.ts                       # commit-graph / bloom filter 가용성 점검
│
├── output/                             # [organ] 출력 정규화 계층
│   ├── index.ts
│   ├── normalizer.ts                   # 응답 정규화 (NormalizedResponse 봉투)
│   ├── formats.ts                      # 출력 형식 정의 (human, json, llm)
│   └── help-schema.ts                  # LLM용 JSON 도움말 스키마 생성
│
│ ┈┈┈┈┈┈ UI 계층 ┈┈┈┈┈┈
│
├── commands/                           # [organ] CLI 명령어 등록
│   ├── index.ts
│   ├── trace.tsx                       # trace 명령어 (대화형 + 비대화형)
│   ├── graph.tsx                       # graph 명령어 (이슈 그래프 탐색)
│   ├── health.tsx                      # health 명령어 (환경 점검)
│   └── cache.tsx                       # cache 명령어 (캐시 관리)
│
├── components/                         # [organ] Ink UI 컴포넌트
│   ├── index.ts
│   ├── TraceProgress.tsx               # 실시간 파이프라인 진행 표시
│   └── TraceResult.tsx                 # 최종 결과 렌더러 (테이블 / JSON)
│
│ ┈┈┈┈┈┈ 공유 기반 ┈┈┈┈┈┈
│
├── types/                              # [organ] 공유 타입 (LCA)
│   └── index.ts                        # TraceNode, PRInfo, PlatformAdapter 등 전체 타입
│
└── utils/                              # [organ] 유틸리티
    ├── index.ts
    └── line-range.ts                   # 라인 범위 파싱 / 검증
```

### 2.1 zero-peer-file 준수 검증

```
fractal 노드별 peer 파일 점검:

core/           → index.ts + INTENT.md + core.ts(eponymous)        ✓
core/blame/     → index.ts + INTENT.md + blame.ts(eponymous)       ✓
                  + parsing/(organ) + detection/(organ)             ✓ 하위 디렉토리
core/ast-diff/  → index.ts + INTENT.md + ast-diff.ts(eponymous)    ✓
                  + extraction/(organ) + comparison/(organ)         ✓ 하위 디렉토리
core/ancestry/  → index.ts + INTENT.md + ancestry.ts(eponymous)    ✓
core/patch-id/  → index.ts + INTENT.md + patch-id.ts(eponymous)    ✓
core/pr-lookup/ → index.ts + INTENT.md + pr-lookup.ts(eponymous)   ✓
core/issue-graph/ → index.ts + INTENT.md + issue-graph.ts(epon.)   ✓
platform/       → index.ts + INTENT.md + platform.ts(eponymous)    ✓
                  + github/(organ) + gitlab/(organ) + scheduler/(organ)  ✓

위반 사항: 없음
```

### 2.2 의존성 흐름 (import 방향)

```
cli.ts ──→ commands/ ──→ core/index.ts ──→ 각 파이프라인 단계 barrel
                     ──→ components/
                     ──→ output/

core/blame/       ──→ git/        (git blame 실행)
core/ast-diff/    ──→ ast/        (AST 파싱 위임)
core/ancestry/    ──→ git/        (git log 실행)
core/patch-id/    ──→ git/        (git patch-id 실행)
core/pr-lookup/   ──→ platform/   (API 호출 위임)
core/issue-graph/ ──→ platform/   (API 호출 위임)

platform/github/  ──→ git/        (gh CLI 실행)
platform/gitlab/  ──→ git/        (glab CLI 실행)

모든 모듈        ──→ types/       (공유 타입)
모든 모듈        ──→ cache/       (캐시 읽기/쓰기)
```

**금지된 import (형제 간 직접 참조):**
```
core/blame/ ──✕──→ core/ancestry/        # core/core.ts가 조율
core/blame/ ──✕──→ core/pr-lookup/       # core/core.ts가 조율
platform/github/ ──✕──→ platform/gitlab/  # platform/platform.ts가 조율
```

### 2.3 FCA 분류 요약

| 경로 | 분류 | INTENT.md | eponymous | 근거 |
|------|------|-----------|-----------|------|
| `src/` | fractal root | - | - | 패키지 루트, CLAUDE.md로 대체 |
| `core/` | fractal | O | `core.ts` | 파이프라인 오케스트레이션 |
| `core/blame/` | fractal | O | `blame.ts` | 1단계-A 파이프라인 경계 |
| `core/blame/parsing/` | organ | X | - | 말단: porcelain 파서 |
| `core/blame/detection/` | organ | X | - | 말단: 외관상 판별기 |
| `core/ast-diff/` | fractal | O | `ast-diff.ts` | 1단계-B 파이프라인 경계 |
| `core/ast-diff/extraction/` | organ | X | - | 말단: 심볼 추출 + 해싱 |
| `core/ast-diff/comparison/` | organ | X | - | 말단: 구조 비교 |
| `core/ancestry/` | fractal | O | `ancestry.ts` | 2단계 파이프라인 경계 |
| `core/patch-id/` | fractal | O | `patch-id.ts` | 3단계 파이프라인 경계 |
| `core/pr-lookup/` | fractal | O | `pr-lookup.ts` | 4단계 파이프라인 경계 |
| `core/issue-graph/` | fractal | O | `issue-graph.ts` | 확장 기능 경계 |
| `platform/` | fractal | O | `platform.ts` | 플랫폼 추상화 경계 |
| `platform/github/` | organ | X | - | 말단: GitHub 어댑터 |
| `platform/gitlab/` | organ | X | - | 말단: GitLab 어댑터 |
| `platform/scheduler/` | organ | X | - | 말단: 요청 스케줄러 |
| `ast/` | organ | X | - | 말단: AST 래퍼 |
| `cache/` | organ | X | - | 말단: 캐시 |
| `git/` | organ | X | - | 말단: Git 실행기 |
| `output/` | organ | X | - | 말단: 출력 정규화 |
| `commands/` | organ | X | - | 말단: CLI 명령어 |
| `components/` | organ | X | - | 말단: Ink 컴포넌트 |
| `types/` | organ | X | - | 말단: 공유 타입 (LCA) |
| `utils/` | organ | X | - | 말단: 유틸리티 |

## 3. 파이프라인 단계별 상세 설계

### 3.1 1단계: 라인 → 커밋

두 하위 단계가 순차 실행된다. 1-A가 90% 이상의 케이스를 처리하며,
1-B는 1-A가 "외관상 변경(cosmetic commit)"을 반환한 경우에만 활성화된다.

#### 1단계-A: 강화된 Git Blame

```
명령어:  git blame -w -C -C -M --porcelain -L <start>,<end> <file>

플래그:
  -w          공백 변경 무시
  -M          동일 파일 내 라인 이동 감지
  -C -C       전체 프로젝트에서 다른 파일로부터 복사/이동된 라인 추적
  --porcelain 기계 판독용 출력
```

출력: 라인별 `BlameResult` (`commitHash`, `originalFile`, `originalLine` 포함)

**외관상 커밋 판별 휴리스틱:**
blame 이후, 해당 커밋의 diff를 검사하여 순수 외관상 변경인지 확인한다.
대상 파일의 모든 변경 hunk이 아래 조건 중 하나라도 만족하면 외관상 변경으로 판정:
  - 공백만 변경된 diff (정규화 후 동일)
  - import 순서만 변경
  - 괄호/포맷팅만 변경 (AST 구조 동일)

외관상으로 판정되면 → 1단계-B로 전달하여 심층 추적

#### 1단계-B: AST 구조 시그니처 비교

외관상 커밋에서만 활성화된다.
`@ast-grep/napi`를 사용하여 코드 블록의 *의미론적 기원*을 추적한다.

```
알고리즘:
1. 현재 파일 버전 파싱 → 심볼 맵 추출 (함수, 클래스, 메서드)
2. 대상 라인을 포함하는 심볼 식별
3. 해당 심볼 본문의 콘텐츠 해시 계산 (공백 정규화)
4. 부모 커밋을 역방향으로 순회:
   a. 부모 버전의 파일 파싱
   b. 심볼 맵 + 콘텐츠 해시 추출
   c. 부모에서 일치하는 콘텐츠 해시 검색
   d. 다른 심볼 이름에서 일치 → "이름 변경" 감지
   e. 다른 파일에서 일치 → "이동/추출" 감지
   f. 일치하는 것이 없음 → 이 커밋이 진짜 기원
5. 콘텐츠 해시가 처음 등장한 커밋을 반환
```

**심볼 추출 패턴 예시 (ast-grep):**

```yaml
# TypeScript/JavaScript 함수
pattern: "function $NAME($$$PARAMS) { $$$BODY }"

# 변수에 할당된 화살표 함수
pattern: "const $NAME = ($$$PARAMS) => { $$$BODY }"

# 클래스 메서드
pattern: |
  class $CLASS {
    $$$BEFORE
    $METHOD($$$PARAMS) { $$$BODY }
    $$$AFTER
  }
```

**콘텐츠 해시 알고리즘:**
```
1. 심볼 본문의 AST 노드 텍스트 추출
2. 모든 공백, 주석, 문자열 리터럴 제거
3. 식별자 이름을 위치 기반 토큰으로 정규화 ($1, $2, ...)
   → 이름 변경 감지를 가능하게 함
4. 정규화된 문자열을 SHA-256 해시
```

두 가지 비교 모드:
- **정확 해시 일치**: 동일 로직, 이름만 변경 가능성 → 높은 신뢰도
- **구조적 해시 일치** (식별자 정규화): 동일 구조, 변수명 변경
  → 중간 신뢰도, `confidence: 'structural'`로 표시

### 3.2 2단계: 커밋 → 병합 커밋

1단계에서 얻은 커밋 SHA로부터 메인 브랜치에 병합된 병합 커밋을 찾는다.

```
기본 탐색:
  git log --merges --ancestry-path <sha>..HEAD --topo-order --reverse --format="%H %P %s"

  → 위상학적으로 가장 가까운(최초의) 병합 커밋 반환
  → 제목에서 PR 참조 파싱: /Merge pull request #(\d+)/
  → 동일 위상 레벨의 병합 커밋이 더 있는지 검사 (병렬 병합 수집)

폴백 (병합 커밋 없음 — squash/rebase 가능성):
  → 3단계로 전달
```

**commit-graph 가속:**
ancestry-path 쿼리 실행 전, 환경을 점검하고 안내:
```
git config --get core.commitGraph          → "true"여야 함
git commit-graph verify                    → 성공해야 함
```
미설정 시, 사용자에게 `git commit-graph write` 실행을 안내하는 일회성 힌트 출력.

### 3.3 3단계: 단절된 그래프 해소 (Patch-ID)

squash 병합과 rebase로 인해 DAG 연결이 끊어진 시나리오를 처리한다.

```
알고리즘:
1. 대상 커밋의 patch-id 계산:
   git diff <sha>^..<sha> | git patch-id --stable
   → 커밋 메타데이터와 무관한 콘텐츠 기반 해시 생성

2. 메인 브랜치에서 일치하는 patch-id 스캔:
   git log main --format="%H" -n 500 | 각 커밋별로
     git diff $commit^..$commit | git patch-id --stable
   → patch-id 충돌(일치) 비교

3. 일치 발견 시:
   → 해당 메인 브랜치 커밋이 squash/rebase된 버전
   → 이 커밋으로 4단계 진행

4. 일치 없음 (다중 커밋 squash, 부분 cherry-pick):
   → 4단계의 API 기반 해석으로 전달
```

**최적화**: 메인 브랜치 커밋의 patch-id를 캐시에 저장.
커밋은 불변이므로 한번 계산된 patch-id는 영원히 유효하다.

**스캔 범위**: 메인 브랜치 최근 500개 커밋 (기본값).
`--scan-depth`로 조절 가능. 커밋 빈도가 높은 모노레포는 1000+ 권장.

### 3.4 4단계: PR 매핑 + 노드 배열 조립

3단계 우아한 성능 저하(Graceful Degradation):

```
Level 2 (완전 — API 사용 가능):
  GitHub:  gh api /repos/{owner}/{repo}/commits/{sha}/pulls
  GitLab:  glab api /projects/{id}/repository/commits/{sha}/merge_requests

Level 1 (부분 — API 사용 불가):
  병합 커밋 메시지 파싱:
    /Merge pull request #(\d+)/     → GitHub 병합 커밋
    /See merge request !(\d+)/      → GitLab 병합 커밋
    /\(#(\d+)\)$/                   → Squash 커밋 관례

Level 0 (Git 전용 — CLI 도구 미설치):
  Level 1과 동일 + gh/glab 설치 안내 메시지 출력.
```

**심층 추적 (--deep 플래그):**
squash 병합된 PR에서 squash 커밋 자체가 여러 하위 PR의 변경을 포함할 수 있다.
`--deep` 활성화 시:
1. API로 해당 PR의 커밋 목록 조회
2. 각 하위 커밋에 대해 2~4단계를 재귀 실행
3. 중첩된 PR 참조의 트리 구축

### 3.5 최종 출력: TraceNode 배열

```typescript
type TraceNodeType =
  | 'original_commit'    // 1단계 결과
  | 'cosmetic_commit'    // 건너뛴 외관상 커밋
  | 'merge_commit'       // 2단계 결과
  | 'rebased_commit'     // 3단계 patch-id 일치
  | 'pull_request'       // 4단계 결과
  | 'issue';             // 확장: 연결된 이슈

interface TraceNode {
  type: TraceNodeType;
  sha?: string;
  trackingMethod:
    | 'blame'           // 기본 blame
    | 'blame-CMw'       // 강화 blame (-C -C -M -w)
    | 'ast-signature'   // AST 구조 시그니처 비교
    | 'ancestry-path'   // DAG 조상 경로 순회
    | 'patch-id'        // patch-id 충돌 매핑
    | 'api'             // 플랫폼 API 호출
    | 'message-parse'   // 커밋 메시지 정규식 파싱
    | 'issue-link';     // 이슈 링크 탐색
  confidence: 'exact' | 'structural' | 'heuristic';
  // 타입별 선택 필드
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  patchId?: string;
  note?: string;
  mergedAt?: string;
  // 이슈 관련 필드
  issueNumber?: number;
  issueUrl?: string;
  issueTitle?: string;
  issueState?: 'open' | 'closed';
  issueLabels?: string[];
}
```

## 4. 플랫폼 프로바이더 설계

### 4.1 프로바이더 추상화

모든 플랫폼 어댑터는 동일한 인터페이스를 구현한다.
플랫폼별 차이는 어댑터 내부에 캡슐화되며, 상위 계층은 인터페이스만 사용한다.

```typescript
interface PlatformAdapter {
  /** 플랫폼 식별자 */
  readonly platform: 'github' | 'github-enterprise' | 'gitlab' | 'gitlab-self-hosted';

  /** 인증 상태 확인 */
  checkAuth(): Promise<AuthStatus>;

  /** 커밋 SHA → 연관 PR 조회 */
  getPRForCommit(sha: string): Promise<PRInfo | null>;

  /** PR → 커밋 목록 조회 (deep trace 용) */
  getPRCommits(prNumber: number): Promise<string[]>;

  /** PR → 연결된 이슈 목록 조회 */
  getLinkedIssues(prNumber: number): Promise<IssueInfo[]>;

  /** 이슈 → 연결된 PR 목록 조회 (역방향) */
  getLinkedPRs(issueNumber: number): Promise<PRInfo[]>;

  /** 남은 API 호출 한도 조회 */
  getRateLimit(): Promise<RateLimitInfo>;
}

interface AuthStatus {
  authenticated: boolean;
  user?: string;
  scopes?: string[];       // 가용 권한 범위
  hostname: string;         // 실제 연결된 호스트
  method: 'cli' | 'token' | 'ssh';
}

interface RateLimitInfo {
  remaining: number;        // 남은 호출 수
  limit: number;            // 총 한도
  resetAt: Date;            // 리셋 시각
  resource: string;         // 'core' | 'graphql' | 'search'
}
```

### 4.2 GitHub.com 어댑터

```
인증 방식:
  1순위: gh auth status → 기존 gh CLI 인증 세션 재사용
  2순위: GH_TOKEN 환경변수 → CI/CD 환경 지원
  3순위: GITHUB_TOKEN 환경변수 → GitHub Actions 환경 지원

API 호출:
  gh api <endpoint> --jq <filter>
  → JSON 응답을 jq 필터로 서버사이드 축소하여 전송량 최소화

핵심 엔드포인트:
  커밋→PR:  GET /repos/{owner}/{repo}/commits/{sha}/pulls
  PR→커밋:  GET /repos/{owner}/{repo}/pulls/{number}/commits
  PR→이슈:  GraphQL (closing references 쿼리, 아래 4.6절 참조)
  이슈→PR:  GraphQL (timeline items 쿼리)
```

### 4.3 GitHub Enterprise Server 어댑터

GitHub Enterprise는 github.com과 API가 동일하나, 호스트가 다르고
인증 세션이 별도로 관리된다.

```
플랫폼 감지:
  git remote get-url origin 파싱 결과가 github.com이 아닌 경우 →
  gh auth status --hostname <detected-host> 로 Enterprise 인증 확인

인증 방식:
  1순위: gh auth login --hostname <host> 로 사전 로그인된 세션
         gh CLI는 호스트별로 독립된 인증 토큰을 관리함
         (~/.config/gh/hosts.yml 에 호스트별 토큰 저장)
  2순위: GH_ENTERPRISE_TOKEN 환경변수
  3순위: GH_TOKEN 환경변수 (Enterprise 호스트에도 적용 가능)

API 호출:
  gh api <endpoint> --hostname <host>
  → --hostname 플래그로 대상 Enterprise 서버를 명시적으로 지정
  → 엔드포인트 경로는 github.com과 동일

주의사항:
  - Enterprise 인스턴스마다 API 버전과 기능 지원 범위가 다를 수 있음
  - GraphQL API 미지원 인스턴스 존재 → REST 전용 폴백 경로 필요
  - GHES 3.0 미만은 commits/{sha}/pulls 엔드포인트 미지원
    → 폴백: git log 메시지 파싱 (Level 1 동작)
```

### 4.4 GitLab.com 어댑터

```
인증 방식:
  1순위: glab auth status → 기존 glab CLI 인증 세션 재사용
  2순위: GITLAB_TOKEN 환경변수
  3순위: GL_TOKEN 환경변수

API 호출:
  glab api <endpoint>

핵심 엔드포인트:
  커밋→MR:    GET /projects/{id}/repository/commits/{sha}/merge_requests
  MR→커밋:    GET /projects/{id}/merge_requests/{iid}/commits
  MR→이슈:    GET /projects/{id}/merge_requests/{iid}/closes_issues
  이슈→MR:    GET /projects/{id}/issues/{iid}/related_merge_requests

특이사항:
  - GitLab은 PR 대신 Merge Request (MR) 용어 사용
  - project id는 URL 인코딩된 경로(owner%2Frepo) 또는 숫자 ID
  - glab은 프로젝트 경로를 현재 git remote에서 자동 추론
```

### 4.5 GitLab Self-Hosted 어댑터

```
플랫폼 감지:
  remote URL이 gitlab.com이 아닌 경우 →
  glab auth status --hostname <detected-host> 로 확인

인증 방식:
  1순위: glab auth login --hostname <host> 로 사전 로그인된 세션
  2순위: GITLAB_TOKEN + GITLAB_HOST 환경변수 조합
  3순위: GL_TOKEN + GL_HOST 환경변수 조합

API 호출:
  glab api <endpoint> --hostname <host>

주의사항:
  - Self-Hosted 인스턴스의 GitLab 버전에 따라 API 지원 범위 상이
  - closes_issues 엔드포인트는 GitLab 10.6+ 필요
  - rate limit 정책이 인스턴스별로 다름 (관리자 설정)
```

### 4.6 플랫폼 자동 감지 로직

```
git remote get-url origin → URL 파싱

URL 패턴 매칭:
  github.com               → GitHub.com
  *.github.com 외 + /gh/   → 추가 검증 필요
  gitlab.com               → GitLab.com
  그 외                     → 미지의 호스트

미지의 호스트 판별:
  1. gh auth status --hostname <host> 시도 → 성공하면 GitHub Enterprise
  2. glab auth status --hostname <host> 시도 → 성공하면 GitLab Self-Hosted
  3. 둘 다 실패 → PLATFORM_UNKNOWN 에러, Level 1로 폴백

결과:
  { platform, hostname, owner, repo, projectId? }
  → 캐시에 저장 (platform-meta.json), 이후 재감지 불필요
```

## 5. API 요청 최소화 및 Rate-Limit 방어

### 5.1 설계 원칙

```
핵심 원칙: 가장 비싼 연산(API 호출)을 가장 마지막에, 가장 적게 수행한다.

탐색 우선순위 (비용 오름차순):
  1. 로컬 캐시 조회             → 비용 0, 즉시
  2. git 로컬 명령어            → 비용 0, 밀리초
  3. 커밋 메시지 정규식 파싱     → 비용 0, 마이크로초
  4. 플랫폼 API 호출            → 비용 1 토큰, 네트워크 지연
```

### 5.2 요청 회피 전략 (API 호출 전 단계)

```
대부분의 추적은 API 호출 없이 완료 가능:

시나리오 A — Merge Commit 전략 저장소 (가장 흔함):
  blame → ancestry-path → 병합 커밋 메시지에 PR 번호 포함
  "Merge pull request #102 from feature-branch"
  → API 호출 0회로 PR 번호 확보

시나리오 B — Squash Merge 전략 저장소:
  blame → 커밋 메시지 끝에 PR 번호 포함
  "feat: add validation (#102)"
  → API 호출 0회로 PR 번호 확보

시나리오 C — PR 번호는 확보했으나 상세 정보(URL, 제목, 작성자) 필요:
  → API 1회 호출 필요 (캐시에 없을 때만)

시나리오 D — 메시지에 PR 번호 없음 (rebase merge, 관례 미준수):
  → patch-id 매핑 시도 (로컬, API 0회)
  → 실패 시 API 호출 (commits/{sha}/pulls)
```

### 5.3 조건부 요청 및 응답 최소화

```
ETag/304 활용:
  GitHub API는 ETag 헤더를 반환한다.
  gh api <endpoint> -H "If-None-Match: <cached-etag>"
  → 304 Not Modified 응답 시 rate-limit 토큰 소비 없음
  → 캐시에 ETag를 함께 저장

응답 필드 축소:
  gh api <endpoint> --jq '{number, title, user: .user.login, html_url, merged_at}'
  → 필요한 필드만 추출하여 메모리/파싱 비용 절감

GraphQL 단일 요청 배치:
  PR 상세 + 연결된 이슈를 한 번의 GraphQL 쿼리로 조회:
  gh api graphql -f query='
    query($owner:String!, $repo:String!, $pr:Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$pr) {
          title
          author { login }
          mergedAt
          closingIssuesReferences(first:10) {
            nodes { number title state url labels(first:5) { nodes { name } } }
          }
        }
      }
    }
  '
  → PR 정보 + 이슈 목록을 API 1회로 모두 확보
```

### 5.4 Rate-Limit 방어 계층

```
┌─────────────────────────────────────────────────┐
│          RequestScheduler 동작 흐름               │
│                                                   │
│  요청 발생                                        │
│    ↓                                              │
│  [1] 캐시 히트? → 즉시 반환                        │
│    ↓ (미스)                                       │
│  [2] 남은 한도 확인 (getRateLimit)                  │
│    ↓                                              │
│  [3] 한도 충분 (remaining > 임계값)?                │
│    ├─ 예 → API 호출 실행                           │
│    └─ 아니오 → 폴백 모드 전환 (Level 2 → Level 1)  │
│                                                   │
│  API 호출 후:                                     │
│  [4] 응답 헤더에서 x-ratelimit-remaining 갱신      │
│  [5] 결과 + ETag 캐시 저장                         │
│  [6] 429 응답 시:                                  │
│      → Retry-After 헤더 존중                       │
│      → 즉시 Level 1로 폴백 전환                    │
│      → 폴백 결과로 진행 (부분 정보라도 반환)        │
└─────────────────────────────────────────────────┘

임계값 설정:
  GitHub:  remaining < 100 일 때 경고, < 10 일 때 폴백
  GitLab:  remaining < 50 일 때 경고, < 5 일 때 폴백
  (기본값이며 config.json으로 조절 가능)
```

### 5.5 범위 추적 시 배치 최적화

```
line-lore trace <file> -L 10,50 처럼 라인 범위를 추적할 때:

1. blame 결과에서 고유 커밋 SHA 추출 → 중복 제거
   (40줄이 5개의 서로 다른 커밋에서 왔다면 → 5개만 처리)

2. 로컬 단계(ancestry-path, patch-id, 메시지 파싱) 일괄 실행

3. API 호출이 필요한 커밋만 수집
   → 캐시 히트 제외 후 남은 것만 API 호출

4. GraphQL 배치: 여러 커밋의 PR을 단일 쿼리로 조회
   gh api graphql -f query='
     query($owner:String!, $repo:String!) {
       repository(owner:$owner, name:$repo) {
         c1: object(oid:"sha1") { ...commitPR }
         c2: object(oid:"sha2") { ...commitPR }
         c3: object(oid:"sha3") { ...commitPR }
       }
     }
     fragment commitPR on Commit {
       associatedPullRequests(first:1) {
         nodes { number title mergedAt }
       }
     }
   '
   → N개 커밋을 API 1회로 처리

예상 효과:
  40줄 범위 추적 시:
    최악: API 40회 → 최적화 후: API 1회 (GraphQL 배치)
    대부분: API 0회 (메시지 파싱 + 캐시로 해결)
```

## 6. 이슈 그래프 탐색 확장

### 6.1 개요

PR은 단독으로 존재하지 않고 이슈, 다른 PR, 마일스톤과 연결된다.
line-lore는 PR에서 멈추지 않고, 연결된 이슈 그래프를 추가로 탐색하여
"이 코드 라인이 어떤 요구사항/버그에서 비롯되었는가"까지 추적한다.

```
코드 라인 → 커밋 → PR #102 → Issue #55 "로그인 실패 버그"
                            → Issue #60 "보안 감사 결과"
                            → PR #98 (관련 PR, 동일 이슈 참조)
```

### 6.2 이슈 연결 탐색 알고리즘

```
입력: PR 번호 (4단계에서 확보)

GitHub 탐색 경로:
  1. closing references: PR이 자동으로 닫는 이슈 목록
     → GraphQL closingIssuesReferences (5.3절의 배치 쿼리에 이미 포함)
  2. body/comment 내 이슈 참조: #NNN 패턴 정규식 스캔
     → PR body를 파싱하여 참조된 이슈 번호 추출
  3. 이슈 → 관련 PR 역탐색 (선택적, --graph-depth 2 이상):
     → 동일 이슈를 참조하는 다른 PR 목록

GitLab 탐색 경로:
  1. closes_issues 엔드포인트로 직접 조회
  2. MR description 내 이슈 참조 파싱
  3. related_merge_requests로 역탐색

탐색 깊이 제어:
  --graph-depth 0  이슈 탐색 안 함 (기본값: PR까지만)
  --graph-depth 1  PR → 직접 연결된 이슈 (기본 graph 명령)
  --graph-depth 2  PR → 이슈 → 관련 PR → 이슈 (2홉)

순환 방지:
  방문한 노드 집합(Set)을 유지하여 이미 탐색한 PR/이슈 재방문 차단.
```

### 6.3 graph 명령어

```bash
# trace 결과에 이슈 정보를 포함
line-lore trace <file> -L <line> --graph-depth 1

# 독립 명령어: 특정 PR의 이슈 그래프 탐색
line-lore graph pr 102
line-lore graph pr 102 --depth 2 --json

# 특정 이슈에서 역방향 탐색
line-lore graph issue 55
line-lore graph issue 55 --depth 2 --json
```

### 6.4 이슈 그래프 출력 노드

```typescript
interface IssueInfo {
  number: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  labels: string[];
  milestone?: string;
  linkedPRs?: number[];      // 이 이슈를 참조하는 PR 번호들
}

// TraceNode 배열에 이슈 노드 추가 예시:
[
  { type: 'original_commit', sha: 'a1b2c3d', ... },
  { type: 'pull_request', prNumber: 102, ... },
  { type: 'issue', issueNumber: 55, issueTitle: '로그인 실패 버그',
    issueState: 'closed', issueLabels: ['bug', 'critical'], ... },
  { type: 'issue', issueNumber: 60, issueTitle: '보안 감사 결과',
    issueState: 'open', issueLabels: ['security'], ... }
]
```

## 7. 이중 배포: CLI + 프로그래밍 라이브러리

### 7.1 배포 구조

```
패키지 export 맵:

"exports": {
  ".": {                          # 라이브러리 진입점
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
},
"bin": "dist/cli.mjs",            # CLI 진입점 (별도)
```

### 7.2 라이브러리 공개 API

```typescript
// index.ts — 프로그래밍 방식으로 사용하는 공개 API

/** 핵심: 라인 → PR 추적 */
export function trace(options: TraceOptions): Promise<TraceResult>;

/** 확장: 이슈 그래프 탐색 */
export function graph(options: GraphOptions): Promise<GraphResult>;

/** 유틸: 환경 점검 */
export function health(): Promise<HealthReport>;

/** 유틸: 캐시 관리 */
export function clearCache(): Promise<void>;

/** 모든 타입 re-export */
export type {
  TraceOptions,
  TraceResult,
  TraceNode,
  TraceNodeType,
  GraphOptions,
  GraphResult,
  PRInfo,
  IssueInfo,
  BlameResult,
  CommitInfo,
  HealthReport,
  AuthStatus,
};
```

### 7.3 사용 시나리오

```typescript
// IDE 플러그인에서 사용
import { trace } from '@lumy-pack/line-lore';
const result = await trace({ file: 'src/auth.ts', line: 42 });
console.log(result.nodes); // TraceNode[]

// CI 파이프라인에서 사용
import { trace, graph } from '@lumy-pack/line-lore';
const traceResult = await trace({ file, line, json: true });
const graphResult = await graph({ pr: traceResult.pr.number, depth: 1 });

// LLM 에이전트에서 사용
import { trace } from '@lumy-pack/line-lore';
const result = await trace({ file, line, output: 'llm' });
// → 정규화된 JSON 스키마로 반환 (7장 참조)
```

## 8. CLI 인터페이스 설계

### 8.1 대화형 모드 vs 비대화형 모드

```
두 가지 실행 모드를 자동 감지:

대화형 모드 (TTY 감지):
  - Ink 컴포넌트로 실시간 진행 표시
  - 스피너, 색상, 단계별 결과 렌더링
  - 사용자가 터미널에서 직접 실행할 때

비대화형 모드 (자동 감지 또는 플래그 지정):
  다음 조건 중 하나라도 참이면 비대화형:
  - process.stdout.isTTY === false (파이프, 리다이렉트)
  - --json 플래그 지정
  - --quiet 플래그 지정
  - --output llm 플래그 지정
  - CI=true 환경변수

비대화형 모드에서는:
  - Ink 렌더링 없음, 최종 결과만 stdout에 출력
  - --json: 정규화된 JSON
  - --quiet: PR 번호만 (스크립팅용)
  - --output llm: LLM 정규화 JSON (8장 참조)
```

### 8.2 명령어 전체 목록

```bash
# ─── trace: 핵심 명령어 ───
line-lore trace <file> -L <line>                  # 기본 추적
line-lore trace <file> -L <start>,<end>           # 범위 추적
line-lore trace <file> -L <line> --deep           # 심층 (중첩 PR)
line-lore trace <file> -L <line> --no-ast         # AST 분석 생략
line-lore trace <file> -L <line> --scan-depth N   # patch-id 스캔 범위
line-lore trace <file> -L <line> --graph-depth 1  # 이슈까지 추적

# ─── 출력 제어 플래그 (모든 명령어 공통) ───
--json                    # 정규화 JSON 출력
--quiet                   # 최소 출력 (PR 번호 또는 URL만)
--output human|json|llm   # 출력 형식 명시적 지정
--no-color                # 색상 비활성화
--no-cache                # 캐시 무시 (항상 새로 조회)

# ─── graph: 이슈 그래프 탐색 ───
line-lore graph pr <number>                       # PR → 연결된 이슈
line-lore graph issue <number>                    # 이슈 → 관련 PR
line-lore graph pr <number> --depth 2 --json      # 2홉, JSON 출력

# ─── health: 환경 점검 ───
line-lore health                                  # 전체 환경 점검
line-lore health --json                           # JSON 형식 환경 보고

# ─── cache: 캐시 관리 ───
line-lore cache clear                             # 전체 캐시 삭제
line-lore cache stats                             # 캐시 적중률 통계

# ─── help: 도움말 ───
line-lore help                                    # 사람용 도움말
line-lore help --json                             # LLM용 JSON 도움말 스키마
```

### 8.3 단일 라인 스크립팅 예시

```bash
# PR 번호만 추출
line-lore trace src/auth.ts -L 42 --quiet
# 출력: #102

# PR URL만 추출
line-lore trace src/auth.ts -L 42 --quiet --url
# 출력: https://github.com/org/repo/pull/102

# JSON을 jq와 조합
line-lore trace src/auth.ts -L 42 --json | jq '.nodes[-1].prUrl'

# 셸 변수에 할당
PR_NUM=$(line-lore trace src/auth.ts -L 42 --quiet)
gh pr view "$PR_NUM"

# 범위 추적 → 고유 PR 목록
line-lore trace src/auth.ts -L 1,100 --json | jq '[.nodes[] | select(.type=="pull_request") | .prNumber] | unique'

# CI에서 변경 라인 → 관련 PR 매핑
git diff --unified=0 HEAD~1 | grep "^@@" | while read hunk; do
  file=$(...)
  line=$(...)
  line-lore trace "$file" -L "$line" --quiet --json
done
```

### 8.4 대화형 출력 예시 (ink)

```
 ● 1단계: Blame 분석
   ✓ git blame -w -C -C -M  →  a1b2c3d (John, 2024-03-15)
   ✓ 외관상 커밋 감지 → AST 분석
   ✓ AST 시그니처 일치  →  f4e5d6c (원본, 메서드 추출됨)

 ● 2단계: 병합 커밋 탐색
   ✓ ancestry-path      →  병합 커밋 9a8b7c6

 ● 3단계: Patch-ID (건너뜀 — DAG 연결 유지)

 ● 4단계: PR 매핑
   ✓ gh api             →  PR #102 "Add user validation"
   ✓ 연결된 이슈        →  #55 로그인 실패 버그 (closed)

 ─────────────────────────────────────────
 결과: PR #102 — Add user validation
   URL:    https://github.com/org/repo/pull/102
   작성자: john        병합일: 2024-03-16
   경로:   a1b2c3d → f4e5d6c → 9a8b7c6 → PR #102 → Issue #55
   방법:   blame-CMw → ast-signature → ancestry-path → api
```

## 9. LLM용 JSON 도움말 및 응답 정규화

### 9.1 설계 동기

line-lore는 LLM 에이전트(Claude Code, Copilot, Cursor 등)가 도구로써
호출할 수 있어야 한다. 이를 위해:
- 도구의 기능/파라미터를 기계가 이해할 수 있는 JSON 스키마로 제공
- 모든 응답을 예측 가능한 정규화 형식으로 출력

### 9.2 JSON 도움말 스키마 (`help --json`)

```bash
line-lore help --json
```

```json
{
  "name": "line-lore",
  "version": "0.1.0",
  "description": "코드 라인에서 원본 PR과 연결된 이슈까지 역추적하는 결정론적 CLI 도구",
  "commands": {
    "trace": {
      "description": "파일의 특정 라인을 원본 PR까지 역추적",
      "usage": "line-lore trace <file> -L <line> [options]",
      "args": {
        "file": { "type": "string", "required": true, "description": "추적할 파일 경로" }
      },
      "options": {
        "-L, --line": { "type": "string", "required": true, "description": "라인 번호 또는 범위 (예: 42 또는 10,50)" },
        "--deep": { "type": "boolean", "default": false, "description": "squash PR 내부까지 재귀 추적" },
        "--no-ast": { "type": "boolean", "default": false, "description": "AST 구조 분석 건너뛰기" },
        "--graph-depth": { "type": "number", "default": 0, "description": "이슈 그래프 탐색 깊이 (0=PR까지, 1=이슈까지)" },
        "--scan-depth": { "type": "number", "default": 500, "description": "patch-id 스캔 커밋 수" },
        "--json": { "type": "boolean", "default": false, "description": "JSON 정규화 출력" },
        "--quiet": { "type": "boolean", "default": false, "description": "PR 번호만 출력" },
        "--output": { "type": "string", "enum": ["human", "json", "llm"], "default": "human", "description": "출력 형식" }
      },
      "examples": [
        "line-lore trace src/auth.ts -L 42 --json",
        "line-lore trace src/auth.ts -L 10,50 --deep --graph-depth 1 --output llm"
      ]
    },
    "graph": {
      "description": "PR 또는 이슈의 연결 그래프 탐색",
      "usage": "line-lore graph <pr|issue> <number> [options]",
      "options": {
        "--depth": { "type": "number", "default": 1, "description": "그래프 탐색 홉 수" },
        "--json": { "type": "boolean", "default": false, "description": "JSON 출력" }
      }
    },
    "health": {
      "description": "실행 환경 점검 (git, CLI, AST 엔진 가용성)",
      "usage": "line-lore health [--json]"
    },
    "cache": {
      "description": "로컬 캐시 관리",
      "subcommands": {
        "clear": { "description": "전체 캐시 삭제" },
        "stats": { "description": "캐시 적중률 통계" }
      }
    }
  },
  "outputSchema": {
    "$ref": "#/definitions/TraceResponse"
  }
}
```

### 9.3 정규화 응답 스키마 (`--output llm`)

모든 명령어의 `--output llm` 응답은 아래 봉투(envelope) 구조를 따른다.
LLM이 응답을 파싱할 때 성공/실패/부분 성공을 일관되게 판별할 수 있다.

```typescript
interface NormalizedResponse<T> {
  /** 항상 존재하는 메타 필드 */
  tool: 'line-lore';
  command: string;               // 'trace' | 'graph' | 'health' | 'cache'
  version: string;               // 패키지 버전
  timestamp: string;             // ISO 8601

  /** 실행 결과 */
  status: 'success' | 'partial' | 'error';
  operatingLevel: 0 | 1 | 2;    // 실행 시 운영 레벨

  /** 성공/부분 성공 시 데이터 */
  data?: T;

  /** 에러 시 에러 정보 */
  error?: {
    code: string;                // LineLoreErrorCode
    message: string;             // 사람이 읽을 수 있는 메시지
    stage?: number;              // 실패한 파이프라인 단계 (1-4)
    recoverable: boolean;        // 재시도로 해결 가능한지
    suggestion?: string;         // LLM이 다음에 시도할 수 있는 액션
  };

  /** 부분 성공 시: 어디까지 성공했는지 */
  partialData?: Partial<T>;
  warnings?: string[];           // 경고 목록

  /** LLM이 후속 액션을 결정할 때 참고할 힌트 */
  hints?: {
    canRetryWithFlags?: string[];  // 다른 플래그로 재시도 가능
    relatedCommands?: string[];    // 후속으로 유용한 명령어
    cacheHit?: boolean;            // 캐시에서 응답했는지
  };
}
```

### 9.4 LLM 응답 예시

```bash
line-lore trace src/auth.ts -L 42 --output llm --graph-depth 1
```

```json
{
  "tool": "line-lore",
  "command": "trace",
  "version": "0.1.0",
  "timestamp": "2026-03-18T14:30:00Z",
  "status": "success",
  "operatingLevel": 2,
  "data": {
    "file": "src/auth.ts",
    "line": 42,
    "nodes": [
      {
        "type": "original_commit",
        "sha": "a1b2c3d4",
        "trackingMethod": "blame-CMw",
        "confidence": "exact",
        "note": "Author: John, Date: 2024-03-15"
      },
      {
        "type": "merge_commit",
        "sha": "9a8b7c6d",
        "trackingMethod": "ancestry-path",
        "confidence": "exact"
      },
      {
        "type": "pull_request",
        "prNumber": 102,
        "prTitle": "Add user validation",
        "prUrl": "https://github.com/org/repo/pull/102",
        "trackingMethod": "api",
        "confidence": "exact",
        "mergedAt": "2024-03-16T10:00:00Z"
      },
      {
        "type": "issue",
        "issueNumber": 55,
        "issueTitle": "로그인 실패 버그",
        "issueUrl": "https://github.com/org/repo/issues/55",
        "issueState": "closed",
        "issueLabels": ["bug", "critical"],
        "trackingMethod": "issue-link",
        "confidence": "exact"
      }
    ],
    "summary": {
      "prNumber": 102,
      "prUrl": "https://github.com/org/repo/pull/102",
      "issueCount": 1,
      "tracePath": "blame-CMw → ancestry-path → api → issue-link"
    }
  },
  "hints": {
    "cacheHit": false,
    "relatedCommands": [
      "line-lore graph pr 102 --depth 2",
      "line-lore trace src/auth.ts -L 42 --deep"
    ]
  }
}
```

### 9.5 에러 응답 예시

```json
{
  "tool": "line-lore",
  "command": "trace",
  "version": "0.1.0",
  "timestamp": "2026-03-18T14:31:00Z",
  "status": "partial",
  "operatingLevel": 1,
  "partialData": {
    "file": "src/auth.ts",
    "line": 42,
    "nodes": [
      {
        "type": "original_commit",
        "sha": "a1b2c3d4",
        "trackingMethod": "blame-CMw",
        "confidence": "exact"
      },
      {
        "type": "pull_request",
        "prNumber": 102,
        "trackingMethod": "message-parse",
        "confidence": "heuristic",
        "note": "커밋 메시지에서 추출 (#102). API 미사용으로 상세 정보 없음."
      }
    ]
  },
  "warnings": [
    "gh CLI 인증 실패로 Level 1 폴백. PR 제목/URL 조회 불가.",
    "이슈 그래프 탐색은 API 필요 (--graph-depth 무시됨)"
  ],
  "hints": {
    "canRetryWithFlags": [],
    "relatedCommands": ["line-lore health", "gh auth login"],
    "cacheHit": false
  }
}
```

## 10. 운영 레벨 및 Graceful Degradation

```
┌──────────────────────────────────────────────────────────────┐
│ 시작 시: 환경 감지                                            │
│                                                              │
│  1. git rev-parse --git-dir          → git 저장소인가?        │
│  2. git remote get-url origin        → 플랫폼 감지            │
│  3. which gh / which glab            → CLI 설치 여부?         │
│  4. gh auth status --hostname <host> → 인증 상태?             │
│  5. commit-graph verify              → 가속 준비 완료?        │
│  6. @ast-grep/napi import 점검       → AST 엔진 사용 가능?    │
│                                                              │
│  결과: OperatingLevel (0 | 1 | 2)                            │
│  + FeatureFlags { astDiff, deepTrace, commitGraph,            │
│                   issueGraph, graphql }                       │
└──────────────────────────────────────────────────────────────┘

Level 2 (완전):  모든 기능 활성. API를 통한 PR 조회 + 이슈 그래프 + 심층 추적.
Level 1 (부분):  로컬 전용. git log 메시지 파싱. API 호출 없음. 이슈 그래프 불가.
Level 0 (Git만): Level 1과 동일 + 도구 설치 안내 출력.

AST diff는 API 레벨과 독립적 — @ast-grep/napi로 로컬 실행.
네이티브 바이너리 문제로 로드 실패 시, 경고와 함께 blame 전용 모드로 폴백.

GraphQL 가용성은 Level 2 내에서 별도 감지:
  GitHub.com → 항상 가능
  GHES → 버전에 따라 불가 → REST 전용 폴백
  GitLab → REST만 사용 (GraphQL 미사용)
```

## 11. 캐싱 아키텍처

```
~/.line-lore/
├── cache/
│   ├── sha-to-pr.json          # { [커밋SHA]: PRInfo }         — 불변
│   ├── sha-to-patch-id.json    # { [커밋SHA]: patchId 해시 }   — 불변
│   ├── pr-to-issues.json       # { [prNumber]: IssueInfo[] }   — 준불변 (이슈 상태 변경 가능)
│   ├── etags.json              # { [endpoint]: etag }          — API 조건부 요청용
│   └── platform-meta.json      # { [remote]: { platform, hostname, owner, repo } }
└── config.json                 # 사용자 설정 (선택)
```

**캐시 특성:**
- 커밋→PR 매핑: 완전 불변 (SHA → 데이터 절대 불변)
- PR→이슈 매핑: 준불변 (이슈 state/labels가 변경될 수 있으므로 ETag 검증)
- TTL 정책: SHA 기반 캐시는 만료 없음, 이슈 캐시는 ETag 기반 조건부 갱신
- 단순 JSON 읽기/쓰기 + 원자적 파일 교체 (임시파일 쓰기 → rename)
- 파일당 최대 10,000 항목 (초과 시 가장 오래된 것부터 제거 — FIFO)

## 12. 에러 코드 확장

```typescript
const LineLoreErrorCode = {
  // 기존
  NOT_GIT_REPO: 'NOT_GIT_REPO',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_LINE: 'INVALID_LINE',
  GIT_BLAME_FAILED: 'GIT_BLAME_FAILED',
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',

  // 단계별 에러
  ANCESTRY_PATH_FAILED: 'ANCESTRY_PATH_FAILED',
  PATCH_ID_NO_MATCH: 'PATCH_ID_NO_MATCH',
  AST_PARSE_FAILED: 'AST_PARSE_FAILED',
  AST_ENGINE_UNAVAILABLE: 'AST_ENGINE_UNAVAILABLE',

  // 플랫폼 에러
  PLATFORM_UNKNOWN: 'PLATFORM_UNKNOWN',
  CLI_NOT_INSTALLED: 'CLI_NOT_INSTALLED',
  CLI_NOT_AUTHENTICATED: 'CLI_NOT_AUTHENTICATED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  GRAPHQL_NOT_SUPPORTED: 'GRAPHQL_NOT_SUPPORTED',
  ENTERPRISE_VERSION_UNSUPPORTED: 'ENTERPRISE_VERSION_UNSUPPORTED',

  // 이슈 그래프 에러
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',
  GRAPH_DEPTH_EXCEEDED: 'GRAPH_DEPTH_EXCEEDED',
  GRAPH_CYCLE_DETECTED: 'GRAPH_CYCLE_DETECTED',

  // 캐시 에러
  CACHE_CORRUPTED: 'CACHE_CORRUPTED',
} as const;
```

## 13. 의존성 맵

```
프로덕션 의존성:
  commander        ^12.1.0    CLI 프레임워크 (기존)
  execa            ^9.5.0     Git 명령 실행 (기존)
  ink              ^5.0.0     터미널 UI (기존)
  ink-spinner      ^5.0.0     로딩 스피너 (기존)
  react            ^18.0.0    Ink 런타임 (기존)
  picocolors       ^1.1.1     터미널 색상 (기존)
  @ast-grep/napi   ^0.36.x   AST 파싱 + 패턴 매칭 (신규)

개발 의존성:
  vitest           ^3.2.x     테스트 러너 (기존)
  @types/node      ^20.x      (기존)
  @types/react     ^18.x      (기존)

외부 도구 (런타임 감지, npm 의존성 아님):
  git              >= 2.27    필수 (commit-graph + bloom filter 지원)
  gh               >= 2.0     선택 (GitHub / GitHub Enterprise API 프록시)
  glab             >= 1.30    선택 (GitLab / GitLab Self-Hosted API 프록시)
```

**신규 npm 의존성: `@ast-grep/napi` 1개.**
나머지는 기존 의존성 + Node.js 내장 모듈 + git CLI로 충당.

## 14. 핵심 설계 결정 (ADR)

| # | 결정 | 근거 |
|---|------|------|
| D1 | `tree-sitter` 대신 `@ast-grep/napi` | 단일 패키지, 프리빌드 바이너리, 20+ 언어 내장, ABI 버전 관리 불필요 |
| D2 | GumTree 대신 구조 시그니처 비교 | GumTree에 JS 포팅 없음; 시그니처 해싱으로 메서드 추출/이름변경/이동을 실용적 정밀도로 커버 |
| D3 | `octokit` 대신 `gh`/`glab` CLI 프록시 | 토큰 관리 불필요, 기존 인증 재사용, Enterprise 호스트별 인증 자동 지원 |
| D4 | SQLite/W-TinyLFU 대신 JSON 파일 캐시 | 단일 프로세스 CLI; 불변 데이터는 축출 정책 불필요; 의존성 제로 |
| D5 | 하드 요구사항 대신 Graceful Degradation (L2/L1/L0) | 오프라인, CI, 최소 환경에서도 동작해야 함 |
| D6 | 단일 결과 대신 `TraceNode[]` 배열 반환 | IDE/LLM/도구가 자유롭게 소비할 수 있는 완전한 계보 체인 보존 |
| D7 | opt-in이 아닌 opt-out 방식의 AST diff (기본 ON) | 도구의 핵심 차별점; 속도 중시 시 `--no-ast` 플래그 사용 |
| D8 | API 폴백 전에 Patch-ID 스캔 우선 | 오프라인 능력 극대화; API는 최후의 수단 |
| D9 | GraphQL 배치로 API 호출 최소화 | 범위 추적 시 N개 커밋을 1회 GraphQL로 처리; ETag로 304 확보 |
| D10 | 이중 배포 (CLI + 라이브러리) | IDE 플러그인, CI, LLM 에이전트가 프로그래밍 방식으로 호출 가능 |
| D11 | 정규화 응답 봉투 (`NormalizedResponse<T>`) | LLM이 성공/부분성공/에러를 일관되게 판별하고 후속 액션을 결정할 수 있음 |
| D12 | 비대화형 모드 자동 감지 (TTY / CI / 플래그) | 파이프라인, 스크립트, LLM 에이전트에서 별도 설정 없이 즉시 사용 가능 |
