# line-lore src 명세

## Requirements

- 결정론적 4단계 파이프라인을 통해 모든 코드 라인을 원본 PR로 추적
- CLI 및 프로그래매틱 API 사용 지원
- 운영 수준 0–2에 걸친 우아한 성능 저하
- 멀티 플랫폼 지원 (GitHub, GitLab, Enterprise 변형)

## API Contracts

- `trace(options: TraceOptions): Promise<TraceFullResult>` — 메인 파이프라인 진입점
- `health(): Promise<HealthReport>` — 시스템 기능 확인
- `clearCache(): Promise<void>` — 모든 캐시 데이터 제거
- `traverseIssueGraph(adapter, type, number, options?): Promise<GraphResult>` — PR/이슈 그래프

## Last Updated

2026-03-19
