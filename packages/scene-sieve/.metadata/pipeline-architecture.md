# scene-sieve Pipeline Architecture

동영상/GIF에서 핵심 N장의 장면을 자동 선별하는 파이프라인 전체 구조.

## 전체 흐름 요약

```
입력 (video/gif)
  │
  ▼
┌─────────────────────────────────────────────────────┐
│ 1. INIT         임시 워크스페이스 생성               │  workspace.ts
│                 (~/.../scene-sieve-{uuid}/)          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 2. EXTRACT      FFmpeg로 프레임 이미지 추출          │  extractor.ts
│                                                      │
│   ① I-Frame 우선 추출 시도                           │
│   ② I-Frame < 3개면 → FPS 기반 균등 추출 (기본 5fps) │
│                                                      │
│   결과: FrameNode[] (id, timestamp, extractPath)     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 3. ANALYZE      인접 프레임 쌍의 변화량 측정          │  analyzer.ts
│                                                      │
│   배치 단위 (OPENCV_BATCH_SIZE=10)로 처리:           │
│                                                      │
│   Frame[i] ←→ Frame[i+1] 비교 파이프라인:            │
│                                                      │
│   ┌──────────────┐                                   │
│   │ Preprocessing │  sharp: 720px 리사이즈,           │
│   │              │  grayscale, blur(1.0)              │
│   └──────┬───────┘                                   │
│          ▼                                           │
│   ┌──────────────┐                                   │
│   │ Stage 1      │  AKAZE: 특징점 추출 + 매칭         │
│   │ Feature Diff │  BFMatcher.knnMatch (Hamming)     │
│   │              │  Lowe's ratio test (0.75)          │
│   │              │  → sNew[] (새 특징점)              │
│   │              │  → sLoss[] (소실 특징점)            │
│   └──────┬───────┘                                   │
│          ▼                                           │
│   ┌──────────────┐                                   │
│   │ Stage 2      │  DBSCAN: 새 특징점을 공간 클러스터 │
│   │ Clustering   │  로 그룹화 (alpha=0.03, minPts=4) │
│   │              │  → BoundingBox[] (클러스터 영역)   │
│   └──────┬───────┘                                   │
│          ▼                                           │
│   ┌──────────────┐                                   │
│   │ Stage 3      │  IoU Tracker: 연속 프레임에서      │
│   │ Animation    │  같은 위치에 반복 변화하는 영역 감지│
│   │ Detection    │  (IoU>0.9, 5프레임 이상 연속)      │
│   │              │  → 애니메이션/루프 영역 가중치 감쇄 │
│   └──────┬───────┘                                   │
│          ▼                                           │
│   ┌──────────────┐                                   │
│   │ Stage 4      │  G(t) = Σ (정규화면적 × 특징밀도)  │
│   │ Score Calc   │  애니메이션 영역은 (1-weight)로 감쇄│
│   │              │                                   │
│   │  높은 G(t) = 큰 시각적 변화 (장면 전환)           │
│   │  낮은 G(t) = 유사한 프레임 (병합 후보)            │
│   └──────┬───────┘                                   │
│                                                      │
│   결과: ScoreEdge[] (N-1개 인접 쌍)                   │
│         { sourceId, targetId, score }                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 4. PRUNE        edge-aware greedy merge + re-link    │  pruner.ts
│                                                      │
│   입력: ScoreEdge[] (chain graph) + FrameNode[]      │
│   목표: 정확히 targetCount개의 프레임만 남기기         │
│                                                      │
│   알고리즘:                                           │
│   ① 프레임을 이중 연결 리스트로 구성                   │
│   ② 가장 낮은 score edge 찾기 (= 가장 유사한 쌍)     │
│   ③ 해당 edge의 later 프레임 제거                     │
│   ④ 제거된 프레임의 양쪽 이웃을 재연결                 │
│   ⑤ 합성 edge score = max(left, right)               │
│   ⑥ surviving.size === targetCount가 될 때까지 반복   │
│                                                      │
│   제약: 첫/마지막 프레임은 절대 제거 안 함 (경계 보호) │
│                                                      │
│   결과: Set<number> (살아남은 프레임 ID)              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ 5. FINALIZE     선택된 프레임을 출력 디렉토리로 복사   │  workspace.ts
│                                                      │
│   staging dir에 복사 → fs.rename으로 atomic 이동     │
│   완료 후 임시 워크스페이스 삭제                       │
│                                                      │
│   결과: scene_001.jpg ~ scene_00N.jpg                │
└─────────────────────────────────────────────────────┘
```

