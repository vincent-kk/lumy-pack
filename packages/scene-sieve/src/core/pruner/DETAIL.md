# SPEC: pruner

## Requirements

G(t) 그래프에서 의미 있는 프레임을 순수 함수로 선별한다. 임계값은 분포 정규화 점수에 적용되고, 개수 상한은 가장 유사한 인접 쌍부터 greedy로 병합해 맞춘다. 첫·마지막 후보는 항상 보존한다.

## API Contracts

### `pruneTo(graph: ScoreEdge[], frames: FrameNode[], targetCount: number): Set<number>`

- 프레임의 이중 연결 리스트와 edge 최소 힙을 만들고, 최저 점수 edge의 뒤쪽 프레임(`tgtId`)을 제거한 뒤 이웃을 다시 잇고 `max(left, right)` 점수의 합성 edge를 넣는다. 생존 수가 `targetCount`가 될 때까지 반복한다. O(N log N).
- `tgtId`가 첫 프레임이나 마지막 프레임이면 건너뛴다. 제거된 프레임을 포함한 stale 힙 항목은 pop 시 무시한다.

### `pruneByThreshold(graph: ScoreEdge[], threshold: number): Set<number>`

- `normalizeScores(graph)`로 [0, 1] 점수를 얻고 `>= threshold`인 edge 인덱스를 모은 뒤 `suppressConsecutiveRuns`로 구간별 peak만 남긴다. 첫·마지막 프레임은 항상 포함한다.

### `suppressConsecutiveRuns(graph, passingIndices, normalizedScores): Set<number>`

- 오름차순 통과 인덱스를 연속 구간(run)으로 묶고, 구간 안의 엄격한 국소 최대(양 이웃보다 큼)를 모두 남긴다. 국소 최대가 없는 평탄·단조 구간은 전역 최대 하나를 남긴다. 단일 원소 구간은 그대로다. 반환은 남길 edge의 `targetId` 집합이다.

### `pruneByThresholdWithCap(graph, frames, threshold, cap): Set<number>`

- 1단계 `pruneByThreshold`. 생존 수가 `cap`을 넘으면 연속 생존자 A, B 사이의 제거된 프레임들을 잇는 합성 edge 점수를 `min(score(A→x1), …, score(xN→B))`로 재구성한 부분 그래프에 `pruneTo`를 적용한다.

### 정규화 organ (`scoring/normalize-scores.ts`)

`normalizeScores<T extends ScoredItem>(items: T[]): number[]` — 입력과 같은 길이의 [0, 1] 배열.

- 유한하고 양수인 점수만 유효하며 나머지는 0으로 취급한다. 양수 점수가 없으면 그대로 반환한다.
- 양수 점수가 `NORMALIZATION_MIN_SAMPLE_SIZE`(10) 이하이면 min–max 선형 정규화로 fallback한다(모두 같으면 1).
- 그 이상이면 (1) 중앙값과 MAD(`NORMALIZATION_MAD_COEFFICIENT` 1.4826 배, MAD가 0이면 중앙값)로 robust Z를 구해 `NORMALIZATION_LOGISTIC_K`(3.0) 시그모이드에 통과시키고, (2) 정렬 배열의 lower-bound 이진 탐색 rank를 길이로 나눈 CDF를 구해, `(1 − α)·logistic + α·cdf`(`NORMALIZATION_ALPHA` 0.4)로 결합한다. 동점은 첫 위치의 rank를 공유한다.
- 네 상수는 이 파일이 export하며 검증 파일 외의 소비자는 없다.

### 힙 organ (`heap/min-heap.ts`)

`MinHeap<T extends { score: number }>` — `push`/`pop` O(log N), `size` O(1). 동점 순서는 보장하지 않는다.

## Acceptance Criteria

### boundary-protection — 첫·마지막 후보 보존

- [ ] 모든 export 결과에 첫·마지막 프레임 ID가 포함된다(`count = 1` 포함).
- [ ] `pruneTo`는 첫·마지막 프레임을 `tgtId`로 하는 edge를 건너뛴다.

### purity — 순수 함수

- [ ] 어떤 export도 인자를 변경하거나 I/O·로깅을 수행하지 않는다.
- [ ] 같은 입력에 같은 출력을 반환한다.

### threshold-semantics — 정규화 임계값

- [ ] threshold는 `normalizeScores`의 [0, 1] 점수에 적용된다.
- [ ] 연속 통과 구간에서는 국소 최대만 남고, 국소 최대가 없으면 구간 최대 하나만 남는다.
- [ ] 소표본(양수 점수 10개 이하)은 min–max fallback을 쓴다.

### cap-rebuild — 상한 적용

- [ ] 생존 수가 `cap`을 넘을 때만 부분 그래프를 재구성하고 `pruneTo`를 적용한다.
- [ ] 합성 edge 점수는 간격 안 edge 점수의 최소값이다.

## Last Updated

2026-09-10
