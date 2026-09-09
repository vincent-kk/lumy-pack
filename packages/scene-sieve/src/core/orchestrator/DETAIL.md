# SPEC: orchestrator

## Requirements

`SieveOptions`를 받아 프레임 추출·분석·가지치기·출력의 5단계를 순서대로 수행하고 `SieveResult`를 돌려준다. 긴 입력은 segmenter로 위임하되 호출자에게는 같은 계약을 보인다. CLI는 같은 파이프라인을 Worker 스레드에서 실행해 UI 스레드를 비워 둘 수 있어야 한다.

## API Contracts

### `runPipeline(options: SieveOptions): Promise<SieveResult>`

- 호출 시작에서 `setDebugMode(options.debug ?? false)`를 설정한다.
- `resolveOptions(options)` 뒤 `shouldSegment(resolvedOptions, options)`가 참이면 `runSegmentedPipeline`으로 위임하고 그 결과를 그대로 반환한다.
- 그렇지 않으면 `ProcessContext`를 만들고 상태를 `INIT → EXTRACTING → ANALYZING → PRUNING → FINALIZING → SUCCESS` 순으로 전이한다. 예외가 나면 `FAILED`로 바꾸고 다시 던진다.
- 각 단계 진입·진행 시 `options.onProgress(ctx.status, percent)`를 호출한다. `INIT` 이전이나 종료 상태에서는 호출하지 않는다.
- 단계 구현은 형제 프랙탈의 entry에서 가져온다: `resolveInput`/`resolveOptions`(input-resolver), `extractFrames`(extractor), `analyzeFrames`(analyzer), `pruneByThresholdWithCap`(pruner), `createWorkspace`/`finalizeOutput`/`readFramesAsBuffers`/`cleanupWorkspace`(workspace). 최종 `video`와 출력 좌표계 `animations`는 core organ `utils/metadata/build-video-metadata.ts`의 `buildVideoMetadata`로 만든다(계약은 `core/DETAIL.md`).
- `finally`에서 `resolvedOptions.debug`가 거짓이면 `cleanupWorkspace(ctx.workspacePath)`를 실행하고, 참이면 경로를 debug 로그로 남기고 보존한다.
- `ctx.effectiveFps`·`ctx.sourceDurationSec`·`ctx.analysisResolution`은 단계 함수가 채우며 orchestrator는 읽기만 한다.

### `runPipelineInWorker(options: SieveWorkerOptions, onProgress: (phase: ProgressPhase, percent: number) => void): Promise<SieveResult>`

- `SieveWorkerOptions = Omit<SieveOptionsBase, 'onProgress'> & SieveInput` — Worker에 구조화 복제로 전달되므로 콜백을 포함하지 않는다.
- 현재 파일이 `.mjs`로 끝나지 않으면(tsx 개발 실행) `runPipeline({ ...options, onProgress })`를 같은 스레드에서 실행한다.
- `.mjs`이면 같은 디렉터리의 `pipeline-worker.mjs`를 `new Worker(workerPath, { workerData: options })`로 띄운다. dist는 평면이므로 소스 트리에서의 위치와 무관하다.
- 메시지 계약: `{ type: 'progress', phase, percent }`는 `onProgress`로 전달, `{ type: 'result', result }`는 resolve 후 `terminate()`, `{ type: 'error', message }`는 `Error(message)`로 reject 후 `terminate()`.
- `error` 이벤트는 그대로 reject한다. 결과 메시지 없이 `exit`하면 종료 코드 0·1을 포함해 `Worker exited with code <n> without a result`로 reject한다. 이미 정착한 Promise는 후속 `exit`로 바뀌지 않는다.

### `worker/pipeline-worker.ts` (스레드 쪽, `node:worker_threads`가 실행)

- `workerData`를 `Omit<SieveOptions, 'onProgress'>`로 받아 `runPipeline`을 실행하고, `onProgress`를 `parentPort.postMessage({ type: 'progress', … })`로 연결한다.
- 성공은 `{ type: 'result', result }`, 실패는 `{ type: 'error', message }`(Error가 아니면 `String(error)`)로 보고한다.
- 이 파일은 `rolldown.config.ts`의 별도 입력 `pipeline-worker`로 번들된다. 사용자 대상 실행 파일이 아니다.

## Acceptance Criteria

### stage-order — 5단계 순차 실행

- 단일 세그먼트 경로에서 상태는 `INIT, EXTRACTING, ANALYZING, PRUNING, FINALIZING, SUCCESS` 순으로만 전이하고 `onProgress`도 같은 순서로 호출된다.
- 어느 단계에서든 예외가 나면 상태는 `FAILED`가 되고 같은 예외가 호출자에게 전달된다.
- `shouldSegment`가 참인 입력은 `runSegmentedPipeline`의 결과를 그대로 반환한다.

### debug-state — 호출 단위 debug 상태

- `debug: true` 호출 뒤 `debug` 미지정 호출은 debug 로그를 내지 않는다.
- `debug: true`이면 workspace가 남고, 그렇지 않으면 성공·실패 모두에서 삭제된다.

### worker-lifecycle — Worker 실행 계약

- 번들 경로에서 `runPipelineInWorker`는 `pipeline-worker.mjs`를 Worker로 띄우고 `progress` 메시지를 `onProgress`로 전달한다.
- 결과 없이 종료 코드 0·1·2로 exit한 Worker는 코드가 포함된 메시지로 reject한다.
- `result` 또는 `error` 메시지로 정착한 뒤의 `exit`는 결과를 바꾸지 않는다.
- tsx 실행(`.ts`)에서는 Worker를 만들지 않고 같은 스레드에서 실행한다.

## Last Updated

2026-09-10
