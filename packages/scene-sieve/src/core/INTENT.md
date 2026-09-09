# core

scene-sieve 핵심 비즈니스 로직. 5단계 파이프라인으로 프레임 추출, 분석, 가지치기 수행.

## Modules

| File | Role |
|------|------|
| `orchestrator.ts` | 5단계 파이프라인 오케스트레이터 |
| `input-resolver.ts` | 입력 모드/옵션 해석, 항상 threshold-with-cap 적용 |
| `validate-options.ts` | Validate supplied numeric options before defaults are applied |
| `workspace.ts` | 임시 디렉토리 관리, 기존 출력 삭제 후 staging rename |
| `build-video-metadata.ts` | 실제 길이·FPS·JPEG 크기와 출력 좌표계 bbox를 공용 생성 |
| `extractor.ts` | FFmpeg FPS 격자 추출, maxFrames 엄격 상한 (FPS 하한 없음) |
| `analyzer.ts` | OpenCV AKAZE, DBSCAN, IoU, G(t) 스코어링 |
| `frame-features.ts` | `FrameFeatures` 타입과 `computeFrameFeatures` — 호출자 소유 특징점·descriptor 생성 |
| `feature-diff.ts` | `computeNewPoints` — 이전→다음 프레임의 미매칭 특징점 좌표 계산 |
| `dbscan.ts` | 공간 클러스터링 알고리즘 |
| `pruner.ts` | 순수함수 기반 프레임 가지치기 (min-heap) |

## Always do

- OpenCV Mat 객체는 finally 블록에서 반드시 .delete()
- pruner 함수는 순수함수로 유지 (I/O 없음)
- 첫/마지막 프레임 boundary protection 보장

## Ask first

- 파이프라인 단계 추가/변경
- OpenCV WASM 로딩 방식 변경
- G(t) 스코어링 공식 수정

## Never do

- analyzer.ts에서 직접 파일 I/O 수행
- pruner에 side effect 추가
- orchestrator 외부에서 ProcessContext 직접 조작
