# compress — 컨텍스트 압축 모듈

## Purpose

AI 에이전트 컨텍스트 창의 토큰 부담을 줄이기 위한 문서 압축을 담당한다. 가역 압축(파일 참조 방식)과 비가역 요약(도구 호출 로그 축약) 두 모드를 제공한다.

## Structure

| 파일 | 역할 |
|------|------|
| `reversible-compactor.ts` | 가역 압축 — 파일 내용을 참조 포인터로 대체 (`compactReversible`, `restoreFromCompacted`) |
| `lossy-summarizer.ts` | 비가역 요약 — 도구 호출 기록을 간결한 요약으로 축약 (`summarizeLossy`) |

## Conventions

- `reversible`: 원본 복원 가능 (파일 경로 + export 목록 보존)
- `lossy`: 복원 불가, 요약 품질 중심 (도구 이름·경로·타임스탬프만 보존)
- 두 모드 모두 순수 함수 또는 단순 I/O 래퍼

## Boundaries

### Always do

- `doc-compress` MCP 도구(`mcp/tools/doc-compress.ts`)를 통해서만 외부에서 호출
- `compactReversible` 반환값은 `restoreFromCompacted`로 항상 복원 가능해야 함
- 압축 결과에 원본 파일 경로와 export 목록 보존

### Ask first

- 새 압축 모드 추가 (`auto` 모드 외)
- 압축 포맷 스키마 변경 (역호환성 영향)

### Never do

- 원본 파일 내용을 디스크에서 삭제하거나 수정
- `lossy` 결과를 복원 가능하다고 표시
- `core/` 또는 `hooks/` 직접 import

## Dependencies

- `../types/documents.ts` — 압축 입출력 타입
