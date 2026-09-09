# SPEC: extractor

## Requirements

입력 영상을 FFmpeg FPS 격자 위의 JPEG 후보 프레임으로 추출하고, file/buffer 입력의 후보 수를 `maxFrames`로 엄격히 제한한다. frames 입력은 개수 제한 없이 그대로 통과한다. 추출 결과의 timestamp는 로컬 격자 시각이며, 상류가 전역 시각으로 변환한다.

## API Contracts

### `extractFrames(ctx: ProcessContext): Promise<FrameNode[]>`

- frames 모드: `ctx.frames`를 그대로 반환하고 `ctx.effectiveFps = 1`을 기록한다. `sourceDurationSec`은 기록하지 않는다.
- file/buffer 모드: `inputPath`가 없거나 파일이 없으면 오류를 던진다. ffprobe로 `format`과 `streams`를 읽어 `codec_type === 'video'` 스트림이 없으면 오류를 던진다. 메타데이터를 읽지 못해도 오류다.
- `frameLimit = Math.max(2, maxFrames)`. `duration > 0`이면 `effectiveFps = min(fps, frameLimit / duration)`, 아니면 `fps` 그대로다. FPS 하한은 없다.
- `ctx.effectiveFps`와 `ctx.sourceDurationSec`(ffprobe `format.duration`, 없으면 0)을 기록한 뒤 `-frames:v frameLimit`로 추출한다. 길이가 없는 입력도 개수 제한을 받는다.
- 필터는 `fps=<effectiveFps>,scale=-1:<scale>`, 품질은 `-q:v 2`, 출력 파일명은 `core/constants/workspace-layout.ts`의 `FRAME_FILENAME_PATTERN`이다. 출력 디렉터리는 `<workspacePath>/frames`.
- 반환 `FrameNode`의 `id`는 파일명 정렬 순서의 0-based 인덱스, `timestamp`는 `index / effectiveFps`, `extractPath`는 JPEG 절대 경로다. 예산이 묶이면 마지막 격자점은 `duration - duration / maxFrames`이며 그 뒤 구간에는 후보가 없다.
- 완료 시 `ctx.emitProgress(100)`을 호출한다.

### `extractFramesForRange(inputPath, outputDir, fps, scale, startTime, duration, frameLimit?): Promise<FrameNode[]>`

- 입력 seek(`-ss` before `-i`)와 `-t duration`으로 `[startTime, startTime + duration)` 범위를 같은 필터·품질로 추출한다.
- `frameLimit`은 `-frames:v` 상한이며 기본값은 `Math.ceil(duration * fps)`. 세그먼트 호출자는 overlap을 포함한 할당량을 명시한다.
- timestamp는 세그먼트 로컬(0부터)이다. seek 후 같은 슬롯의 픽셀이 전체 추출과 다를 수 있다.

### `getVideoMetadata(inputPath: string): Promise<FFprobeMetadata>`

- `ffprobe -v quiet -print_format json -show_format -show_streams`의 JSON을 그대로 반환한다. `format.duration`·`format.format_name`·`streams[].codec_type`을 소비자가 읽는다.

## Acceptance Criteria

### frame-budget — 후보 수 상한과 유효 FPS

- [ ] file/buffer 후보 수는 `Math.max(2, maxFrames)` 이하이고 frames 입력은 개수 제한을 받지 않는다.
- [ ] `effectiveFps = min(fps, frameLimit / duration)`이며 0.5 등 어떤 하한도 적용하지 않는다.
- [ ] 길이를 알 수 없는 입력에도 `-frames:v`가 적용된다.

### local-grid — 로컬 격자 timestamp

- [ ] `timestamp === id / effectiveFps`이며 세그먼트 seek 오프셋은 포함하지 않는다.
- [ ] `extractFramesForRange`의 첫 후보 timestamp는 0이다.

### context-fields — 컨텍스트 기록

- [ ] frames 모드는 `effectiveFps = 1`을, file/buffer 모드는 실제 격자 FPS와 ffprobe 길이를 `ProcessContext`에 기록한다.
- [ ] 비디오 스트림이 없는 입력은 포맷 이름을 포함한 오류로 거부한다.

## Last Updated

2026-09-10
