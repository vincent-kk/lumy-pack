# Core 파이프라인 명세

## Requirements

- 플랫폼 감지 → (인증 확인 ∥ blame 실행) → 조상 추적 → PR 조회 단계를 오케스트레이션
- 인증 확인과 blame을 `Promise.allSettled`로 병렬 실행하여 지연 시간 최소화
- git 헬스 및 플랫폼 가용성으로 운영 수준 결정
- 스쿼시 머지 감지를 위한 AST diff 기반 딥 트레이싱 지원
- 결과를 노드, 경고, 수준이 포함된 `TraceFullResult`로 집계

## API Contracts

- `trace(options: TraceOptions): Promise<TraceFullResult>` — 전체 파이프라인 실행
- `health(): Promise<HealthReport>` — Git 버전, 플랫폼 인증, AST 가용성
- `clearCache(): Promise<void>` — 모든 FileCache 인스턴스 초기화
- `graph(options: GraphOptions): Promise<GraphResult>` — 플랫폼 인증 후 `traverseIssueGraph`에 위임하여 PR/이슈 관계 그래프 반환

## Last Updated

2026-03-21
