# SPEC: segmenter

## Requirements

`maxSegmentDuration`을 넘는 file/buffer 입력을 전역 FPS 격자에 정렬된 세그먼트로 나누어 `concurrency`만큼 병렬 처리하고, 단일 파이프라인과 같은 형태의 `SieveResult`를 돌려준다. 세그먼트 경계에서 프레임이 중복되거나 유실되지 않아야 하며 edge·animation ID는 전역 ID로 다시 매핑되어야 한다.

## API Contracts

### `shouldSegment(resolvedOptions: ResolvedOptions, options: SieveOptions): boolean`

- file/buffer 입력이고 원본 길이가 `maxSegmentDuration`을 넘을 때만 참이다. frames 입력은 분할하지 않는다.

### `computeSegmentPlan(...)` — 세그먼트 계획

- 논리 구간 `[startTime, endTime)`마다 전역 격자점 `k / effectiveFps`를 소유한다. 격자점이 없는 구간은 제외하며 반환 인덱스는 제외 후 연속이다.
- 내부 경계 양쪽에 이웃 격자점 한 개씩을 overlap으로 포함한다(`overlapBefore`·`overlapAfter`는 0 또는 1). `allocatedFrames`는 overlap을 포함한 `-frames:v` 값이고, overlap을 뺀 합은 전체 예산 이하다. 단일 세그먼트의 상한은 전체 `maxFrames`다.
- `extractStartTime`은 첫 추출 격자점(`(firstSlot - overlapBefore) / effectiveFps`)이다. 추출 종료는 마지막 슬롯을 출력할 수 있도록 한 격자 간격까지 확장하되 원본 길이를 넘지 않는다. 마지막 세그먼트는 원본 끝까지 추출한다.
- 예산이 격자점보다 적으면 앞 세그먼트부터 슬롯을 채우고, 슬롯이 0인 세그먼트는 만들지 않는다.

### `processSegment(...)`: Promise<SegmentResult>

- 세그먼트 전용 workspace(`createSegmentWorkspace`)에서 `extractFramesForRange(…, extractStartTime, …, allocatedFrames)`로 추출하고 `analyzeFrames`·가지치기를 수행한다.
- 세그먼트 분석 컨텍스트에는 해당 세그먼트의 `effectiveFps`를 둔다. 결과에 `analysisResolution`(분석 좌표계 크기)을 포함한다. 분석하지 않은 0·1프레임 세그먼트는 0×0이다.
- 세그먼트마다 animation tracker가 새로 시작한다.

### `mergeSegmentFrames(segmentResults: SegmentResult[])`

- 로컬 timestamp에 `extractStartTime`을 한 번만 더해 전역 timestamp를 만든다.
- 같은 전역 슬롯의 중복 프레임은 앞 세그먼트 프레임을 유지한다. 중복 프레임의 `(segmentIndex, localId)`는 생존 프레임의 globalId로 별칭된다.
- edge: 별칭 후 `source === target`이면 버리고, 같은 `(source, target)` 쌍은 높은 점수를 유지한다.
- animation: 별칭 후 `startFrameId === endFrameId`이면 버리고, 같은 `(startFrameId, endFrameId)` 쌍은 먼저 온 항목 하나만 남긴다. `durationMs`는 세그먼트 tracker 값을 유지한다. 경계를 가로지르는 반복 영역은 두 animation으로 나뉠 수 있다(알려진 한계).
- `analysisResolution`은 첫 세그먼트의 값을 그대로 전달한다. 빈 병합은 0×0이다.

### `runSegmentedPipeline(options: SieveOptions, resolvedOptions: ResolvedOptions): Promise<SieveResult>`

- `computeSegmentPlan`으로 계획을 만들고 `scheduling/concurrency.ts`의 `concurrencyLimit(resolvedOptions.concurrency)`로 `processSegment`를 병렬 실행한다.
- 병합 결과에 최종 가지치기를 적용하고, 최종 출력 컨텍스트에는 전역 `effectiveFps`와 원본 `sourceDurationSec`을 둔다. `video`와 출력 좌표계 `animations`는 `buildVideoMetadata`(core organ `utils/metadata/`, 계약은 `core/DETAIL.md`)로 만든다.
- 세그먼트 workspace 정리는 orchestrator와 같은 debug 규칙을 따른다.

## Acceptance Criteria

### plan-grid — 격자 정렬 계획

- 모든 세그먼트의 소유 슬롯 수는 양수이고, overlap을 제외한 `allocatedFrames` 합은 `maxFrames` 이하다.
- 첫 세그먼트의 `overlapBefore`와 마지막 세그먼트의 `overlapAfter`는 0이다.
- 격자점이 없는 구간은 계획에 나타나지 않고 인덱스는 0부터 연속이다.

### merge-alias — 병합과 별칭

- 병합 결과의 timestamp는 전역 격자 `k / effectiveFps`와 일치하며 같은 슬롯의 프레임은 하나만 남는다.
- 별칭 후 자기 참조 edge·animation은 없고, 같은 쌍의 edge는 하나(높은 점수)만 남는다.
- 경계 양쪽 프레임을 잇는 edge는 dedup 뒤에도 유지된다.

### segment-context — FPS·해상도 전달

- 세그먼트 컨텍스트의 `effectiveFps`는 해당 세그먼트 값, 최종 컨텍스트는 전역 값이다.
- `mergeSegmentFrames`는 첫 세그먼트의 `analysisResolution`을 전달하고 빈 병합은 0×0이다.

## Last Updated

2026-09-10
