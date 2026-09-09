# SPEC: core

## Requirements

프레임 추출, 비전 분석, 가지치기를 한 파이프라인으로 묶는다. 단계 프랙탈이 각자 계약을 갖더라도 예산·격자, 메타데이터 좌표계, 자원 해제, 진입점 규칙은 core가 하나로 보장한다.

## API Contracts

### Entry

- `core/index.ts`는 자식 프랙탈 entry(`orchestrator`, `analyzer`, `extractor`, `pruner`, `input-resolver`, `segmenter`, `workspace`)의 심볼을 이름으로 재수출한다. 와일드카드 재수출은 쓰지 않는다.
- 라이브러리·CLI·벤치 같은 core 밖의 소비자는 집합 entry만 import한다. 검증 파일은 예외로 concrete 파일을 직접 import한다.
- 형제 프랙탈끼리는 상대 entry(`../<name>/index.js`)만 import한다. `core/index.ts`를 거쳐 형제를 import하지 않는다.

### 파이프라인 순서

- Init(workspace 생성, 입력 해석) → Extract → Analyze → Prune → Finalize를 순차 실행한다. 진행 콜백의 phase는 이 순서로만 전진한다.
- 긴 입력은 오케스트레이터가 세그먼트 경로로 위임하며, 세그먼트마다 같은 순서를 반복하고 병합 후 Finalize한다.

### Internal utility placement

- `utils/` groups internal support so it is visually distinct from pipeline fractals. Filesystem and metadata helpers retain topic subdirectories and remain owned by core; consumers within core import their concrete files. This grouping adds no public entry point.

### `buildVideoMetadata(ctx, selected, analysisResolution)` (organ `utils/metadata/`)

- 첫 선택 프레임(없으면 첫 후보)의 sharp metadata 크기, `ctx.effectiveFps`, `ctx.sourceDurationSec`으로 `video`를 만든다. JPEG 출력은 resize하지 않으므로 추출 이미지와 출력 JPEG의 크기가 같다. 후보가 없으면 0×0이다.
- bbox 변환은 이 함수에서만 수행한다. 축별 배율 `sx = outputWidth / analysisWidth`, `sy = outputHeight / analysisHeight`를 적용해 정수 반올림하고 출력 범위로 clamp한다. 입력 animations를 변경하지 않고 새 배열과 bbox를 반환한다.
- 0×0 분석 해상도는 animation이 없는 조기 반환 경로를 나타내며 변환을 건너뛴다.
- 세 소비자(orchestrator, segmenter, workspace)가 이 함수를 쓰므로 organ의 주소는 core다. API 결과는 0-based animation ID를 유지하고, 파일 metadata 변환(1-based, durationMs 반올림)은 workspace가 맡는다.

### 프레임 예산과 격자 (extractor ↔ segmenter)

- file/buffer 후보 수는 `Math.max(2, maxFrames)` 이하다. `effectiveFps = min(fps, maxFrames / duration)`에 FPS 하한을 두지 않는다.
- timestamp는 출력 PTS 격자의 `k / effectiveFps`다. 세그먼트는 로컬 격자로 추출하고 병합 시 `extractStartTime`을 한 번만 더해 전역 격자로 복원한다.
- 세그먼트의 소유 슬롯 수는 양수이고 overlap을 뺀 합은 전체 예산 이하다.

### 자원과 순수성

- OpenCV Mat/Vector 핸들은 `try` 안에서 할당하고 `finally`에서 해제한다. 할당 도중 예외가 나도 이미 만든 핸들을 정리한다.
- pruner 함수는 입력만으로 결과를 만든다. 파일, 로거, module state를 건드리지 않는다.

## Acceptance Criteria

### pipeline-order — 다섯 단계 순차 실행

- [ ] 진행 콜백의 phase는 INIT, EXTRACTING, ANALYZING, PRUNING, FINALIZING 순서로만 도착한다.
- [ ] 세그먼트 경로의 최종 결과는 일반 경로와 같은 `SieveResult` 형태다.

### frame-budget-grid — 프레임 예산과 격자

- [ ] file/buffer 후보는 예산 이하이고 frames 입력은 개수 제한을 받지 않는다.
- [ ] 세그먼트의 소유 슬롯 수는 양수이며 overlap 제외 총합은 예산 이하다.
- [ ] 추출 timestamp는 로컬 격자이고 병합 결과는 전역 격자와 일치한다.
- [ ] 예산이 묶이지 않는 기본 옵션의 추출 프레임과 분석 결과는 유지된다.

### metadata-transform — 출력 좌표계

- [ ] API와 파일 metadata의 animation bbox는 모두 출력 픽셀 좌표이며 `buildVideoMetadata` 한 곳에서 변환된다.
- [ ] 0·1프레임 결과에서도 metadata 생성이 성공한다. 후보가 없으면 `video.resolution`은 0×0, 후보가 하나면 실제 이미지 크기다. 분석을 생략한 두 경우의 `analysisResolution`은 모두 0×0이다.

### resource-safety — 핸들 해제와 순수성

- [ ] 분석 한 번에 생성한 OpenCV 핸들은 예외 경로를 포함해 모두 해제된다.
- [ ] pruner 함수는 같은 입력에 같은 출력을 내고 I/O를 하지 않는다.

### entry-boundary — 진입점 규칙

- [ ] core 밖 소스에서 `core/<child>/…` concrete 파일을 import하는 곳이 없다(검증 파일 제외).
- [ ] `core/index.ts`의 공개 심볼 집합은 자식 entry 심볼의 부분집합이다.

## History

- 2026-09-10 — 평면이던 core를 단계별 자식 프랙탈로 나누고 상수·유틸을 소비자의 최하위 공통 프랙탈로 옮겼다. 소비자가 없던 `MIN_IFRAME_COUNT`, `NORMALIZATION_MIN_PERCENTILE`, `NORMALIZATION_MAX_PERCENTILE`는 배치할 주소가 없어 삭제했다.

## Last Updated

2026-09-10
