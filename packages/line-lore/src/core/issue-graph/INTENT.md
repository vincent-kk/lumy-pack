# issue-graph — PR-이슈 그래프 탐색

## Purpose

플랫폼 API를 통해 PR과 이슈 간 관계 그래프를 탐색하여, 설정 가능한 깊이까지 관련 작업 항목의 연결 그래프를 구축한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `issue-graph.ts` | BFS 탐색의 `traverseIssueGraph()` |

## Conventions

- 기본 최대 깊이 2
- 유효한 `PlatformAdapter` 필요 (Level 2만)

## Boundaries

### Always do

- 무한 탐색 방지를 위해 `maxDepth` 준수
- 추적 결과와 호환되는 `TraceNode[]` 반환

### Ask first

- 기본 탐색 깊이 변경

### Never do

- 깊이 제한 없이 탐색
