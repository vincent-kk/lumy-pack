# SPEC: core

## Requirements

프레임 추출, 비전 분석, 가지치기를 한 파이프라인으로 묶는다. 단계 프랙탈이 각자 계약을 갖더라도 예산·격자, 메타데이터 좌표계, 자원 해제, 진입점 규칙은 core가 하나로 보장한다.

## API Contracts

### Entry

- `index.ts`는 자식 프랙탈 entry(`orchestrator`, `analyzer`, `extractor`, `pruner`, `input-resolver`, `segmenter`, `workspace`)의 심볼을 이름으로 재수출한다. 와일드카드 재수출은 쓰지 않는다.
- 공개 메타데이터·시트 타입은 소스 루트의 타입 organ에서 이름으로 재수출해 라이브러리와 CLI가 같은 계약을 참조한다.
- 라이브러리·CLI·벤치 같은 core 밖의 소비자는 집합 entry만 import한다. 검증 파일은 예외로 concrete 파일을 직접 import한다.
- 형제 프랙탈끼리는 상대 entry(`../<name>/index.js`)만 import한다. 이 모듈의 집합 진입점 `index.ts`를 거쳐 형제를 import하지 않는다.

### 파이프라인 순서

- Init(workspace 생성, 입력 해석) → Extract → Analyze → Prune → Finalize를 순차 실행한다. 진행 콜백의 phase는 이 순서로만 전진한다.
- 긴 입력은 오케스트레이터가 세그먼트 경로로 위임하며, 세그먼트마다 같은 순서를 반복하고 병합 후 Finalize한다.

### Internal utility placement

- `utils/` groups internal support so it is visually distinct from pipeline fractals. Filesystem and metadata helpers retain topic subdirectories and remain owned by core; consumers within core import their concrete files. This grouping adds no public entry point.

### 메타데이터 organ `utils/metadata/`

- 첫 선택 프레임(없으면 첫 후보)의 sharp metadata 크기, `ctx.effectiveFps`, `ctx.sourceDurationSec`으로 `video`를 만든다. JPEG 출력은 resize하지 않으므로 추출 이미지와 출력 JPEG의 크기가 같다. 후보가 없으면 0×0이다.
- `buildVideoMetadata`는 video의 후보 수·선택 수와 source를 채운다. file 출처는 basename만 기록하며 buffer/frames 출처의 fileName은 null이다.
- `buildVideoMetadata`만 sharp 읽기를 수행한다. `scaleBoundingBox`는 축별 배율을 적용해 원점과 크기를 각각 정수 반올림하고, 원점을 출력 범위로, 크기를 변환 원점부터 출력 끝까지로 clamp한다. 입력 animations는 변경하지 않는다.
- 0×0 분석 해상도는 animation이 없는 조기 반환 경로를 나타내며 변환을 건너뛴다.
- 최종 소비자는 `utils/output/finalize-selection.ts`이며 일반·세그먼트 경로가 공유하므로 소유자는 core다. API animations는 0-based를 유지하고 `buildSieveMetadata`가 문서용 1-based ID와 정수 durationMs로 변환한다.
- `unionArea`는 x축 스위프와 압축된 y축 구간의 피복 길이를 사용해 전체 사각형 합집합의 면적을 계산한다. n개 상자에 시간 O(n log n), 추가 공간 O(n)을 사용하며 영역을 샘플링하거나 잘라내지 않는다. 빈 입력과 폭·높이가 양수가 아닌 상자는 면적 0이다.
- `selectRegions`는 출력 좌표가 완전히 같은 상자를 중복 제거하고 면적 내림차순, y·x·width 오름차순으로 정렬해 최대 5개를 남긴다. 면적 0은 제외한다.
- `buildFrameChange`는 구간의 원시 G(t) 최댓값·합을 소수 6자리로 반올림한다. `animationIndices` 밖 클러스터만 면적·영역에 기여하며 change 없는 간선도 점수에는 기여한다. 면적은 분석 좌표에서 전체 bbox의 실제 합집합을 계산하고 이미지 면적으로 나눠 [0,1] clamp 후 소수 4자리로 반올림한다. 분석 해상도가 0이면 면적 0·빈 영역이다.
- `buildFrameMetadata`는 후보 순서의 인접 쌍을 graph의 ID 조회로 모아 선택 구간을 집계하고 누락 간선은 건너뛴다. 첫 change는 null이며 fromFrameId는 직전 선택의 1-based ID, skippedCandidates는 사이 후보 수다. 이름은 후보 수 자릿수(최소 4자리)의 `frame_<id+1>.jpg`이고 timestampMs는 정수 반올림한다. holdsMs는 다음 선택 timestampMs까지, 마지막은 원본 길이까지의 차이를 0 이상으로 제한한다.
- `buildToolMetadata`는 fps, count, threshold, scale, quality, maxFrames, iouThreshold, animationThreshold, maxSegmentDuration 아홉 params를 순서대로 담는다. fps는 요청값이며 concurrency·경로·debug·sheet·includeEdges는 제외한다.
- `buildEdgeMetadata`는 graph 순서와 1-based ID를 유지하고 점수를 6자리, 비애니메이션·애니메이션 합집합 비율을 각각 4자리로 반올림한다. change가 없으면 비율은 0이다.
- `buildSieveMetadata`는 순수 조립 함수다. 키 순서는 metadataVersion, tool, video, frames, animations, sheet, edges이며 선택적 키는 해당할 때만 생성한다(undefined 대입 금지). `buildVideoMetadata`가 후보 수·선택 수와 source를 채운 video를 그대로 전달한다. 입력 객체와 배열을 변경하지 않는다.

