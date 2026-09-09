# SPEC: core

## Requirements

scene-sieve 핵심 파이프라인. 프레임 추출, 비전 분석, 가지치기를 수행.

## API Contracts

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

- `extractFrames(ctx: ProcessContext): Promise<FrameNode[]>`는 배열 반환을 유지하고, 호출자가 준 컨텍스트에 `effectiveFps`와 `sourceDurationSec`을 기록한다. frames 모드는 입력 프레임을 그대로 반환하며 `effectiveFps = 1`이다.
- file/buffer 후보 수는 `Math.max(2, maxFrames)` 이하이다. `effectiveFps = min(fps, maxFrames / duration)`에 FPS 하한을 두지 않고 `-frames:v`로 개수를 제한한다. 길이가 없는 입력도 개수 제한을 적용한다.
- 필터는 `fps=<effectiveFps>,scale=-1:<scale>`와 기본 반올림을 유지한다. timestamp는 출력 PTS 격자의 로컬 `index / effectiveFps`이며 소스 프레임의 PTS와는 다를 수 있다. 예산이 묶이면 마지막 격자점은 `duration - duration / maxFrames`이다.
- `extractFramesForRange`의 마지막 선택 인자 `frameLimit`은 FFmpeg 상한이다. 기존 6인자 호출은 범위 길이와 FPS로 상한을 계산한다.

### segmenter

- 논리 구간 `[startTime, endTime)`의 전역 격자점 `k / effectiveFps`를 소유하며, 격자점이 없는 구간은 제외한다. 반환 인덱스는 빈 구간 제외 후 연속적이다.
- 내부 경계 양쪽에 이웃 격자점 한 개씩을 overlap으로 포함한다. `allocatedFrames`는 overlap을 포함한 `-frames:v` 값이고, overlap을 뺀 합은 전체 예산 이하이다. 단일 세그먼트의 상한은 전체 `maxFrames`이다.
- `extractStartTime`은 첫 추출 격자점이다. 추출 종료는 마지막 슬롯을 출력할 수 있도록 한 격자 간격까지 확장하되 원본 길이를 넘지 않는다. 마지막 세그먼트 추출은 원본 끝까지 이어진다.
- 병합은 로컬 timestamp에 `extractStartTime`을 한 번만 더하고 겹치는 시각에서는 앞 세그먼트 프레임을 유지한다. seek 후 동일 슬롯의 픽셀이 달라질 수 있으므로 픽셀 동일성을 요구하지 않는다.
- 세그먼트 분석 컨텍스트에는 해당 `effectiveFps`, 최종 출력 컨텍스트에는 전역 `effectiveFps`와 원본 `sourceDurationSec`을 보관한다.

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

### frame-budget-grid

- file/buffer 후보는 예산 이하이고 frames 입력은 개수 제한을 받지 않는다.
- 세그먼트의 소유 슬롯 수는 양수이며 overlap 제외 총합은 예산 이하이다.
- 추출 timestamp는 로컬 격자이고 병합 결과는 전역 격자와 일치한다.
- 예산이 묶이지 않는 기본 옵션의 추출 프레임과 분석 결과는 유지한다.

## Last Updated

2026-09-09
