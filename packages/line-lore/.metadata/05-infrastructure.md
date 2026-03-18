# 05. 운영 레벨, 캐싱, 에러 코드, 설계 결정

> 원본: [architecture.md](./architecture.md) 10~14장

## 운영 레벨 및 Graceful Degradation

```
시작 시 환경 감지:
  1. git rev-parse --git-dir      → git 저장소?
  2. git remote get-url origin    → 플랫폼 감지
  3. which gh / which glab        → CLI 설치?
  4. gh auth status --hostname    → 인증?
  5. commit-graph verify          → 가속 준비?
  6. @ast-grep/napi import        → AST 엔진?

결과: OperatingLevel (0 | 1 | 2)
    + FeatureFlags { astDiff, deepTrace, commitGraph, issueGraph, graphql }
```

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md):
> 우아한 성능 저하(Graceful Degradation) 메커니즘은 시스템의 무결성과
> 고가용성을 보장하는 핵심 설계 사상. 대규모 트래픽이나 인프라 장애 속에서도
> 개발자의 업무 흐름이 중단되지 않도록 보장.

| Level | 상태 | 기능 |
|-------|------|------|
| 2 (완전) | API 사용 가능 | 모든 기능 + 이슈 그래프 + 심층 추적 |
| 1 (부분) | API 불가 | 로컬 전용. 메시지 파싱. 이슈 그래프 불가 |
| 0 (Git만) | CLI 미설치 | Level 1 + 도구 설치 안내 |

AST diff는 API 레벨과 독립 (로컬 실행). 네이티브 바이너리 실패 시 blame 전용 폴백.

## 캐싱 아키텍처

```
~/.line-lore/
├── cache/
│   ├── sha-to-pr.json          # 불변
│   ├── sha-to-patch-id.json    # 불변
│   ├── pr-to-issues.json       # 준불변 (ETag 검증)
│   ├── etags.json              # API 조건부 요청용
│   └── platform-meta.json
└── config.json                 # 사용자 설정
```

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md):
> 커밋 SHA와 PR 번호 데이터는 불변(Immutable)의 특성. W-TinyLFU가 이론적
> 최적이나, CLI 단일 프로세스 특성상 JSON 파일 캐시로 충분.
> 불변 데이터는 축출 정책 불필요.

- SHA 기반: 만료 없음 / 이슈 캐시: ETag 조건부 갱신
- 원자적 교체: 임시파일 → rename
- 파일당 최대 10,000 항목 (FIFO)

## 에러 코드

```typescript
const LineLoreErrorCode = {
  // 기존
  NOT_GIT_REPO, FILE_NOT_FOUND, INVALID_LINE, GIT_BLAME_FAILED, PR_NOT_FOUND, UNKNOWN,
  // 단계별
  ANCESTRY_PATH_FAILED, PATCH_ID_NO_MATCH, AST_PARSE_FAILED, AST_ENGINE_UNAVAILABLE,
  // 플랫폼
  PLATFORM_UNKNOWN, CLI_NOT_INSTALLED, CLI_NOT_AUTHENTICATED,
  API_RATE_LIMITED, API_REQUEST_FAILED, GRAPHQL_NOT_SUPPORTED,
  ENTERPRISE_VERSION_UNSUPPORTED,
  // 이슈 그래프
  ISSUE_NOT_FOUND, GRAPH_DEPTH_EXCEEDED, GRAPH_CYCLE_DETECTED,
  // 캐시
  CACHE_CORRUPTED,
} as const;
```

## 핵심 설계 결정 (ADR)

| # | 결정 | 근거 |
|---|------|------|
| D1 | `@ast-grep/napi` over `tree-sitter` | 단일 패키지, 프리빌드, 20+ 언어, ABI 관리 불필요 |
| D2 | 구조 시그니처 비교 over GumTree | JS 포팅 없음; 실용적 정밀도 |
| D3 | `gh`/`glab` CLI 프록시 over `octokit` | 토큰 관리 불필요, Enterprise 자동 지원 |
| D4 | JSON 파일 캐시 over SQLite | 불변 데이터, 의존성 제로 |
| D5 | Graceful Degradation (L2/L1/L0) | 오프라인/CI/최소 환경 |
| D6 | `TraceNode[]` 배열 반환 | IDE/LLM 자유 소비 |
| D7 | AST diff opt-out (기본 ON) | 핵심 차별점 |
| D8 | Patch-ID 우선 → API 폴백 | 오프라인 극대화 |
| D9 | GraphQL 배치 | N커밋 → 1회 API |
| D10 | 이중 배포 (CLI + 라이브러리) | IDE/CI/LLM 호출 |
| D11 | `NormalizedResponse<T>` 봉투 | LLM 일관된 파싱 |
| D12 | TTY 자동 감지 비대화형 | 파이프/스크립트 즉시 사용 |
