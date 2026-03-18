# 03. 플랫폼 프로바이더 및 API 최적화

> 원본: [architecture.md](./architecture.md) 4~5장

## 프로바이더 추상화

모든 어댑터는 `PlatformAdapter` 인터페이스를 구현한다.
플랫폼별 차이는 어댑터 내부에 캡슐화.

```typescript
interface PlatformAdapter {
  readonly platform: 'github' | 'github-enterprise' | 'gitlab' | 'gitlab-self-hosted';
  checkAuth(): Promise<AuthStatus>;
  getPRForCommit(sha: string): Promise<PRInfo | null>;
  getPRCommits(prNumber: number): Promise<string[]>;
  getLinkedIssues(prNumber: number): Promise<IssueInfo[]>;
  getLinkedPRs(issueNumber: number): Promise<PRInfo[]>;
  getRateLimit(): Promise<RateLimitInfo>;
}
```

## 프로바이더별 인증

| 프로바이더 | CLI | 1순위 | 2순위 | 3순위 |
|-----------|-----|-------|-------|-------|
| GitHub.com | `gh` | `gh auth status` | `GH_TOKEN` | `GITHUB_TOKEN` |
| GitHub Enterprise | `gh` | `gh auth --hostname <host>` | `GH_ENTERPRISE_TOKEN` | `GH_TOKEN` |
| GitLab.com | `glab` | `glab auth status` | `GITLAB_TOKEN` | `GL_TOKEN` |
| GitLab Self-Hosted | `glab` | `glab auth --hostname <host>` | `GITLAB_TOKEN + GITLAB_HOST` | `GL_TOKEN + GL_HOST` |

**GitHub Enterprise 주의사항:**
- `gh CLI`는 `~/.config/gh/hosts.yml`에 호스트별 독립 토큰 관리
- `gh api <endpoint> --hostname <host>`로 명시적 지정
- GHES 3.0 미만은 `commits/{sha}/pulls` 미지원 → Level 1 폴백
- GraphQL 미지원 인스턴스 존재 → REST 전용 폴백

## 플랫폼 자동 감지

```
git remote get-url origin → URL 파싱
  github.com     → GitHub.com
  gitlab.com     → GitLab.com
  그 외           → gh auth --hostname 시도 → glab auth 시도 → PLATFORM_UNKNOWN
```

결과는 `platform-meta.json`에 캐시.

## API 요청 최소화

> **학술적 근거** (발췌: raw/line-to-pr-trace-design-review.md):
> API 프록시 기반 인증은 보안성과 편의성 모두 확보. 시스템이 직접 토큰을
> 관리하지 않고, 사용자 환경의 안전한 인증 세션을 재사용.

### 핵심 원칙

```
탐색 우선순위 (비용 오름차순):
  1. 로컬 캐시 조회         → 비용 0
  2. git 로컬 명령어        → 비용 0
  3. 커밋 메시지 정규식 파싱 → 비용 0
  4. 플랫폼 API 호출        → 비용 1 토큰
```

### 요청 회피 시나리오

- **Merge Commit 전략**: "Merge pull request #102 from ..." → API 0회
- **Squash Merge**: "feat: add validation (#102)" → API 0회
- **Rebase Merge**: patch-id 매핑 시도 (로컬) → 실패 시만 API

### 응답 최소화 기법

- **ETag/304**: `gh api -H "If-None-Match: <etag>"` → rate-limit 소비 없음
- **jq 필드 축소**: `--jq '{number, title, user: .user.login}'`
- **GraphQL 배치**: PR 상세 + 이슈를 단일 쿼리로

### Rate-Limit 방어

```
요청 → [캐시 히트?] → [남은 한도 확인] → [임계값 초과?]
  → 예: API 호출 → 결과 + ETag 캐시 저장
  → 아니오: Level 1 폴백 전환
  → 429 응답: Retry-After 존중, 즉시 폴백

임계값: GitHub remaining < 10 → 폴백, GitLab < 5 → 폴백
```

### 범위 추적 배치

40줄 범위에서 5개 고유 커밋 → 중복 제거 → 캐시 히트 제외 →
남은 N개를 GraphQL 단일 쿼리로 처리. 최악 40회 → 최적화 후 1회.
