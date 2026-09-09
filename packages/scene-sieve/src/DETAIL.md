# SPEC: src (scene-sieve)

## Requirements

동영상/GIF에서 유의미한 핵심 프레임을 자동 선별하는 라이브러리와 그 CLI. 세 입력 모드(file, buffer, frames)를 하나의 옵션 계약으로 받고, 결과 메타데이터의 좌표계와 시간 단위를 일관되게 보고한다.

## API Contracts

### `extractScenes(options: SieveOptions): Promise<SieveResult>`

- `SieveOptions = SieveOptionsBase & SieveInput`. 입력 모드는 `mode` 판별 유니온으로 결정한다: `file`(경로 → JPEG 파일), `buffer`(비디오 Buffer → Buffer[]), `frames`(프레임 이미지 Buffer[] → Buffer[]).
- 기본값을 적용한 count/threshold로 항상 `threshold-with-cap` 가지치기를 수행한다.
- 결과는 선별된 프레임 경로 또는 Buffer 배열이며, 첫/마지막 후보는 `count = 1`에서도 보호된다.
- 라이브러리 entry와 CLI는 `core/index.ts`의 명명 재수출을 통해서만 파이프라인에 접근한다. CLI 전용 `runPipelineInWorker`와 `cleanupStaleWorkspaces`는 core 경계에 공개하며 패키지 최상위 API에는 추가하지 않는다.

### Options

| 옵션 | 기본값 | 의미 | 검증 규칙 |
|---|---|---|---|
| `count` | 20 | 최종 선택 개수 상한 | 정수 ≥ 1 |
| `threshold` | 0.5 | 정규화 점수 기준 | 유한 (0, 1] |
| `fps` | 5 | file/buffer 요청 추출 FPS | 유한 > 0 |
| `maxFrames` | 300 | file/buffer 후보 수의 엄격한 상한. 유효 FPS는 `min(fps, maxFrames / duration)`이며 하한 없음. frames 입력에는 미적용 | 정수 ≥ 2 |
| `scale` | 720 | 분석용 추출 이미지 높이 | 정수 ≥ 16 |
| `quality` | 80 | 출력 JPEG 품질 | 정수 1–100 |
| `iouThreshold` | 0.9 | 애니메이션 추적 IoU 기준 | 유한 [0, 1] |
| `animationThreshold` | 5 | 애니메이션 판정 연속 프레임 수 | 정수 ≥ 1 |
| `maxSegmentDuration` | 300초 | 논리 세그먼트 길이 | 유한 > 0 |
| `concurrency` | 2 | 세그먼트 병렬 처리 수 | 정수 ≥ 1 |
| `outputPath` | 입력 경로에서 유도 | file 출력 디렉터리 | 별도 숫자 검증 없음 |
| `debug` | false | 임시 workspace 보존 | 별도 숫자 검증 없음 |
| `onProgress` | 없음 | 단계별 진행률 콜백 | 별도 숫자 검증 없음 |

- 기본값 열 개는 하나의 계약이며 `constants/`에 한 단위로 산다. `resolveOptions`가 한 번에 적용한다.
- `scale ≥ 16`은 sharp/FFmpeg가 처리 가능한 최소 실용 크기를 보장하기 위한 정책 하한이며 라이브러리의 절대 최소 크기를 뜻하지 않는다.
- 지정한 숫자 옵션은 기본값 적용 전에 검증한다. 오류 메시지는 `<name> must be …, received: <value>`이고 CLI는 이를 `INVALID_INPUT`으로 분류한다.
- frames 입력은 sharp `metadata()`로 모든 버퍼의 너비·높이가 같은지 저장 전에 확인한다. 빈 배열과 한 장 입력은 허용한다.

### ProcessContext 시간 필드

- `effectiveFps?`는 실제 추출 격자의 FPS이며 frames 모드에서는 1이다.
- `sourceDurationSec?`은 ffprobe가 반환한 원본 길이다. 두 필드는 추출·분할 경로에서 채우며 기존 배열 반환 호출 형태를 유지한다.
- 예산이 묶이는 file/buffer의 timestamp는 `k / effectiveFps`이고 마지막 `duration / maxFrames` 구간에는 후보가 없다.

### Metadata consistency

- `video.originalDurationMs`는 file/buffer에서 ffprobe 길이(`sourceDurationSec`)를 밀리초로 기록하고, frames에서는 마지막 후보 timestamp를 사용한다.
- `video.fps`는 `effectiveFps`이며 frames 모드는 1이다. animation tracker도 같은 FPS를 사용한다.
- `video.resolution`은 첫 선택 프레임(없으면 첫 후보)의 실제 출력 JPEG 크기다. 후보도 없으면 `{ width: 0, height: 0 }`이다.
- `AnalysisResult.analysisResolution`과 `SegmentResult.analysisResolution`은 분석 좌표계 크기를 전달한다. 일반 경로는 `ProcessContext.analysisResolution?`에 보관하며, 분석하지 않은 0·1프레임 결과는 0×0을 사용한다.
- 반환값과 파일 metadata의 animation bbox는 출력 픽셀 좌표다. 분석 결과는 그대로 두고 출력 단계에서만 `sx = outputWidth / analysisWidth`, `sy = outputHeight / analysisHeight`를 적용해 정수 반올림하고 출력 범위로 clamp한다. 크기는 변환한 원점에서 출력 끝까지로 제한한다.
- API 결과의 animation ID는 0-based, 파일 metadata의 프레임 ID는 1-based 계약을 유지한다.

## Acceptance Criteria

### public-api — 세 입력 모드와 가지치기 계약

- [ ] file/buffer/frames 세 모드가 같은 옵션 계약으로 동작한다.
- [ ] 항상 `threshold-with-cap`을 사용하고 생략한 count/threshold에는 기본값 20/0.5를 적용한다.
- [ ] 첫/마지막 후보는 `count = 1`을 포함해 항상 선택된다.
- [ ] `index.ts`의 export 집합은 `extractScenes`와 공개 타입뿐이며 CLI 전용 심볼을 포함하지 않는다.

### option-validation — 기본값 적용 전 검증

- [ ] 표의 검증 규칙을 벗어난 숫자 옵션은 `<name> must be …, received: <value>` 메시지로 거부된다.
- [ ] 검증은 기본값 적용 전에 일어나며, 생략된 옵션은 검증 대상이 아니다.
- [ ] frames 입력에서 크기가 다른 버퍼는 같은 메시지 형식으로 거부된다.

### metadata-consistency — 좌표계와 시간 단위

- [ ] `video.fps`와 tracker FPS가 같고 frames 모드에서는 1이다.
- [ ] animation bbox는 출력 픽셀 좌표이며 출력 범위 안에 있다.
- [ ] 후보가 없는 결과의 `video.resolution`은 0×0이고 metadata 생성이 실패하지 않는다.

### workspace-cleanup — 임시 디렉터리 정리

- [ ] debug 모드가 아니면 실행 종료 시 임시 workspace가 남지 않는다.
- [ ] debug 모드에서는 workspace가 보존된다.

## Last Updated

2026-09-10
