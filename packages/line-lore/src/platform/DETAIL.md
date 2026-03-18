# 플랫폼 어댑터 명세

## Requirements

- git 리모트 URL(SSH 및 HTTPS)에서 플랫폼 자동 감지
- 모든 플랫폼에 걸친 통합 `PlatformAdapter` 인터페이스 제공
- ETag를 통한 속도 제한 및 조건부 요청 처리

## API Contracts

- `detectPlatformAdapter(options?): Promise<{ adapter: PlatformAdapter; remote: RemoteInfo }>` — 자동 감지 및 어댑터 생성
- `PlatformAdapter.getPR(owner, repo, number): Promise<PRInfo>` — PR 정보 조회
- `PlatformAdapter.getIssue(owner, repo, number): Promise<IssueInfo>` — 이슈 정보 조회
- `PlatformAdapter.checkAuth(): Promise<AuthStatus>` — 인증 확인

## Last Updated

2026-03-19
