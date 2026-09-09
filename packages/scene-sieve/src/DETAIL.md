# SPEC: src (scene-sieve)

## Requirements

동영상/GIF에서 유의미한 핵심 프레임을 자동 선별하는 라이브러리.

## API Contracts

### `extractScenes(options: SieveOptions): Promise<SieveResult>`

- 3가지 입력 모드: file, buffer, frames
- count/threshold 기반 가지치기 전략 자동 결정
- 결과: 선별된 프레임 경로 또는 Buffer 배열

## Options

| 옵션 | 기본값 | 의미 | 검증 규칙 |
|---|---|---|---|
| `count` | 20 | 최종 선택 개수 상한 | T8에서 정의 |
| `threshold` | 0.5 | 정규화 점수 기준 | 현재 0~1, T8에서 정렬 |
| `fps` | 5 | file/buffer 요청 추출 FPS | T8에서 정의 |
| `maxFrames` | 300 | file/buffer 후보 수의 엄격한 상한. 유효 FPS는 `min(fps, maxFrames / duration)`이며 하한 없음. frames 입력에는 미적용 | 현재 최소 2로 방어, T8에서 정수 ≥ 2 검증 |
| `scale` | 720 | 분석용 추출 이미지 높이 | T8에서 정의 |
| `quality` | 80 | 출력 JPEG 품질 | T8에서 정의 |
| `iouThreshold` | 0.9 | 애니메이션 추적 IoU 기준 | T8에서 정의 |
| `animationThreshold` | 5 | 애니메이션 판정 연속 프레임 수 | T8에서 정의 |
| `maxSegmentDuration` | 300초 | 논리 세그먼트 길이 | T8에서 정의 |
| `concurrency` | 2 | 세그먼트 병렬 처리 수 | T8에서 정의 |
| `outputPath` | 입력 경로에서 유도 | file 출력 디렉터리 | T8에서 정의 |
| `debug` | false | 임시 workspace 보존 | T8에서 정의 |
| `onProgress` | 없음 | 단계별 진행률 콜백 | T8에서 정의 |

`ProcessContext.effectiveFps?`는 실제 추출 격자의 FPS이며 frames 모드에서는 1이다.
`sourceDurationSec?`은 ffprobe가 반환한 원본 길이이다. 두 필드는 추출·분할 경로에서 채우며 기존 배열 반환 호출을 유지한다.
예산이 묶이는 file/buffer timestamp는 `k / effectiveFps`이고 마지막 `duration / maxFrames` 구간에는 후보가 없다.

## Metadata consistency

- `video.originalDurationMs`는 file/buffer에서 ffprobe 길이(`sourceDurationSec`)를 밀리초로 기록하고, frames에서는 마지막 후보 timestamp를 사용한다.
- `video.fps`는 `effectiveFps`이며 frames 모드는 1이다. animation tracker도 같은 FPS를 사용한다.
- `video.resolution`은 첫 선택 프레임(없으면 첫 후보)의 실제 출력 JPEG 크기이다. 후보도 없으면 `{ width: 0, height: 0 }`이다.
- `AnalysisResult.analysisResolution`과 `SegmentResult.analysisResolution`은 분석 좌표계 크기를 전달한다. 일반 경로는 `ProcessContext.analysisResolution?`에 보관하며, 분석하지 않은 0·1프레임 결과는 0×0을 사용한다.
- 반환값과 파일 metadata의 animation bbox는 출력 픽셀 좌표이다. 분석 결과는 그대로 두고 출력 단계에서만 `sx = outputWidth / analysisWidth`, `sy = outputHeight / analysisHeight`를 적용하여 정수 반올림하고 출력 범위로 clamp한다. 크기는 변환한 원점에서 출력 끝까지로 제한한다.
- 공용 `buildVideoMetadata`가 API와 파일의 video 및 변환된 animation을 생성한다. 파일의 프레임 ID는 기존 1-based 계약을 유지한다. 0·1프레임에서도 metadata 생성은 가능하다.

## Types (re-exported from types/)

- `SieveOptions`, `SieveOptionsBase`, `SieveInput`
- `SieveResult`, `FrameNode`, `ScoreEdge`
- `BoundingBox`, `DBSCANResult`, `ProcessContext`
- `ResolvedOptions`, `ProgressPhase`

## Dependencies

- `core/` — 비즈니스 로직 파이프라인
- `types/` — 타입 정의
- `utils/` — 유틸리티 함수

## Acceptance Criteria

- [ ] file/buffer/frames 3가지 모드 정상 동작
- [ ] count/threshold/threshold-with-cap 가지치기 전략 정상 작동
- [ ] 첫/마지막 프레임 항상 포함 (boundary protection)
- [ ] 임시 workspace 정상 정리 (debug 모드 제외)

## Last Updated

2026-09-10
