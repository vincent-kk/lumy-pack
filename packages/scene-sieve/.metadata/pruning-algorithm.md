# Pruning Algorithm — 이론에서 구현까지

프레임 시퀀스를 목표 개수로 압축하는 프루닝 알고리즘의 이론적 배경과 실제 구현을 연결한다.

> 파이프라인 전체 구조와 동작 예시는 [pipeline-architecture.md](./pipeline-architecture.md) 참조.

---

## 1. 이론적 배경

### 1.1 정보 이득 점수 G(t)

연구 의뢰서(Phase 4)에서 제안된 핵심 수식이다.

인접 프레임 `t`와 `t+1` 사이의 DBSCAN 신규 군집에 대해:

```
G(t) = Σ (정규화면적_i × 특징밀도_i × 감쇄계수_i)
```

| 항목 | 의미 |
|------|------|
| 정규화면적 | 군집 바운딩박스 면적 / 전체 이미지 면적 |
| 특징밀도 | 군집 내 신규 특징점 수 / 군집 면적 |
| 감쇄계수 | 애니메이션 영역이면 `(1 - weight)`, 아니면 `1.0` |

**높은 G(t)** = 큰 시각적 변화 (UI 상태 전이, 모달 등장 등)
**낮은 G(t)** = 유사한 프레임 (스크롤, 미세 변화)

### 1.2 애니메이션 감쇄의 원리

Phase 3(IoU Tracker)에서 같은 위치에 반복 변화하는 영역(로딩 스피너, 프로그레스 바 등)을
탐지하면, 해당 영역의 특징점 점수에 시간 감쇄 계수 `λ^(t-t₀)`를 곱한다.

```
감쇄된 점수 = P(t) × λ^(t - t₀)     (λ = 0.95)
```

이로써 의미 없는 픽셀 깜빡임이 G(t)를 높여 "중요한 프레임"으로 오인되는 것을 방지한다.

### 1.3 탐욕 프루닝

연구 의뢰서(Section 6.2)의 알고리즘:

> 전체 프레임 시퀀스에서 G(t)가 **가장 낮은 인접 쌍**을 반복적으로 찾아
> 병합/제거하여, 목표 프레임 수 N_target에 도달한다.

고정 주기 샘플링(예: 1초에 1장)의 맹점 — 찰나의 상태 전이 누락 — 을 해결한다.
G(t) 기반으로 "변화가 적은 프레임"부터 제거하므로, 중요한 전이 순간은 끝까지 보존된다.

---

## 2. 이론 → 코드 매핑

| 이론 개념 | 코드 구현체 | 파일 |
|-----------|------------|------|
| G(t) 정보 이득 점수 | `ScoreEdge.score` | `core/analyzer.ts` |
| 프레임 시퀀스 배열 | `FrameNode[]` (linear chain graph) | `types/index.ts` |
| "가장 유사한 인접 쌍" 탐색 | `MinHeap.pop()` — 최소 score edge | `core/pruner.ts` |
| "병합/가지치기" | `surviving.delete(tgtId)` + 이웃 재연결 | `core/pruner.ts` |
| N_target (목표 프레임 수) | `targetCount` 파라미터 | `core/pruner.ts` |
| 시간축 경계 보존 | `firstId` / `lastId` boundary protection | `core/pruner.ts` |
| 합성 점수 근사 | `Math.max(leftScore, rightScore)` | `core/pruner.ts` |
| Min-heap 자료구조 | `MinHeap<T>` 제네릭 클래스 | `utils/min-heap.ts` |

### analyzer가 생성하는 것

```
Frame:  [0] ──→ [1] ──→ [2] ──→ ... ──→ [N-1]
Edge:       e₀       e₁       e₂           eₙ₋₂

각 edge의 score = G(t) 정보 이득 점수
N개 프레임 → N-1개 edge (인접 쌍만)
```

비인접 프레임 쌍은 분석하지 않는다.
AKAZE 분석이 프레임당 ~100ms로 비용이 높아 완전 그래프(N² edge)는 비현실적이기 때문이다.

### pruner가 하는 것

이 linear chain graph에서 **정확히 targetCount개의 프레임**만 남긴다.

---

## 3. 알고리즘 진화

### v1 — 정렬 기반 Greedy (초기)

```
① edge를 score 오름차순으로 정렬
② 순회하며 "양쪽 노드 모두 alive"인 edge의 targetId를 제거
③ surviving.size === targetCount가 될 때까지 반복
```

**문제:** chain에서 frame B를 제거하면 A→B edge와 B→C edge 모두 무효화된다.
"양쪽 alive" 조건이 **교대 제거 패턴**을 강제하여 최대 `ceil(N/2)`개만 제거 가능.

```
예: 15 프레임 → target 5 = 10개 제거 필요
    최악 경우 7개만 제거 → 8장 출력 (targetCount 미달!)
```

### v2 — Edge-Aware Greedy Merge + Re-linking (재설계)

```
① 프레임을 이중 연결 리스트로 구성
② edgeScore Map에서 최저 score edge를 linear scan으로 탐색
③ 해당 edge의 later 프레임(tgtId) 제거
④ 제거된 프레임의 양쪽 이웃을 재연결
⑤ 합성 edge score = max(left, right)
⑥ surviving.size === targetCount가 될 때까지 반복
```

**해결:** 프레임 제거 후 이웃을 재연결하므로, 매 step에서 반드시 1개 제거 가능.
targetCount 보장.

**한계:** 매 iteration마다 전체 edge를 순회 → **O(N²)**

### v3 — Min-Heap 최적화 (현재)

```
① edge들을 min-heap에 삽입                → O(N log N)
② pop min → stale 검사 → 프레임 제거      → O(log N) per step
③ 합성 edge를 heap에 push                 → O(log N)
④ N - targetCount번 반복                   → O(N log N)
```