## 단계별 시간 비용

실제 측정 기준: 6.2MB .mov 파일, 15 프레임, target 5

| 단계 | 소요 시간 | 비중 | 복잡도 |
|------|----------|------|--------|
| EXTRACT (FFmpeg) | ~1.5s | 37% | I/O bound |
| ANALYZE (OpenCV) | ~2.3s | 57% | O(N × B) |
| PRUNE | <0.01ms | ~0% | O(N log N) |
| FINALIZE | ~0.2s | 5% | I/O bound |

> N = 프레임 수, B = 프레임당 분석 비용 (~100-200ms)

## Pruner 복잡도

### 현재: O(N log N) — min-heap 기반

```
① edge들을 min-heap에 삽입               → O(E log E) = O(N log N)
② pop min → 프레임 제거 → 합성 edge push  → O(log N) per step
③ N-targetCount번 반복                    → O(N log N)
총: O(N log N)
```

제거된 프레임을 참조하는 stale 엔트리는 pop 시 lazy deletion으로 건너뛴다.
합성 edge 생성 시 edgeScore Map으로 현재 유효한 edge인지 검증한다.

### 실측 벤치마크

```
N=50   → 5:    0.17ms
N=100  → 10:   0.21ms
N=500  → 50:   0.71ms
N=1000 → 100:  1.40ms
N=3000 → 300:  2.65ms
```

경험적 복잡도: O(N^0.6) ~ O(N^1.0) 범위 (이론적 O(N log N) 이하).
10분 영상(5fps, 3000 프레임)에서도 3ms 이내로 처리 가능.

## 핵심 데이터 구조

```typescript
// 프레임 노드 — 추출된 개별 프레임
interface FrameNode {
  id: number;          // 0부터 시작하는 순번
  timestamp: number;   // 영상 내 시간 위치 (초)
  extractPath: string; // 추출된 이미지 파일 경로
}

// 점수 엣지 — 인접 프레임 쌍의 변화량
interface ScoreEdge {
  sourceId: number;    // 앞 프레임 ID
  targetId: number;    // 뒤 프레임 ID
  score: number;       // G(t) information gain
                       // 높음 = 큰 변화 (보존)
                       // 낮음 = 유사 (병합 후보)
}

// 처리 컨텍스트 — 파이프라인 상태 관리
interface ProcessContext {
  options: ResolvedOptions;
  workspacePath: string;
  frames: FrameNode[];
  graph: ScoreEdge[];
  status: ProgressPhase;
  emitProgress: (percent: number) => void;
}
```

## 그래프 구조

analyzer는 항상 **linear chain graph**를 생성한다:

```
Frame:  [0] ──→ [1] ──→ [2] ──→ [3] ──→ ... ──→ [N-1]
Edge:       e0       e1       e2       e3           eN-2

N개 프레임 → N-1개 edge (인접 쌍만)
```

비인접 프레임 쌍은 분석하지 않는다.
이유: AKAZE 분석이 프레임당 ~100ms로 비용이 높아,
완전 그래프(N^2개 edge)를 만들면 비현실적이기 때문.

## Pruner 동작 예시

