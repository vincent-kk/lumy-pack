# scheduler — API 요청 스케줄링

## Purpose

모든 플랫폼 어댑터에 걸쳐 API 할당량 사용을 최소화하기 위한 API 속도 제한 및 ETag 기반 조건부 요청을 관리한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `request-scheduler.ts` | 속도 제한 추적 및 ETag 캐시가 있는 `RequestScheduler` 클래스 |

## Conventions

- 기본 속도 제한 임계값: 잔여 요청 10개
- ETag 캐시로 HTTP 304 응답 활성화

## Boundaries

### Always do

- API 요청 전 속도 제한 확인
- 반복 요청에 ETag 캐싱 사용

### Ask first

- 속도 제한 임계값 기본값 변경

### Never do

- 스케줄러를 거치지 않고 API 요청 수행