**핵심 변경:** linear scan → `MinHeap.pop()`.
제거된 프레임을 참조하는 stale 엔트리는 **lazy deletion**으로 처리.

---

## 4. 핵심 설계 결정

### 합성 edge score = max(left, right)

프레임 B를 제거하고 A↔C를 연결할 때, 새 edge 점수를 어떻게 정할 것인가?

```
A ──[0.1]── B ──[0.8]── C
         B 제거
A ──────[???]────── C
```

**선택지:**
- `min(0.1, 0.8) = 0.1` → 가장 작은 변화 기준 (공격적)
- `avg(0.1, 0.8) = 0.45` → 평균 (중립적)
- `max(0.1, 0.8) = 0.8` → 가장 큰 변화 기준 (보수적) ← **채택**

`max`를 선택한 이유: A→C 구간에 원래 "큰 변화"(0.8)가 있었으므로,
이 구간을 쉽게 병합하면 안 된다. 보수적으로 높은 점수를 부여하여
**중요한 전이가 소실되는 것을 방지**한다.

### later frame(tgtId) 제거

edge `A→B`에서 항상 뒤쪽 프레임(B)을 제거한다.
이는 chain의 시간 방향성을 유지하기 위함이다.
앞쪽 프레임(A)을 제거하면 A의 이전 프레임과의 edge 처리가 복잡해진다.

### Boundary Protection

첫 프레임과 마지막 프레임은 **절대 제거하지 않는다**.

이론적 근거: 영상의 시작/끝 상태는 VLM이 전체 맥락을 파악하는 데 필수적이다.
시작 프레임 없이는 "어디서 시작했는지", 끝 프레임 없이는 "어디서 끝났는지"를 알 수 없다.

구현: `firstId`와 `lastId`가 tgtId인 edge는 skip한다.

### Lazy Deletion

min-heap에서 프레임을 제거할 때, 해당 프레임을 참조하는 모든 heap 엔트리를
즉시 삭제하지 않는다. 대신 pop 시점에 유효성을 검사한다.

```typescript
// pop한 entry의 양쪽 노드가 살아있는지 확인
if (!surviving.has(entry.srcId) || !surviving.has(entry.tgtId)) continue;

// 합성 edge로 대체되었는지 확인
if (edgeScore.get(key) !== entry.score) continue;
```

이 접근의 장점:
- decrease-key 연산이 불필요 (구현 단순화)
- heap 내부 구조를 건드리지 않으므로 불변성 유지
- stale 엔트리는 최대 O(N)개이므로 전체 복잡도에 영향 없음

---

## 5. 자료구조

### MinHeap (`utils/min-heap.ts`)

```typescript
class MinHeap<T extends { score: number }> {
  push(entry: T): void    // O(log N) — sift up
  pop(): T | undefined     // O(log N) — sift down
  get size(): number       // O(1)
}
```

제네릭 binary min-heap. `score` 필드 기준으로 정렬.
pruner에서는 `EdgeEntry { score, srcId, tgtId }` 타입으로 인스턴스화.

### 이중 연결 리스트

```typescript
const prev = new Map<number, number>();  // frameId → 이전 frameId
const next = new Map<number, number>();  // frameId → 다음 frameId
```

프레임 제거 시 O(1)로 이웃 재연결:
```
next.set(srcId, tgtNext);   // src의 다음을 tgt의 다음으로
prev.set(tgtNext, srcId);   // tgt의 다음의 이전을 src로
```

### Edge Score Map

```typescript
const edgeScore = new Map<string, number>();  // "srcId:tgtId" → score
```

두 가지 용도:
1. 재연결 시 right edge의 score 조회
2. pop된 entry가 현재 유효한 edge인지 검증 (lazy deletion의 두 번째 가드)

---

## 6. 복잡도 분석

### 이론적 복잡도

| 연산 | 복잡도 |
|------|--------|
| 이중 연결 리스트 구축 | O(N) |
| edge를 heap에 삽입 | O(E log E) = O(N log N) |
| main loop (N-targetCount iterations) | O(N log N) |
| 총합 | **O(N log N)** |

stale 엔트리로 인한 추가 pop은 최대 O(N)회이므로 총 복잡도에 영향 없음.

### 실측 벤치마크

```
N=50   → 5:    0.17ms
N=100  → 10:   0.21ms
N=500  → 50:   0.71ms
N=1000 → 100:  1.40ms
N=3000 → 300:  2.65ms
```

경험적 복잡도: **O(N^0.6) ~ O(N^1.0)** 범위.
10분 영상(5fps, 3000 프레임)에서도 3ms 이내로 처리.

### 파이프라인 내 비중

```
EXTRACT (FFmpeg):  ~1.5s  (37%)
ANALYZE (OpenCV):  ~2.3s  (57%)   ← 병목
PRUNE:             <0.01ms (~0%)
FINALIZE:          ~0.2s  (5%)
```

pruner는 전체 파이프라인의 0.001% 미만을 차지한다.
알고리즘 최적화의 실질적 의의는 N > 1,000인 장시간 영상에서 드러난다.

---

## 7. 코드 참조

| 파일 | 역할 |
|------|------|
| `src/core/pruner.ts` | pruneTo() — 프루닝 알고리즘 본체 |
| `src/utils/min-heap.ts` | MinHeap<T> — 제네릭 binary min-heap |
| `src/core/analyzer.ts` | ScoreEdge[] 생성 (G(t) 계산) |
| `src/types/index.ts` | FrameNode, ScoreEdge 인터페이스 정의 |
| `src/__tests__/unit/pruner.test.ts` | 11개 단위 테스트 |
| `src/__tests__/bench/algorithms.bench.ts` | 벤치마크 (50~3000 프레임) |