```
입력: 10 프레임, target 4

Frame:  0 ── 1 ── 2 ── 3 ── 4 ── 5 ── 6 ── 7 ── 8 ── 9
Score:    0.1  0.8  0.3  0.1  0.1  0.2  0.7  0.1  0.1

Step 1: 최저 edge 0→1 (0.1) → frame 1 제거
        re-link: 0↔2, 합성 score = max(0.1, 0.8) = 0.8
        0 ── 2 ── 3 ── 4 ── 5 ── 6 ── 7 ── 8 ── 9
          0.8  0.3  0.1  0.1  0.2  0.7  0.1  0.1

Step 2: 최저 edge 3→4 (0.1) → frame 4 제거
        re-link: 3↔5, 합성 score = max(0.1, 0.1) = 0.1
        0 ── 2 ── 3 ── 5 ── 6 ── 7 ── 8 ── 9
          0.8  0.3  0.1  0.2  0.7  0.1  0.1

Step 3: 최저 edge 3→5 (0.1) → frame 5 제거
        re-link: 3↔6, 합성 score = max(0.1, 0.2) = 0.2
        0 ── 2 ── 3 ── 6 ── 7 ── 8 ── 9
          0.8  0.3  0.2  0.7  0.1  0.1

Step 4: 최저 edge 7→8 (0.1) → frame 8 제거
        re-link: 7↔9, 합성 score = max(0.1, 0.1) = 0.1
        0 ── 2 ── 3 ── 6 ── 7 ── 9
          0.8  0.3  0.2  0.7  0.1

Step 5: 최저 edge 7→9 (0.1) → frame 9는 경계! 스킵
        다음 최저: 3→6 (0.2) → frame 6 제거
        re-link: 3↔7, 합성 score = max(0.2, 0.7) = 0.7
        0 ── 2 ── 3 ── 7 ── 9
          0.8  0.3  0.7  0.1

Step 6: surviving.size (5) > targetCount (4)
        최저 edge 7→9 (0.1) → 9는 경계! 스킵
        다음 최저: 3→7 (0.7) 또는 2→3 (0.3)
        2→3 (0.3) → frame 3 제거
        re-link: 2↔7, 합성 score = max(0.3, 0.7) = 0.7
        0 ── 2 ── 7 ── 9
          0.8  0.7  0.1

surviving = {0, 2, 7, 9} → 정확히 4개!
시간축에 고르게 분포된 대표 프레임이 선택됨.
```

## 상수 참조

| 상수 | 값 | 용도 |
|------|-----|------|
| DEFAULT_COUNT | 5 | 기본 목표 프레임 수 |
| DEFAULT_FPS | 5 | 프레임 추출 FPS |
| DEFAULT_SCALE | 720 | 분석용 이미지 너비 (px) |
| OPENCV_BATCH_SIZE | 10 | 메모리 효율 배치 크기 |
| MIN_IFRAME_COUNT | 3 | I-Frame 최소 개수 (미달 시 FPS 폴백) |
| DBSCAN_ALPHA | 0.03 | 클러스터 거리 임계값 (이미지 크기 비율) |
| DBSCAN_MIN_PTS | 4 | 클러스터 최소 점 수 |
| IOU_THRESHOLD | 0.9 | IoU 추적 매칭 임계값 |
| DECAY_LAMBDA | 0.95 | 시간 감쇠 계수 |
| ANIMATION_FRAME_THRESHOLD | 5 | 애니메이션 감지 연속 프레임 수 |
| MATCH_DISTANCE_THRESHOLD | 0.75 | Lowe's ratio test 임계값 |

## 파일 구조

```
src/
├── cli.ts              # Commander.js CLI 진입점
├── index.ts            # 라이브러리 export (extractScenes)
├── version.ts          # 자동 주입되는 버전
├── constants.ts        # 모든 기본값과 임계값
├── core/
│   ├── orchestrator.ts # 5단계 파이프라인 실행 제어
│   ├── input-resolver.ts # 입력 모드 해석 (file/buffer/frames)
│   ├── workspace.ts    # 임시 디렉토리, atomic output
│   ├── extractor.ts    # FFmpeg I-Frame + FPS 추출
│   ├── analyzer.ts     # OpenCV WASM 시각 분석 엔진
│   ├── pruner.ts       # Edge-aware greedy merge + re-link
│   └── dbscan.ts       # DBSCAN 클러스터링 (순수 함수)
├── types/
│   └── index.ts        # 모든 TypeScript 인터페이스
└── utils/
    ├── logger.ts       # picocolors 기반 로거
    └── paths.ts        # 파일/디렉토리 유틸리티
```
