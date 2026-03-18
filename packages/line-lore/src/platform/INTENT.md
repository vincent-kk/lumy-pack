# platform — 플랫폼 API 어댑터

## Purpose

git 리모트 플랫폼(GitHub, GitLab, Enterprise 변형)을 감지하고 PR/이슈 API 접근을 위한 통합 `PlatformAdapter` 구현을 제공한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 및 `detectPlatformAdapter()` |
| `platform.ts` | `RemoteInfo` 기반 어댑터 팩토리 |
| `github/` | GitHub 및 GitHub Enterprise 어댑터 |
| `gitlab/` | GitLab 및 GitLab self-hosted 어댑터 |
| `scheduler/` | API 요청 속도 제한 및 ETag 캐싱 |

## Conventions

- 모든 어댑터는 `PlatformAdapter` 인터페이스 구현
- git 리모트 URL로부터 자동 감지

## Boundaries

### Always do

- 모든 API 호출에 `RequestScheduler` 사용
- 표준 및 self-hosted 변형 모두 구현

### Ask first

- 새 플랫폼 지원 추가 (Bitbucket 등)

### Never do

- API 토큰 하드코딩; 환경 변수 사용
