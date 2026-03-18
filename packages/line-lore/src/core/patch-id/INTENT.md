# patch-id — 스쿼시 감지

## Purpose

`git patch-id`를 사용하여 콘텐츠 유사성으로 브랜치 간 커밋을 매칭하여 체리픽 또는 스쿼시된 커밋을 감지한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `patch-id.ts` | 캐시된 patch-id 계산과 `findPatchIdMatch()` |

## Conventions

- 기본 스캔 깊이 500 커밋
- `FileCache`를 통해 결과 캐싱 (`sha-to-patch-id.json`)

## Boundaries

### Always do

- 성능을 위해 계산된 patch-id 캐싱
- 스캔 깊이 제한 준수

### Ask first

- 기본 스캔 깊이 변경

### Never do

- 캐싱 없이 patch-id 계산
