# SPEC: input-resolver

## Requirements

잘못된 옵션은 파이프라인이 시작되기 전에 명확한 메시지로 거부하고, 유효한 옵션은 기본값이 채워진 `ResolvedOptions`로 정규화한다. file·buffer·frames 입력을 파이프라인 공통 형태(`FrameNode[]` 또는 정착된 입력 경로)로 바꾼다.

## API Contracts

### `resolveOptions(options: SieveOptions): ResolvedOptions`

- 먼저 `validateOptions(options)`를 호출한다.
- 생략된 옵션에는 `../../constants/pipeline-defaults.ts`의 기본값을 적용한다. 값과 규칙은 `../../DETAIL.md`의 Options 표를 따른다(`count` 20, `threshold` 0.5 등).
- `pruneMode`는 항상 `'threshold-with-cap'`이다.
- `outputPath`가 없으면 file 모드에서 입력 경로로부터 유도한다(`deriveOutputPath`).

### `validateOptions(options: SieveOptions): void` (`validation/validate-options.ts`)

- 지정한 숫자 옵션만 검사하며 기본값 적용 전에 실행된다. 검사 표: `count` 정수 ≥ 1, `threshold` 유한 (0, 1], `fps` 유한 > 0, `maxFrames` 정수 ≥ 2, `scale` 정수 ≥ 16, `quality` 정수 1–100, `iouThreshold` 유한 [0, 1], `animationThreshold` 정수 ≥ 1, `maxSegmentDuration` 유한 > 0, `concurrency` 정수 ≥ 1.
- 위반 시 `Error('<name> must be <requirement>, received: <value>')`를 던진다. 이 메시지는 CLI의 `classifyError`가 `INVALID_INPUT`으로 분류한다.
- `NaN`은 유한하지 않으므로 거부된다. CLI는 정수 옵션의 소수나 숫자 뒤 쓰레기 문자를 `NaN`으로 넘겨 이 검증에 맡긴다.
- 이 파일은 export 하나(`validateOptions`)만 가지며 소비자는 `resolveOptions`뿐이다.

### `resolveInput(options: SieveOptions, workspacePath: string): Promise<{ frames: FrameNode[]; resolvedInputPath?: string }>`

- file: 경로를 `expandTilde`·`resolveAbsolute`로 정착시키고 `resolvedInputPath`로 돌려준다. `frames`는 비어 있다(추출은 extractor의 일).
- buffer: `writeInputBuffer`로 workspace에 임시 파일을 쓰고 그 경로를 `resolvedInputPath`로 돌려준다.
- frames: 저장 전에 sharp `metadata()`로 모든 버퍼의 너비·높이를 비교하고, 불일치는 `inputFrames must be the same size (<w>x<h>), received: <w2>x<h2>` 형식으로 거부한다. 빈 배열과 한 장 입력은 허용한다. 통과하면 `writeInputFrames`로 저장해 `FrameNode[]`(id·timestamp = 인덱스)를 돌려준다.

## Acceptance Criteria

### option-validation — 기본값 적용 전 검증

- 표의 각 옵션에 대해 범위 밖·비정수·비유한 값은 `<name> must be …, received: <value>` 메시지로 거부된다.
- 지정하지 않은 옵션은 검증하지 않고 기본값을 받는다.
- `resolveOptions` 결과의 `pruneMode`는 언제나 `threshold-with-cap`이다.

### input-modes — 세 입력 모드 정착

- file 입력은 `~`와 상대 경로가 절대 경로로 정착된다.
- buffer 입력은 workspace 안의 임시 파일 경로를 돌려준다.
- frames 입력은 크기가 다른 버퍼가 섞이면 저장 전에 거부되고, 같은 크기면 인덱스 순서의 `FrameNode[]`를 돌려준다.

## Last Updated

2026-09-10
