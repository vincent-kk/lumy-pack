# core

## Purpose

scene-sieve 파이프라인의 집합 경계. 단계별 자식 프랙탈(입력 해석, 추출, 분석, 가지치기, workspace, 세그먼트, 오케스트레이션)을 하나의 진입점 아래 묶고, 프랙탈을 가로지르는 불변식을 소유한다.

## Structure

- `orchestrator/`는 `runPipeline`뿐 아니라 Worker 스레드 실행(`runPipelineInWorker`, Worker 스크립트)도 소유한다. 실행 전략은 "파이프라인을 어떻게 돌리는가"라는 같은 계약의 일부이기 때문이다.

## Conventions

- 파이프라인은 Init → Extract → Analyze → Prune → Finalize 다섯 단계를 이 순서로 실행한다. 세그먼트 경로도 세그먼트마다 같은 순서를 따른다.
- Stage fractals import sibling entry points. Internal filesystem and metadata helpers are grouped by topic under `utils/` to distinguish them from pipeline fractals; core retains ownership. Core children import these helpers and workspace constants through concrete files.
- `index.ts`는 자식 entry를 이름으로 재수출한다. 새 심볼은 자식 entry에 먼저 오르고, 밖에서 쓰일 때만 여기에 오른다.

## Boundaries

- `ProcessContext`는 오케스트레이터(세그먼트 경로 포함)만 생성하고 채운다. 단계 함수는 받은 컨텍스트의 지정 필드만 기록한다.
- OpenCV 네이티브 핸들은 만든 함수가 `finally`에서 해제한다. 핸들을 반환하면 해제 책임을 문서에 적는다.
- 가지치기는 순수 함수다. I/O와 module state는 허용하지 않는다.
- 첫/마지막 후보의 boundary protection은 모든 경로에서 유지한다.

## Always do

- 프랙탈을 가로지르는 계약(예산·격자, 메타데이터 좌표계)은 이 `DETAIL.md`에 두고, 한 단계에 갇힌 계약은 그 자식의 DETAIL에 둔다.
- 자식 entry의 export를 넓히기 전에 그 자식의 DETAIL을 고친다.

## Ask first

- 파이프라인 단계 추가·순서 변경.
- OpenCV WASM 로딩 방식 변경.
- G(t) 스코어링 공식 수정.
- 자식 프랙탈 추가·병합.

## Never do

- 자식 프랙탈의 내부 파일을 형제나 집합 entry에서 import하기.
- 오케스트레이터 밖에서 `ProcessContext`를 만들거나 재구성하기.
- 분석 코드에서 파일 I/O, 가지치기 코드에서 side effect.
