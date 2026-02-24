# SPEC: core

## Purpose

scene-sieve 핵심 파이프라인. 프레임 추출, 비전 분석, 가지치기를 수행.

## Public API

### orchestrator

- `runPipeline(options: SieveOptions): Promise<SieveResult>` — 5단계 파이프라인

### analyzer

- `analyzeFrames(ctx: ProcessContext): Promise<ScoreEdge[]>` — 프레임 쌍 분석
- `computeIoU(a: BoundingBox, b: BoundingBox): number` — IoU 계산
- `computeInformationGain(...)` — 정보 이득 점수 산출

### pruner

- `pruneTo(graph, frames, targetCount): Set<number>` — greedy merge
- `pruneByThreshold(graph, threshold): Set<number>` — 임계값 필터
- `pruneByThresholdWithCap(graph, frames, threshold, cap): Set<number>`

### dbscan

- `dbscan(points, width, height, alpha?, minPts?): DBSCANResult`

### extractor

- `extractFrames(ctx: ProcessContext): Promise<FrameNode[]>` — FFmpeg 추출

### input-resolver

- `resolveOptions(options: SieveOptions): ResolvedOptions`
- `resolveInput(ctx: ProcessContext): Promise<FrameNode[]>`

### workspace

- `createWorkspace(sessionId): Promise<string>`
- `finalizeOutput(ctx, frames): Promise<string[]>`
- `cleanupWorkspace(path): Promise<void>`
- `readFramesAsBuffers(frames): Promise<Buffer[]>`

## Acceptance Criteria

- [ ] 5단계 파이프라인 순차 실행 보장
- [ ] OpenCV Mat 리소스 누수 없음
- [ ] pruner 순수함수 보장 (I/O 없음)
- [ ] 첫/마지막 프레임 boundary protection
