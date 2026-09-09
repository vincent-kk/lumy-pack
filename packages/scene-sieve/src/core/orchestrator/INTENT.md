# orchestrator

## Purpose

`runPipeline` 하나로 5단계 파이프라인(Init → Extract → Analyze → Prune → Finalize)을 순서대로 실행하고, 긴 입력은 segmenter에 위임한다. CLI가 스피너를 멈추지 않도록 같은 파이프라인을 Worker 스레드에서 실행하는 전략(`runPipelineInWorker`)도 이 프랙탈이 소유한다.

## Conventions

- 파이프라인 상태는 `ProcessContext` 하나에 모으고 단계 전환은 이 프랙탈 안에서만 일어난다.
- 매 호출 시작에서 `setDebugMode(options.debug ?? false)`를 호출해 이전 호출의 debug 상태가 남지 않게 한다.
- 단계 함수는 형제 프랙탈의 entry에서 가져온다. 형제의 내부 파일은 참조하지 않는다.
- Worker 전략은 실행 파일 확장자로 결정한다: 번들(`.mjs`)이면 Worker, 그 외(tsx 개발 실행)는 같은 스레드.

## Structure

`worker/`는 Worker 생성·메시지 수신과 스레드 실행을 함께 소유하는 organ이다. 스레드 진입점은 import로 연결되지 않는다. `node:worker_threads`가 빌드 출력 디렉터리의 `pipeline-worker.mjs`를 실행하며, 이 번들은 rolldown의 별도 입력으로 만들어진다. 소스 진입점을 옮기면 빌드 입력 경로도 함께 바꾼다.

## Boundaries

- 라이브러리는 `runPipeline`, CLI는 실행 모드에 따라 `runPipeline` 또는 `runPipelineInWorker`를 core 집합 entry를 통해 사용한다. Worker 옵션 타입도 이 실행 계약에 속한다.
- 단계별 알고리즘(추출·분석·가지치기·workspace)의 계약은 각 형제 프랙탈의 문서가 소유한다. 여기서는 순서·상태 전환·오류 전파·정리만 다룬다.

## Always do

- 성공·실패와 무관하게 `finally`에서 workspace를 정리한다. debug 모드에서만 보존한다.
- 진행률은 `onProgress(phase, percent)`로만 보고한다. Worker 경로에서도 같은 시그니처를 유지한다.
- Worker가 결과 메시지 없이 종료하면 종료 코드를 포함해 reject한다.

## Ask first

- 파이프라인 단계 추가·제거·순서 변경
- `ProcessContext` 필드 추가
- Worker 전략 판정 기준(확장자) 변경

## Never do

- 이 프랙탈 밖에서 `ProcessContext`를 직접 조작하지 않는다.
- 형제 프랙탈의 내부 파일을 import하지 않는다 — entry만 사용한다.
- 결과나 오류로 이미 정착한 Promise를 이후 `exit` 이벤트로 바꾸지 않는다.
