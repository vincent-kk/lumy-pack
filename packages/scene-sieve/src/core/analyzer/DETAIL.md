# SPEC: analyzer

## Requirements

인접 프레임 쌍마다 새로 나타난 특징점(sNew)을 구하고, 이를 공간 클러스터링해 면적 비율·특징 밀도·반복 영역 감쇠를 결합한 정보 이득 G(t)를 산출한다. 결과는 `ScoreEdge[]`와 분석 좌표계 animation, 첫 분석 프레임의 해상도다. 네이티브 자원은 누수 없이 해제한다.

## API Contracts

### `analyzeFrames(ctx: ProcessContext): Promise<AnalysisResult>`

- 프레임이 2개 미만이면 분석하지 않고 `{ edges: [], animations: [], analysisResolution: { width: 0, height: 0 } }`를 반환한다.
- OpenCV 런타임을 초기화하고 AKAZE 검출기를 하나 만들어 모든 배치가 공유한다. `finally`에서 마지막 carry의 특징점과 검출기를 해제한다.
- 프레임 `i`부터 `OPENCV_BATCH_SIZE`개의 인접 쌍을 한 배치로 처리한다. 배치는 이전 배치의 마지막 `{ preprocessed, features }`를 carry로 받아 재사용하므로 프레임당 sharp 전처리와 AKAZE 검출은 한 번씩만 일어난다.
- DBSCAN과 점수 계산의 이미지 크기는 배치 첫 프레임(carry)의 크기를 따르고, `analysisResolution`은 첫 배치의 값이다.
- animation tracker는 `ctx.effectiveFps ?? ctx.options.fps`, `ctx.options.iouThreshold`, `ctx.options.animationThreshold`를 쓰며 배치를 가로질러 상태를 유지한다.
- 쌍 분석 예외는 `logger.warn`으로 노출하고 점수 0의 edge를 기록하며 실패 수를 배치 전체에서 합산한다. 점수가 0이라는 이유만으로 실패로 세지 않는다. 전체 쌍이 2개 이상이고 모두 실패하면 `All <n> frame pairs failed analysis` 오류를 던진다. 일부 실패나 단 한 쌍의 실패는 경고와 fallback 결과를 유지한다.
- 배치마다 `ctx.emitProgress`로 진행률을 알린다.

### `computeIoU(a: BoundingBox, b: BoundingBox): number`

- 두 bbox의 교집합 면적을 합집합 면적으로 나눈 값. 겹치지 않으면 0.

### `computeInformationGain(...)`

- 클러스터 면적 비율과 특징 밀도를 결합하고 tracker의 animation 판정으로 감쇠한 G(t)를 반환한다. 공식 변경은 선택 결과를 바꾸므로 `Ask first`다.

### `dbscan(points, imageWidth, imageHeight, alpha?, minPts?): DBSCANResult`

- `eps = (alpha ?? DBSCAN_ALPHA) * sqrt(width² + height²)`, `minPts ?? DBSCAN_MIN_PTS`. 빈 입력은 `{ labels: [], boundingBoxes: [] }`. 라벨 `-1`은 노이즈다. `clustering/dbscan.ts`에 있으며 entry가 `Point2D`와 함께 재수출한다.

### 특징점 organ (`features/`) — entry에 재수출하지 않음

`CvLib`는 OpenCV 모듈 타입, `PreprocessedFrame`은 `preprocessFrame` 반환 형태(`data: Uint8Array`, `width`, `height`)의 로컬 타입이다.

```ts
/** 한 프레임의 AKAZE 특징점과 descriptor. delete()는 두 핸들을 해제하며 멱등이다. */
export interface FrameFeatures {
  readonly width: number;
  readonly height: number;
  readonly keypoints: KeyPointVector;
  readonly descriptors: Mat; // rows === keypoints.size()
  delete(): void;
}
/**
 * 한 프레임의 특징점을 생성한다.
 * @param cvLib 초기화된 OpenCV 런타임.
 * @param akaze 호출자가 소유·해제하는 검출기.
 * @param frame 크기에 맞는 전처리 grayscale 바이트.
 * @returns 호출자가 delete()해야 하는 핸들 묶음.
 */
export function computeFrameFeatures(cvLib: CvLib, akaze: AKAZE, frame: PreprocessedFrame): FrameFeatures;
/**
 * prev→next 방향 BFMatcher(NORM_HAMMING, crossCheck=false) knnMatch(k=2), ratio 0.25.
 * @returns next의 미매칭 특징점 좌표. 입력 핸들은 해제하지 않는다.
 */
export function computeNewPoints(cvLib: CvLib, prev: FrameFeatures, next: FrameFeatures): Point2D[];
```

