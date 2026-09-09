# SPEC: cli

## Requirements

`scene-sieve <input> [options]` 명령. 사람에게는 Ink 단계 표시를, 도구에게는 `--json`/`--describe` 구조화 응답을 제공한다. 파이프라인 결과와 오류를 왜곡 없이 전달한다.

## API Contracts

### Entry

- `index.ts`는 실행 파일 `../cli.ts`가 쓰는 `registerSieveCommand(program, version)`, `SIEVE_COMMAND`, `SieveErrorCode`만 export한다.
- 실행 파일은 패키지 version을 `createRequire`로 읽어 commander 프로그램에 붙이고, `--describe`를 `parseAsync` 전에 처리한 뒤 종료 코드 0으로 끝낸다. `parseAsync` 거부는 `--json`이면 `respondError('extract', UNKNOWN, …)`, 아니면 `Fatal error: <message>`를 stderr에 쓰고 종료 코드 1이다.

### 명령 등록

- `registerSieveCommand`는 레지스트리 `SIEVE_COMMAND`의 설명 문자열로 `<input>` 인자와 옵션을 등록한다. 등록 옵션: `-n, --count`, `-t, --threshold`, `-o, --output`, `--fps`, `-mf, --max-frames`, `-s, --scale`, `-q, --quality`, `-it, --iou-threshold`, `-at, --anim-threshold`, `--max-segment-duration`, `--concurrency`, `--debug`, `--json`, `--describe`.
- `--fps`, `--max-frames`, `--scale`, `--quality`는 소스 루트가 소유한 상수 organ의 기본값을 문자열로 붙인다. 나머지 숫자 옵션은 기본값 없이 생략 가능하고, 생략하면 파이프라인 기본값이 적용된다.

### 숫자 파싱

- `parsePipelineOptions(opts)`는 문자열 전체가 십진수(지수 허용)일 때만 숫자로 받고 그 외는 NaN을 낸다. 정수 옵션(count, maxFrames, scale, quality, animationThreshold, concurrency)에 소수를 주면 NaN이다. 소수 FPS와 세그먼트 길이는 허용한다.
- NaN은 그대로 파이프라인에 전달되어 `validateOptions`가 `<name> must be …, received: NaN`으로 거부한다. CLI는 범위를 검사하지 않는다.
- `debug`가 없으면 false다.

### `--describe`

- `respond('describe', { name, version, description, arguments, options }, startTime, version)`을 출력하고 `process.exit(0)`. `<input>`은 요구하지 않는다.

### `--json`

- `setJsonMode(true)`로 로거를 JSON 모드로 전환한다. 입력 파일이 없으면 `respondError('extract', FILE_NOT_FOUND, 'File not found: <input>')`.
- 성공 시 `respond('extract', { success, originalFrames, selectedFrames, outputFiles, animations, video }, startTime, version)`. `animations`는 빈 배열, `video`는 null로 기본값을 채운다.
- 진행률은 stderr에 `{"phase","percent"}` 한 줄씩 쓴다. stdout은 응답 JSON만 담는다.
- 파이프라인 오류는 `classifyError`로 코드를 정하고 `respondError('extract', code, message)`로 보고한다. 실패 종료 코드는 1이다.

### 오류 분류 `classifyError(error): SieveErrorCode`

| 조건(우선순위 순) | 코드 |
|---|---|
| 메시지에 `must be` | `INVALID_INPUT` |
| `ErrnoException.code === 'ENOENT'` 또는 메시지에 `not found` | `FILE_NOT_FOUND` |
| 메시지에 `no video stream` 또는 `invalid format` | `INVALID_FORMAT` |
| 메시지에 `worker` | `WORKER_ERROR` |
| 그 외 | `PIPELINE_ERROR` |

- 메시지 비교는 소문자로 한다. `UNKNOWN`은 실행 파일의 `parseAsync` 거부 경로에서만 쓴다.

### Ink 표시 (`SieveView`)

- 단계는 INIT, EXTRACTING, ANALYZING, PRUNING, FINALIZING 순서의 다섯 개이며 ANALYZING만 퍼센트를 표시한다.
- 시작 시 `cleanupStaleWorkspaces()`를 호출하고 실패는 무시한다. 이어 INIT을 running으로 표시하고 `runPipelineInWorker`를 호출한다.
- 진행 콜백의 phase가 바뀌면 이전 단계는 모두 done(100%, 소요 시간 기록), 현재 단계는 running으로 바꾼다. 같은 단계의 percent는 반올림해 갱신한다.
- 성공하면 남은 단계를 done으로 채우고 결과 요약(원본 프레임 수 → 선택 장면 수, 실행 시간, animation 수)을 표시한 뒤 100ms 후 종료한다. `--debug`면 출력 파일 목록도 표시한다.
- 실패하면 running 단계를 failed로 바꾸고 `✗ Failed — <message>`를 표시한 뒤 오류로 종료한다. `waitUntilExit`가 거부되어 실행 파일이 종료 코드 1로 끝낸다.

## Acceptance Criteria

### describe-json — 도구용 응답

- [ ] `scene-sieve --describe`는 입력 없이 종료 코드 0으로 `name: "scene-sieve"`를 포함한 JSON을 출력한다.
- [ ] `--json` 성공 응답의 data는 `success`, `originalFrames`, `selectedFrames`, `outputFiles`, `animations`, `video` 필드를 가진다.
- [ ] `--json` 실패 응답의 code는 `classifyError` 표와 일치하고 종료 코드는 1이다.

### numeric-parsing — 문자열 전체 검사

- [ ] `--count 2.5`, `--count 3abc`는 NaN으로 전달되어 `INVALID_INPUT`으로 거부된다.
- [ ] `--fps 0.5`, `--max-segment-duration 12.5`는 유한 수로 전달된다.

### phase-display — 단계 표시

- [ ] 다섯 단계가 순서대로 표시되고 실패 시 running 단계만 failed가 된다.
- [ ] 일반 모드는 Worker 스레드에서 파이프라인을 실행한다.

## Last Updated

2026-09-10
