# line-lore 개발 계획

> 설계 문서: [architecture.md](./architecture.md)
> 원본 리서치: [raw/line-to-pr-trace-design-review.md](./raw/line-to-pr-trace-design-review.md)

## 설계 문서 인덱스

| 파일 | 내용 |
|------|------|
| [01-overview.md](./01-overview.md) | 시스템 개요, 모듈 아키텍처, 의존성 |
| [02-pipeline.md](./02-pipeline.md) | 4단계 파이프라인 상세 (blame, AST, ancestry, patch-id, PR) |
| [03-platform.md](./03-platform.md) | 프로바이더 인증, API 최소화, rate-limit 방어 |
| [04-extensions.md](./04-extensions.md) | 이슈 그래프, 이중 배포, CLI, LLM 출력 |
| [05-infrastructure.md](./05-infrastructure.md) | 운영 레벨, 캐싱, 에러 코드, ADR |
| [test-strategy.md](./test-strategy.md) | 테스트 전략 및 항목 |
| [architecture.md](./architecture.md) | 통합 블루프린트 (전체 원본) |

## 개발 단계

### Phase 0: 기반 인프라

> 참조: [01-overview.md](./01-overview.md), [05-infrastructure.md](./05-infrastructure.md)

- [ ] `types/index.ts` — 전체 타입 정의 확정 (TraceNode, PlatformAdapter 등)
- [ ] `errors.ts` — 에러 코드 확장 반영
- [ ] `git/executor.ts` — execa 기반 git 명령 실행기
- [ ] `git/remote.ts` — remote URL 파싱 + 플랫폼 감지
- [ ] `git/health.ts` — commit-graph / bloom filter 가용성 점검
- [ ] `cache/file-cache.ts` — JSON 파일 캐시 (읽기/쓰기/원자적 교체)
- [ ] `utils/line-range.ts` — 라인 범위 파싱/검증

**완료 기준**: git 명령 실행, 캐시 읽기/쓰기, 타입 시스템 안정

### Phase 1: 핵심 파이프라인 — 1단계 (Blame + AST)

> 참조: [02-pipeline.md](./02-pipeline.md) 1단계

- [ ] `core/blame/parsing/blame-parser.ts` — porcelain 출력 파서
- [ ] `core/blame/detection/cosmetic-detector.ts` — 외관상 커밋 판별
- [ ] `core/blame/blame.ts` — 진입점 (파서 + 판별기 조율)
- [ ] `ast/parser.ts` — @ast-grep/napi 다중 언어 래퍼
- [ ] `core/ast-diff/extraction/symbol-extractor.ts` — 심볼 추출
- [ ] `core/ast-diff/extraction/signature-hasher.ts` — 콘텐츠 해시
- [ ] `core/ast-diff/comparison/structure-comparator.ts` — 구조 비교
- [ ] `core/ast-diff/ast-diff.ts` — AST 역추적 진입점

**완료 기준**: 파일+라인 → 원본 커밋 SHA 반환 (AST 포함)

### Phase 2: 핵심 파이프라인 — 2~3단계 (Ancestry + Patch-ID)

> 참조: [02-pipeline.md](./02-pipeline.md) 2~3단계

- [ ] `core/ancestry/ancestry.ts` — ancestry-path 병합 커밋 탐색
- [ ] `core/patch-id/patch-id.ts` — patch-id 충돌 매핑 + 캐시

**완료 기준**: 커밋 SHA → 병합 커밋 발견 (rebase/squash 포함)

### Phase 3: 플랫폼 계층 + PR 매핑

> 참조: [03-platform.md](./03-platform.md)

- [ ] `platform/github/github-adapter.ts` — GitHub.com 어댑터
- [ ] `platform/github/github-enterprise-adapter.ts` — GHES 어댑터
- [ ] `platform/gitlab/gitlab-adapter.ts` — GitLab.com 어댑터
- [ ] `platform/gitlab/gitlab-self-hosted-adapter.ts` — Self-Hosted 어댑터
- [ ] `platform/scheduler/request-scheduler.ts` — rate-limit + ETag + 배치
- [ ] `platform/platform.ts` — 감지 + 팩토리
- [ ] `core/pr-lookup/pr-lookup.ts` — 3-Level 폴백 체인

**완료 기준**: 커밋 → PR 매핑 (4개 플랫폼, Graceful Degradation)

### Phase 4: 오케스트레이터 + 출력

> 참조: [02-pipeline.md](./02-pipeline.md), [04-extensions.md](./04-extensions.md)

- [ ] `core/core.ts` — 파이프라인 오케스트레이터 (1→2→3→4 조율)
- [ ] `output/normalizer.ts` — NormalizedResponse 봉투
- [ ] `output/formats.ts` — human / json / llm 출력
- [ ] `output/help-schema.ts` — LLM용 JSON 도움말

**완료 기준**: `trace()` 함수 end-to-end 동작 (프로그래밍 API)

### Phase 5: CLI + UI

> 참조: [04-extensions.md](./04-extensions.md)

- [ ] `commands/trace.tsx` — trace 명령어 (대화형 + 비대화형)
- [ ] `commands/health.tsx` — health 명령어
- [ ] `commands/cache.tsx` — cache 명령어
- [ ] `components/TraceProgress.tsx` — 실시간 진행 표시
- [ ] `components/TraceResult.tsx` — 결과 렌더러
- [ ] `cli.ts` — 명령어 등록 + TTY 감지

**완료 기준**: `line-lore trace <file> -L <line>` CLI 동작

### Phase 6: 확장 기능

> 참조: [04-extensions.md](./04-extensions.md)

- [ ] `core/issue-graph/issue-graph.ts` — PR↔이슈 양방향 탐색
- [ ] `commands/graph.tsx` — graph 명령어
- [ ] `--deep` 플래그 구현 (squash PR 재귀 탐색)
- [ ] `--graph-depth` 통합

**완료 기준**: 이슈 그래프 탐색 + deep trace 동작

### Phase 7: 마무리

- [ ] `index.ts` — 공개 API 확정 (trace, graph, health, clearCache)
- [ ] package.json exports 맵 확정
- [ ] README.md 작성
- [ ] 통합 테스트 + E2E 시나리오
- [ ] changeset 생성

## 의존 관계

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 4 ──→ Phase 5
                     ──→ Phase 3 ──↗            ──→ Phase 6
                                                ──→ Phase 7
```

Phase 1과 Phase 3은 병렬 진행 가능 (Phase 0 완료 후).
