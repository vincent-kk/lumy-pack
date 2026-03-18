# 01. 시스템 개요 및 모듈 아키텍처

> 원본: [architecture.md](./architecture.md) 1~2장

## 시스템 개요

line-lore는 코드 라인에서 출발하여 해당 라인이 도입된 원본 Pull Request를
4단계 결정론적 파이프라인으로 역추적하는 CLI 도구다.
ML/LLM을 사용하지 않으며, 동일한 저장소 상태에서 항상 동일한 결과를 보장한다.

**이중 배포**: CLI 도구인 동시에 node_modules로 import 가능한 프로그래밍 라이브러리.

```
입력:  파일 경로 + 라인 번호
출력:  TraceNode[] (계보 노드의 정렬된 배열)

┌─────────────────────────────────────────────────────────────────┐
│               CLI (commander + ink)  /  Programmatic API        │
├─────────────────────────────────────────────────────────────────┤
│                       추적 오케스트레이터                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ 1단계    │→ │ 2단계    │→ │ 3단계    │→ │  4단계       │    │
│  │ 라인 →   │  │ 커밋 →   │  │ 단절    │  │  PR 매핑     │    │
│  │ 커밋     │  │ 병합     │  │ 해소     │  │  + 이슈 그래프│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  플랫폼 어댑터       캐시      AST 엔진      Git 실행기          │
│  (gh/glab 프록시)    (fs)   (ast-grep/napi)   (execa)           │
└─────────────────────────────────────────────────────────────────┘
```

## 학술적 배경: 병합 전략별 추적 가능성

> 발췌: [raw/line-to-pr-trace-design-review.md](./raw/line-to-pr-trace-design-review.md)

- **Merge Commit 전략**: 원본 커밋 해시가 보존됨. `--ancestry-path` 기반
  위상 정렬 그래프 순회만으로 높은 정확도로 PR 매핑 가능.
- **Squash Merge**: 기능 브랜치의 여러 커밋이 단일 커밋으로 압축됨.
  커밋 메시지의 `(#NNN)` 관례 또는 플랫폼 API에 의존.
- **Rebase Merge**: 커밋이 재작성되어 새로운 해시 부여. 원본과의
  구조적 연결 고리가 완전히 단절됨. Git 로컬 히스토리만으로는
  추적이 수학적으로 불가능 → 플랫폼 API가 진실의 원천(Source of Truth).

## 모듈 아키텍처 (FCA)

> 상세 디렉토리 트리, zero-peer-file 검증, FCA 분류표는
> [architecture.md](./architecture.md) 2장 참조.

### 의존성 흐름

```
cli.ts ──→ commands/ ──→ core/index.ts ──→ 각 파이프라인 단계 barrel
                     ──→ components/
                     ──→ output/

core/blame/       ──→ git/        (git blame 실행)
core/ast-diff/    ──→ ast/        (AST 파싱 위임)
core/ancestry/    ──→ git/        (git log 실행)
core/patch-id/    ──→ git/        (git patch-id 실행)
core/pr-lookup/   ──→ platform/   (API 호출 위임)
core/issue-graph/ ──→ platform/   (API 호출 위임)

platform/github/  ──→ git/        (gh CLI 실행)
platform/gitlab/  ──→ git/        (glab CLI 실행)
```

**금지**: 형제 fractal 노드 간 직접 import. 모든 조율은 부모 eponymous 파일 경유.

## 의존성 맵

```
프로덕션:
  commander ^12.1.0, execa ^9.5.0, ink ^5.0.0, ink-spinner ^5.0.0,
  react ^18.0.0, picocolors ^1.1.1    (기존)
  @ast-grep/napi ^0.36.x              (신규 — 유일한 추가 의존성)

외부 도구 (런타임 감지):
  git >= 2.27 (필수), gh >= 2.0 (선택), glab >= 1.30 (선택)
```
