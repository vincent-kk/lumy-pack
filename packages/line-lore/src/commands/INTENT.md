# commands — CLI 명령어 등록

## Purpose

Commander.js 서브 명령어(trace, health, cache, graph)를 등록하고 CLI 옵션 파싱과 함께 core 함수에 연결한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 모든 등록 함수의 배럴 익스포트 |

## Conventions

- 각 명령어는 별도 파일에서 `register*Command()`로 익스포트
- 명령어는 비즈니스 로직을 `core/`에 위임

## Boundaries

### Always do

- `program.command()` 패턴으로 명령어 등록
- 모든 로직을 core 레이어에 위임

### Ask first

- 새로운 최상위 CLI 명령어 추가

### Never do

- 명령어 핸들러에서 비즈니스 로직 구현
