# cache — 파일 기반 캐싱

## Purpose

git 작업 결과와 API 응답을 `~/.line-lore/cache/`에 지속하기 위한 범용 파일 기반 JSON 캐시(`FileCache<T>`)를 제공한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `file-cache.ts` | `FileCache` 클래스 — get/set/clear 및 최대 엔트리 제거 |

## Conventions

- 캐시 파일은 기본적으로 `~/.line-lore/cache/`에 저장
- 크래시 안전을 위해 rename 기반 원자적 쓰기
- 최대 엔트리 설정 가능 (기본 10,000)

## Boundaries

### Always do

- 원자적 쓰기 (write + rename) 패턴 사용
- `maxEntries` 제한으로 FIFO 제거 준수

### Ask first

- 기본 캐시 디렉토리 위치 변경

### Never do

- 캐시 파일에 민감한 인증정보 저장
