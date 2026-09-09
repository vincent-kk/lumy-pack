# SPEC: core

## Requirements

scene-sieve 핵심 파이프라인. 프레임 추출, 비전 분석, 가지치기를 수행.

## API Contracts

### orchestrator

- `runPipeline(options: SieveOptions): Promise<SieveResult>` — 5단계 파이프라인
- 매 호출에서 `setDebugMode(options.debug ?? false)`로 debug 상태를 설정하여 이전 호출의 설정이 남지 않는다.
- Worker는 결과 메시지 없이 종료되면 종료 코드 0·1을 포함해 reject한다. 결과나 오류로 이미 정착한 Promise는 후속 exit로 바뀌지 않는다.

### analyzer

- 쌍 분석 예외는 `logger.warn`으로 노출하고 점수 0의 edge와 실패 수를 기록한다. 전체 쌍이 2개 이상이고 모두 실패하면 분석 오류를 던진다. 일부 실패 또는 단 한 쌍의 실패는 경고와 기존 fallback 결과를 유지한다. 실패 수는 배치 전체에서 합산하며 점수가 0이라는 이유만으로 실패로 세지 않는다.
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
- `analyzeFrames(ctx: ProcessContext): Promise<AnalysisResult>` — 기존 edges·분석 좌표계 animations와 첫 분석 프레임의 `analysisResolution`을 반환한다. 0·1프레임은 분석 없이 빈 결과와 0×0 해상도를 반환한다. tracker는 `ctx.effectiveFps ?? ctx.options.fps`를 사용한다.
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
- 중복 프레임의 `(segmentIndex, localId)`는 생존 프레임의 globalId로 별칭된다. 별칭 후 `source === target`인 edge는 버리고 같은 쌍의 edge는 높은 점수를 유지한다. animation은 별칭 후 `startFrameId === endFrameId`이면 버리고, 같은 `(startFrameId, endFrameId)` 쌍은 먼저 온 항목 하나만 남기며 `durationMs`는 세그먼트 tracker 값을 유지한다. 세그먼트마다 tracker가 새로 시작하므로 경계를 가로지르는 반복 영역은 두 animation으로 나뉠 수 있다(알려진 한계).
- 세그먼트 분석 컨텍스트에는 해당 `effectiveFps`, 최종 출력 컨텍스트에는 전역 `effectiveFps`와 원본 `sourceDurationSec`을 보관한다.
- `processSegment`는 분석 해상도를 결과에 추가하고, `mergeSegmentFrames`는 첫 세그먼트의 해상도를 그대로 전달한다. 빈 병합은 0×0이다. 최종 video와 출력 좌표계 animations는 `buildVideoMetadata`로 생성한다.

### input-resolver

- `resolveOptions(options: SieveOptions): ResolvedOptions`
- `validateOptions(options: SieveOptions): void`는 src 옵션 표의 유한성·정수·범위를 기본값 적용 전에 검사한다. core 평면 배치에서 export 하나만 제공하며 소비자는 `resolveOptions`이다.
- 기존 threshold 검사도 이 검증으로 통합한다. 메시지 `<name> must be …, received: <value>`는 `classifyError`가 `INVALID_INPUT`으로 분류한다.
- `resolveInput(options: SieveOptions, workspacePath: string)`은 `{ frames, resolvedInputPath? }`를 반환한다. frames 모드는 sharp `metadata()`로 모든 입력 크기를 비교한 후 저장하며 불일치는 같은 메시지 형식으로 거부한다.

### workspace

- `createWorkspace(sessionId): Promise<string>`
- `finalizeOutput(ctx, frames): Promise<string[]>`
- `cleanupWorkspace(path): Promise<void>`
- `readFramesAsBuffers(frames): Promise<Buffer[]>`
- `buildVideoMetadata(ctx, selected, analysisResolution)`는 첫 선택 프레임(없으면 첫 후보)의 sharp metadata 크기, 유효 FPS, 원본 길이로 video를 만든다. JPEG 출력은 resize하지 않으므로 추출 이미지와 출력 JPEG의 크기가 같다. 후보가 없으면 0×0이다.
- bbox 변환은 이 함수에서만 수행하며 축별 배율·정수 반올림·출력 범위 clamp를 적용한다. 입력 animations를 변경하지 않고 새 배열과 bbox를 반환한다. 0×0 분석 해상도는 animation이 없는 조기 반환 경로를 나타낸다.
- `finalizeOutput`은 공용 결과를 사용하되 파일 metadata의 animation ID를 1-based로 변환하고 durationMs를 반올림한다. API 결과는 기존 0-based ID를 유지한다.

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

2026-09-10