### 시트 organ `utils/sheet/`

- `sampleTileFrames`는 선택 수가 maxTiles 이하면 그대로 반환하고, 초과하면 `round(i × (n − 1) / (maxTiles − 1))` 인덱스를 사용한다. 첫·끝을 포함하고 중복 없이 단조 증가하며 sampled로 축약 여부를 표시한다.
- `formatTileLabel`은 1-based frameId와 밀리초를 `#<id> mm:ss.s`로 만든다. 분은 최소 두 자리, 초는 두 자리, 소수 한 자리는 내림한다.
- `buildTileLabelSvg`는 타일 크기의 SVG에 좌상단 검은 반투명 배지와 흰 sans-serif 글자를 그린다. fontSize는 max(8, round(tileHeight × 0.07)), padX·padY는 각각 글자 크기의 0.4·0.2를 반올림한다. 배지 폭은 타일 폭과 ceil(문자 수 × fontSize × 0.6) + 2 × padX 중 작은 값, 높이는 fontSize + 2 × padY다. 글자 베이스라인은 padY + round(fontSize × 0.8)이다.
- `renderContactSheet`는 비어 있지 않은 선택과 양수 해상도를 받는다. 타일 높이는 max(1, round(tileWidth × height / width)), 유효 열 수는 min(columns, 타일 수)다. 흰 배경과 타일 간격·외곽 여백은 4px이고 행 우선·마지막 행 왼쪽 정렬이다. 각 이미지는 fit fill로 타일 크기를 맞추고 선택적으로 라벨을 합성한다.
- JPEG는 입력 quality와 mozjpeg를 사용하며 파일명은 sheet.jpg다. 반환 메타는 유효 열 수·타일 크기·1-based frameIds·sampled를 포함한다. 같은 기계·같은 sharp·폰트에서 동일 입력의 바이트 결정성을 보장하고 플랫폼 간 동일성은 요구하지 않는다.

### 출력 organ `utils/output/`

- `finalizeSelection(ctx, selected)`은 컨텍스트를 변경하지 않고 buildVideoMetadata를 한 번 호출한다. sheet 설정이 있고 선택이 비어 있지 않으며 출력 가로·세로가 양수일 때 시트를 렌더한다. 이어 buildSieveMetadata로 문서를 조립한다.
- file 모드는 workspace entry의 finalizeOutput에 문서와 시트 바이트를 전달하고, buffer/frames 모드는 readFramesAsBuffers를 호출한다. 반환값은 outputFiles·선택적 outputBuffers·document·0-based animations이며 sheetBuffer는 메모리 모드에서 시트를 렌더했을 때만 키를 생성한다.
- 런타임 버전은 공통 조상 src의 constants organ이 제공하는 PACKAGE_VERSION을 사용한다. 이 내부 상수는 CLI와 metadata가 같은 설치 패키지 버전을 보고하도록 manifest를 실행 시 읽는다.
- 문서는 실행 시간·임시 경로를 포함하지 않는다. 동일 입력·출처 basename·선택 파라미터·sheet/includeEdges 설정이면 .metadata.json 바이트가 같으며 concurrency는 결과에 영향을 주지 않는다. 시트 바이트 동일성은 같은 기계·sharp·폰트 범위다.

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

- [ ] API와 파일 metadata의 bbox는 모두 출력 픽셀 좌표이며 `scaleBoundingBox` 한 곳에서 변환된다.
- [ ] 0·1프레임 결과에서도 metadata 생성이 성공한다. 후보가 없으면 `video.resolution`은 0×0, 후보가 하나면 실제 이미지 크기다. 분석을 생략한 두 경우의 `analysisResolution`은 모두 0×0이다.

### resource-safety — 핸들 해제와 순수성

- [ ] 분석 한 번에 생성한 OpenCV 핸들은 예외 경로를 포함해 모두 해제된다.
- [ ] pruner 함수는 같은 입력에 같은 출력을 내고 I/O를 하지 않는다.

### entry-boundary — 진입점 규칙

- [ ] core 밖 소스에서 `core/<child>/…` concrete 파일을 import하는 곳이 없다(검증 파일 제외).
- [ ] `index.ts`의 런타임 공개 심볼 집합은 자식 entry 심볼의 부분집합이며 타입은 소스 루트의 공유 계약만 재수출한다.

## History

- 2026-09-10 — 평면이던 core를 단계별 자식 프랙탈로 나누고 상수·유틸을 소비자의 최하위 공통 프랙탈로 옮겼다. 소비자가 없던 `MIN_IFRAME_COUNT`, `NORMALIZATION_MIN_PERCENTILE`, `NORMALIZATION_MAX_PERCENTILE`는 배치할 주소가 없어 삭제했다.

## Last Updated

2026-09-18
