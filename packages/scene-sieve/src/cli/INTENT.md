# cli

## Purpose

scene-sieve 명령의 사용자 표면. commander 명령 등록, Ink 진행 표시, `--json` 구조화 응답, 오류 분류를 소유한다. 파이프라인 동작은 소유하지 않는다.

## Conventions

- 명령 메타데이터(이름, 인자, 옵션 설명)는 명령 레지스트리 한 곳이 진실이다. `--help`와 `--describe`는 같은 원천을 읽는다.
- 옵션 기본값의 표시 문자열은 루트 상수 organ의 기본값에서 만든다. 문자열 상수를 따로 두지 않는다.
- 숫자 옵션은 문자열 전체를 검사하며 잘못된 입력은 NaN으로 넘겨 파이프라인의 범위 검증이 거부하게 한다. CLI는 범위를 재검증하지 않는다.
- 일반 모드는 `runPipelineInWorker`를 호출한다. 번들 `.mjs` 실행에서는 Worker로 CPU 작업을 분리해 Ink 스피너를 유지하고, Worker 번들이 없는 tsx 개발 실행에서는 같은 스레드로 fallback한다. `--json`은 표시가 없어 같은 스레드의 `runPipeline`을 사용한다.

## Boundaries

- 파이프라인에는 그 프랙탈 entry의 명명 export로만 접근한다.
- 실행 파일은 루트의 `cli.ts`이고 이 프랙탈의 entry는 `index.ts`다. 실행 파일이 필요로 하는 심볼만 entry에 올린다.
- 오류 분류(`classifyError`)는 메시지 문자열과 `ErrnoException.code`만 본다. 파이프라인이 던지는 오류 타입에 의존하지 않는다.

## Always do

- 새 옵션은 레지스트리 항목, commander 등록, 파싱, `SieveViewProps` 네 곳을 함께 바꾼다.
- 실패 종료 코드는 1로 유지한다. 성공한 `--describe`는 0이다.
- 시작 시 `cleanupStaleWorkspaces`를 호출하고 그 실패는 무시한다.

## Ask first

- 응답 JSON 스키마(`respond` data 필드) 변경.
- `SieveErrorCode` 항목 추가·삭제.
- 진행 단계 표시 목록 변경.

## Never do

- 파이프라인 내부 파일 직접 import.
- CLI 안에서 프레임 추출·분석·가지치기 로직 구현.
- `respond`/`respondError` 외의 방식으로 JSON 응답 출력.
