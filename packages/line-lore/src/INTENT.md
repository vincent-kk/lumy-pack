# src — line-lore 소스 루트

## Purpose

line-lore 라이브러리 및 CLI의 진입점. 4단계 파이프라인(Blame → 코스메틱 감지 → 조상 추적 → PR 조회)을 오케스트레이션하여 코드 라인을 원본 Pull Request로 추적한다.

## Structure

| 경로 | 역할 |
|------|------|
| `cli.ts` | Commander.js CLI 진입점 |
| `index.ts` | 공개 API 배럴 익스포트 |
| `errors.ts` | 커스텀 에러 타입 및 코드 |
| `core/` | 파이프라인 단계 및 오케스트레이션 |
| `ast/` | ast-grep 기반 AST 파싱 |
| `git/` | Git 명령 실행 및 리모트 감지 |
| `cache/` | 파일 기반 캐싱 레이어 |
| `output/` | 응답 포맷팅 (human, JSON, LLM) |
| `commands/` | CLI 명령어 등록 |
| `platform/` | GitHub/GitLab API 어댑터 |

## Conventions

- ESM 모듈, import 경로에 `.js` 확장자 사용
- `@/` 경로 별칭은 `src/`로 매핑
- 모든 공개 타입은 `types/`에서 재익스포트

## Boundaries

### Always do

- 공개 API는 반드시 `index.ts`를 통해서만 익스포트
- 도메인 에러는 `LineLoreError` 사용

### Ask first

- `core/core.ts`에 새로운 파이프라인 단계 추가
- 새로운 플랫폼 어댑터 추가

### Never do

- 프로덕션 코드에서 `__tests__/` 임포트
- `cache/`와 `git/` 외부에서 직접 파일시스템 접근
