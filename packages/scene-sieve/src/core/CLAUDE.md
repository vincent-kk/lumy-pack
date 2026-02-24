# core

scene-sieve 핵심 비즈니스 로직. 5단계 파이프라인으로 프레임 추출, 분석, 가지치기 수행.

## Modules

| File | Role |
|------|------|
| `orchestrator.ts` | 5단계 파이프라인 오케스트레이터 |
| `input-resolver.ts` | 입력 모드/옵션 해석, pruneMode 결정 |
| `workspace.ts` | 임시 디렉토리 관리, 원자적 출력 |
| `extractor.ts` | FFmpeg 프레임 추출 (I-frame + FPS fallback) |
| `analyzer.ts` | OpenCV AKAZE, DBSCAN, IoU, G(t) 스코어링 |
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
