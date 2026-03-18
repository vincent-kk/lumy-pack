# ancestry — 머지 커밋 탐색

## Purpose

`git log --merges`를 탐색하여 주어진 커밋 SHA를 도입한 머지 커밋을 찾는다. 머지 커밋 메시지에서 PR 번호를 추출한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `ancestry.ts` | `findMergeCommit()` 및 `extractPRFromMergeMessage()` |

## Conventions

- 지정된 ref(기본 HEAD)에서 머지 커밋 검색
- GitHub/GitLab 머지 메시지 패턴으로 PR 번호 추출

## Boundaries

### Always do

- "Merge pull request #N" 및 "Merge branch" 패턴 모두 지원
- 머지 커밋 미발견 시 `null` 반환

### Ask first

- 새로운 머지 메시지 패턴 추가

### Never do

- 특정 머지 전략 가정
