# gitlab — GitLab 플랫폼 어댑터

## Purpose

GitLab 및 GitLab self-hosted 인스턴스용 `PlatformAdapter`를 구현하여 REST API를 통한 MR 조회, 이슈 검색, 인증을 제공한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `gitlab-adapter.ts` | gitlab.com용 `GitLabAdapter` |
| `gitlab-self-hosted-adapter.ts` | self-hosted용 `GitLabSelfHostedAdapter` |

## Conventions

- `GITLAB_TOKEN` 환경 변수로 GitLab REST API 사용
- `RequestScheduler`를 통한 속도 제한 관리

## Boundaries

### Always do

- 모든 API 요청에 `RequestScheduler` 사용
- gitlab.com과 self-hosted 인스턴스 모두 지원

### Ask first

- GraphQL API 지원 추가

### Never do

- gitlab.com을 유일한 호스트명으로 하드코딩
