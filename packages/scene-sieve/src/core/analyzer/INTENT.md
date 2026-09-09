# analyzer

## Purpose

파이프라인의 분석 단계. OpenCV(WASM) AKAZE 특징점 차분, DBSCAN 공간 클러스터링, IoU 기반 반복 영역 추적으로 인접 프레임 쌍의 정보 이득 G(t)를 계산해 `ScoreEdge[]` 그래프와 분석 좌표계의 animation 목록을 만든다.

## Conventions

- OpenCV는 `createRequire`로 CJS를 로드하고 모듈의 `.then`을 제거한다(thenable 재귀 방지). 로딩은 이 프랙탈 안에서만 일어난다.
- 네이티브 핸들(Mat, Vector, 검출기, 매처)은 `try` 안에서 할당하고 `finally`에서 `delete()`한다. 값 객체를 돌려주는 `get()`은 해제 대상이 아니다.
- 프레임은 `OPENCV_BATCH_SIZE` 단위 배치로 처리하며 배치 경계 프레임의 전처리 바이트와 특징점을 다음 배치로 넘긴다(carry).
- 특징점 생성·매칭, 클러스터링, 비전 튜닝 상수는 각각의 organ에 두고 이 프랙탈 안에서만 직접 import한다. 튜닝 상수는 이 프랙탈만 소비하므로 여기 산다.
- 옵션 기본값(`DEFAULT_FPS`, `IOU_THRESHOLD`, `ANIMATION_FRAME_THRESHOLD`)은 `src`의 옵션 기본값 organ에서 가져온다 — 옵션 표 전체가 한 단위이기 때문이다.

## Boundaries

- entry가 공개하는 것은 `analyzeFrames`, `computeIoU`, `computeInformationGain`, `dbscan`과 `Point2D`뿐이다. 특징점·픽셀 차분·전처리 함수는 내부 구현이며 검증 파일만 직접 참조한다.
- 소비자는 `orchestrator`와 `segmenter`이고, 입력은 `ProcessContext`(프레임 경로·옵션·진행 콜백)뿐이다.
- 반환 좌표는 분석 해상도 기준이다. 출력 좌표 변환은 `core/utils/metadata/`가 맡는다.

## Always do

- 프레임당 sharp 전처리와 AKAZE 검출을 한 번만 수행하고 검출기는 호출당 하나만 만든다.
- 쌍 분석 실패는 `logger.warn`으로 알리고 점수 0의 edge를 남긴다. 쌍이 2개 이상인데 전부 실패하면 오류를 던진다.
- 0·1프레임 입력은 분석 없이 빈 결과와 0×0 해상도를 반환한다.
- 새 네이티브 객체를 도입하면 소유자와 해제 지점을 `DETAIL.md`의 핸들 표에 적는다.

## Ask first

- G(t) 공식, DBSCAN eps 계수, IoU 감쇠, 픽셀 차분 fallback 조건 변경 — 선택 결과가 바뀐다.
- OpenCV 로딩 방식·배치 크기 변경.
- entry 공개 심볼 추가.

## Never do

- 파일을 읽거나 쓰지 않는다(전처리는 sharp가 메모리에서 수행한다).
- `features/`·`clustering/` 내부를 entry로 재수출하지 않는다.
- 예외 경로에서 이미 할당한 핸들을 남기지 않는다.
- 다른 core 자식 프랙탈에 의존하지 않는다.
