# SPEC: core

## Purpose

scene-sieve 핵심 파이프라인. 프레임 추출, 비전 분석, 가지치기를 수행.

## Public API

### orchestrator

- `runPipeline(options: SieveOptions): Promise<SieveResult>` — 5단계 파이프라인

### analyzer

- 정상 분석에서 각 프레임의 sharp 전처리와 AKAZE 검출은 한 번만 실행한다. 검출기는 분석 호출당 하나이며 `analyzeFrames`의 `finally`에서 마지막 carry의 특징점과 함께 해제한다.
- 배치는 이전 배치의 마지막 `{ preprocessed, features }`를 carry로 받아 재사용한다. DBSCAN과 점수 계산의 이미지 크기는 배치 첫 프레임(carry)의 크기를 따른다.
- 특징점 쌍 처리 후 이전 핸들을 해제하고 다음 특징점을 carry로 넘긴다. 예외 경로에서도 이전·다음 특징점과 부분 할당된 핸들을 정리한다.
- 매칭은 양쪽 descriptor rows가 양수일 때만 이전→다음 방향으로 수행한다. `BFMatcher(NORM_HAMMING, false)`, `knnMatch(k=2)`, 엄격한 ratio 비교(`best < MATCH_DISTANCE_THRESHOLD * second`)를 유지한다. 새 점만 계산하며 DBSCAN 클러스터가 없으면 캐시된 전처리 바이트로 픽셀 fallback을 수행한다.
- 두 특징점 파일은 기존 core 평면 배치 관행을 따르며 패키지 barrel에 재수출하지 않는다. `CvLib`는 OpenCV 모듈 타입, `PreprocessedFrame`은 `preprocessFrame` 반환 형태(`data: Uint8Array`, `width`, `height`)의 로컬 타입이다.

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
 * @param cvLib 초기화된 OpenCV 런타임.
 * @param prev 호출자가 소유하는 이전 프레임 특징점.
 * @param next 호출자가 소유하는 다음 프레임 특징점.
 * @returns next의 미매칭 특징점 좌표. 입력 핸들은 해제하지 않는다.
 */
export function computeNewPoints(cvLib: CvLib, prev: FrameFeatures, next: FrameFeatures): Point2D[];
```

- `DMatchVectorVector.get()`·`MatVector.get()`으로 얻은 핸들도 호출자가 해제한다. `KeyPointVector.get()`·`DMatchVector.get()`은 값 객체라 해제 대상이 아니다.
- AKAZE 및 픽셀 차이 분석의 네이티브 객체는 `try` 안에서 할당하고 `finally`에서 해제하여, 할당 중 예외에도 이미 생성된 객체를 정리한다.
- `analyzeFrames(ctx: ProcessContext): Promise<ScoreEdge[]>` — 프레임 쌍 분석
- `computeIoU(a: BoundingBox, b: BoundingBox): number` — IoU 계산
- `computeInformationGain(...)` — 정보 이득 점수 산출

### pruner

- `pruneTo(graph, frames, targetCount): Set<number>` — greedy merge
- `pruneByThreshold(graph, threshold): Set<number>` — 임계값 필터
- `pruneByThresholdWithCap(graph, frames, threshold, cap): Set<number>`

### dbscan

- `dbscan(points, width, height, alpha?, minPts?): DBSCANResult`

### extractor

- `extractFrames(ctx: ProcessContext): Promise<FrameNode[]>` — FFmpeg 추출

### input-resolver

- `resolveOptions(options: SieveOptions): ResolvedOptions`
- `resolveInput(ctx: ProcessContext): Promise<FrameNode[]>`

### workspace

- `createWorkspace(sessionId): Promise<string>`
- `finalizeOutput(ctx, frames): Promise<string[]>`
- `cleanupWorkspace(path): Promise<void>`
- `readFramesAsBuffers(frames): Promise<Buffer[]>`

## Acceptance Criteria

- [ ] 5단계 파이프라인 순차 실행 보장
- [ ] OpenCV Mat 리소스 누수 없음
- [ ] pruner 순수함수 보장 (I/O 없음)
- [ ] 첫/마지막 프레임 boundary protection
