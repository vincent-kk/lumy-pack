# pruner

## Purpose

파이프라인의 가지치기 단계. G(t) 그래프에서 살아남을 프레임 ID 집합을 고르는 순수 함수 모음이다. 임계값 필터(정규화 + 연속 구간 억제)와 개수 상한(이중 연결 리스트 + 최소 힙 greedy 병합)을 제공하며, 둘을 잇는 `threshold-with-cap`이 파이프라인의 유일한 모드다.

## Conventions

- 모든 export는 인자만 읽고 새 `Set<number>`를 반환한다. 입력 배열·객체를 변경하지 않는다.
- 점수 정규화(robust hybrid: 로지스틱 robust-Z + CDF rank)는 `scoring/` organ, 힙은 `heap/` organ이며 이 프랙탈만 소비한다. 정규화 상수도 `scoring/`에 산다.
- 힙의 stale 항목(제거된 프레임을 포함한 edge)은 pop 시점에 건너뛴다.

## Boundaries

- 소비자는 `orchestrator`와 `segmenter`이고 entry가 공개하는 것은 `pruneTo`, `pruneByThreshold`, `pruneByThresholdWithCap`, `suppressConsecutiveRuns`뿐이다.
- 의존은 `types/`(ScoreEdge, FrameNode)뿐이다. logger·파일·워크스페이스를 모른다.

## Always do

- 첫 후보와 마지막 후보는 어떤 경로에서도 제거하지 않는다. `count = 1`이어도 둘 다 남는다.
- 정규화 점수 기준으로 필터하고, 연속으로 통과한 edge 구간에서는 국소 최대만 남긴다.
- 상한 초과 시 생존 부분집합으로 합성 edge(간격의 최소 점수)를 다시 만들어 `pruneTo`를 적용한다.
- 새 정규화 파라미터는 `scoring/`에 두고 `DETAIL.md`의 계약을 먼저 고친다.

## Ask first

- 정규화 공식·가중치·소표본 fallback 변경 — threshold의 의미가 바뀐다.
- boundary protection 완화.
- 합성 edge 점수 규칙(weakest link) 변경.

## Never do

- I/O·로깅·시간 읽기 등 부작용을 넣지 않는다.
- 인자로 받은 그래프·프레임 배열을 변경하지 않는다.
- `scoring/`·`heap/`를 entry로 재수출하거나 프랙탈 밖에서 import하게 하지 않는다.
