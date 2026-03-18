# github — GitHub 플랫폼 어댑터

## Purpose

GitHub 및 GitHub Enterprise용 `PlatformAdapter`를 구현하여 `gh` CLI와 REST API를 통한 PR 조회, 이슈 검색, 인증을 제공한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `github-adapter.ts` | github.com용 `GitHubAdapter` |
| `github-enterprise-adapter.ts` | GHE 인스턴스용 `GitHubEnterpriseAdapter` |

## Conventions

- API 호출에 `gh` CLI 사용 (토큰 관리 회피)
- `RequestScheduler`를 통한 속도 제한 관리

## Boundaries

### Always do

- 모든 API 요청에 `RequestScheduler` 사용
- github.com과 Enterprise 호스트명 모두 지원

### Ask first

- `gh` CLI에서 직접 REST API로 전환

### Never do

- github.com을 유일한 호스트명으로 하드코딩