- 매칭은 양쪽 descriptor rows가 양수일 때만 이전→다음 방향으로 수행하고 엄격한 ratio 비교(`best < MATCH_DISTANCE_THRESHOLD * second`)를 유지한다. 새 점만 계산하며, DBSCAN 클러스터가 없으면 캐시된 전처리 바이트로 픽셀 차분 fallback을 수행한다.
- 특징점 쌍 처리 후 이전 핸들을 해제하고 다음 특징점을 carry로 넘긴다. 예외 경로에서도 이전·다음 특징점과 부분 할당된 핸들을 정리한다.

### 네이티브 핸들 소유

| 핸들 | 소유자 | 해제 |
|---|---|---|
| AKAZE 검출기 | `analyzeFrames` | 호출 종료 `finally` |
| `FrameFeatures`(keypoints, descriptors) | 생성한 배치, carry로 이전 | 쌍 처리 후 이전 것, 마지막 것은 `analyzeFrames` |
| BFMatcher, `DMatchVectorVector`, `DMatchVectorVector.get()` 결과 | `computeNewPoints` | 같은 함수 `finally` |
| `MatVector.get()` 결과(contour) | `computePixelDiff` | 각 반복의 `finally` |
| `KeyPointVector.get()`, `DMatchVector.get()` | 값 객체 | 해제 대상 아님 |

픽셀 차분의 Mat(원본 2개, diff, blurred, binary, contours, hierarchy)도 `try` 안에서 할당하고 `finally`에서 해제한다.

### 튜닝 상수 (`constants/vision-tuning.ts`)

`OPENCV_BATCH_SIZE`, `DBSCAN_ALPHA`, `DBSCAN_MIN_PTS`, `DECAY_LAMBDA`, `MATCH_DISTANCE_THRESHOLD`, `PIXELDIFF_GAUSSIAN_KERNEL`, `PIXELDIFF_BINARY_THRESHOLD`, `PIXELDIFF_CONTOUR_MIN_AREA`, `PIXELDIFF_SAMPLE_SPACING`. 이 프랙탈만 소비한다.

## Acceptance Criteria

### handle-lifetime — 네이티브 자원 누수 없음

- [ ] 정상·예외 경로 모두에서 위 표의 핸들이 해제된다.
- [ ] 검출기는 `analyzeFrames` 호출당 하나다.

### single-pass-features — 프레임당 한 번의 전처리·검출

- [ ] 배치 경계 프레임은 carry로 재사용되며 다시 전처리하지 않는다.
- [ ] 매칭은 이전→다음 한 방향이며 새 점만 계산한다.

### failure-policy — 쌍 실패 처리

- [ ] 일부 실패는 경고와 점수 0 edge로 남고 결과를 유지한다.
- [ ] 쌍 2개 이상이 전부 실패하면 오류를 던진다.
- [ ] 0·1프레임은 빈 결과와 0×0 해상도를 반환한다.

### analysis-coordinates — 분석 좌표계 결과

- [ ] `analysisResolution`은 첫 분석 프레임의 크기이고 animation bbox는 그 좌표계다.
- [ ] tracker FPS는 `effectiveFps`를 우선한다.

## Boundary Exemptions

### `analyzer.ts` — 분석 중간 단계 시각화

- **Consumers**: `packages/scene-sieve/.samples/generate-showcase.ts`
- **Direct import**: `allowed`
- **Reason**: 개발용 쇼케이스는 전처리, 픽셀 차분, tracker의 중간 상태를 각각 시각화한다. 최종 분석 결과만 제공하는 entry로는 이 관측을 표현할 수 없으므로 내부 구현을 직접 재사용하며 공개 API에는 추가하지 않는다.

### `constants/vision-tuning.ts` — 시각화와 분석 파라미터 일치

- **Consumers**: `packages/scene-sieve/.samples/generate-showcase.ts`
- **Direct import**: `allowed`
- **Reason**: 중간 이미지 생성에 실제 분석과 같은 임계값이 필요하다. 상수를 복제하면 시각화와 구현이 달라지므로 개발용 쇼케이스에만 직접 접근을 허용한다.

## Last Updated

2026-09-10
