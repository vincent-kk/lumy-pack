# segmenter

## Purpose

긴 file/buffer 입력을 전역 FPS 격자 위의 논리 세그먼트로 나누어 병렬로 추출·분석·가지치기하고, 결과를 하나의 전역 프레임 그래프로 병합한다. orchestrator가 `shouldSegment`로 진입을 결정하고 `runSegmentedPipeline`으로 위임한다.

## Conventions

- 세그먼트는 전역 격자점 `k / effectiveFps`를 소유한다. 시간이 아니라 격자 슬롯이 단위다.
- 내부 경계마다 이웃 격자점 한 개를 overlap으로 포함하고, 병합에서 overlap 중복을 별칭(alias)으로 접는다.
- 세그먼트별 추출·분석·가지치기·저장은 형제 프랙탈(extractor, analyzer, pruner, workspace, input-resolver)의 entry만 사용한다.
- 병렬도는 scheduling organ의 `concurrencyLimit`으로 제한한다. 이 organ은 segmenter만 소비하므로 여기에 둔다.
- 최종 `video`와 출력 좌표계 `animations`는 core가 소유한 `buildVideoMetadata`로 만든다(계약은 core의 DETAIL).

## Boundaries

- 공개 계약은 `shouldSegment`, `computeSegmentPlan`, `processSegment`, `mergeSegmentFrames`, `runSegmentedPipeline`이다. 소비자는 orchestrator와 `core/index.ts`뿐이다.
- 격자·예산의 공유 불변식(전체 예산, 로컬·전역 timestamp)은 `core/DETAIL.md`의 `frame-budget-grid` 그룹이 소유한다. 여기서는 세그먼트 계획과 병합 규칙만 정의한다.

## Always do

- 격자점이 없는 구간은 계획에서 제외하고 반환 인덱스를 연속으로 유지한다.
- overlap을 뺀 할당 합이 전체 `maxFrames` 이하임을 유지한다.
- 병합에서 로컬 timestamp에 `extractStartTime`을 정확히 한 번 더한다.
- 별칭 후 `source === target`인 edge와 `startFrameId === endFrameId`인 animation은 버린다.

## Ask first

- 세그먼트 길이·overlap 폭·병렬도 기본값 변경
- 중복 프레임 생존 규칙(앞 세그먼트 우선) 변경
- 세그먼트 경계를 가로지르는 animation 병합 시도

## Never do

- 겹치는 시각의 프레임에 픽셀 동일성을 요구하지 않는다 — seek 후 같은 슬롯의 픽셀은 달라질 수 있다.
- 형제 프랙탈의 내부 파일을 import하지 않는다.
- 세그먼트 컨텍스트에 전역 `effectiveFps`를, 최종 컨텍스트에 세그먼트 FPS를 섞어 쓰지 않는다.
