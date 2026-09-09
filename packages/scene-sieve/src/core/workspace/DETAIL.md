# SPEC: workspace

## Requirements

파이프라인 실행마다 격리된 임시 디렉터리를 제공하고, 실행이 끝나면(또는 이전 실행이 남긴 것이면) 정리한다. 입력 버퍼·프레임을 디스크에 스테이징하고, 선택된 프레임을 JPEG 파일 또는 Buffer로 내보낸다. 파일 모드에서는 기존 출력 디렉터리를 새 결과로 교체한다.

## API Contracts

### 생명주기

- `createWorkspace(sessionId: string): Promise<string>` — `getTempWorkspaceDir(sessionId)`(임시 루트 + `scene-sieve-` 접두사) 경로를 만들고 돌려준다.
- `createSegmentWorkspace(workspacePath, segmentIndex): Promise<string>` — 상위 workspace 아래 세그먼트 전용 하위 디렉터리를 만든다.
- `cleanupWorkspace(workspacePath): Promise<void>` — `rm -rf` 의미로 삭제한다. 없는 경로에서도 실패하지 않는다.
- `cleanupStaleWorkspaces(): Promise<void>` — 임시 루트에서 접두사가 맞고 수정 시각이 1시간을 넘은 디렉터리를 삭제한다. CLI가 시작 시 호출하며 `core/index.ts`에서 named re-export한다. 개별 삭제 실패는 전체를 중단시키지 않는다.

### 입력 스테이징

- `writeInputBuffer(workspacePath, buffer): Promise<string>` — 비디오 버퍼를 workspace 안 파일로 쓰고 경로를 돌려준다.
- `writeInputFrames(workspacePath, frames: Buffer[]): Promise<FrameNode[]>` — 각 버퍼를 프레임 파일로 쓰고 `{ id: i, timestamp: i, extractPath }`를 돌려준다. 크기 검증은 호출자(input-resolver)가 이미 마친 상태다.

### 출력

- `readFramesAsBuffers(frameNodes: FrameNode[], quality: number): Promise<Buffer[]>` — 각 `extractPath`를 지정한 품질의 JPEG(mozjpeg)로 인코딩해 순서대로 돌려준다. buffer·frames 모드의 반환값이다.
- `finalizeOutput(ctx: ProcessContext, frames: FrameNode[]): Promise<string[]>` — 파일 모드 출력.
  - `ctx.options.quality`로 각 프레임을 staging 디렉터리에 JPEG로 쓴다. resize하지 않으므로 추출 이미지와 출력 JPEG의 크기가 같다.
  - `metadata.json`을 함께 쓴다. `video`와 출력 좌표계 `animations`는 `buildVideoMetadata(ctx, frames, analysisResolution)`(core organ `utils/metadata/`, 계약은 `core/DETAIL.md`)의 결과를 쓰되, 파일 전용으로 프레임·animation ID를 1-based로 바꾸고 `timestampMs`·`durationMs`를 정수로 반올림한다. API 결과의 0-based ID는 바꾸지 않는다.
  - 기존 출력 디렉터리를 `rm -rf`한 뒤 staging을 `rename`한다. 삭제와 rename 전체는 원자적 교체가 아니다.
  - 돌려주는 값은 최종 출력 디렉터리 안의 JPEG 경로 배열이다.

## Acceptance Criteria

### workspace-lifecycle — 생성과 정리

- `createWorkspace`가 돌려준 경로는 임시 루트 아래 `scene-sieve-<sessionId>`이며 존재한다.
- `cleanupWorkspace`는 존재하지 않는 경로에서 예외 없이 완료된다.
- `cleanupStaleWorkspaces`는 접두사가 다른 디렉터리와 1시간 이내에 수정된 디렉터리를 남긴다.

### output-replace — 파일 모드 출력 교체

- `finalizeOutput` 뒤 이전 출력 디렉터리의 파일은 남지 않고, 반환 경로는 모두 존재한다.
- 출력 JPEG의 너비·높이는 추출 이미지와 같다.
- `metadata.json`의 프레임·animation ID는 1부터 시작하고 `durationMs`는 정수다.

### frame-buffers — Buffer 출력

- `readFramesAsBuffers`는 입력 순서를 유지하고 각 항목은 JPEG 시그니처로 시작한다.
- 지정한 `quality`가 인코딩에 반영된다(낮은 품질이 더 작은 바이트 수를 낸다).

## Last Updated

2026-09-10
