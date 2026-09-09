# workspace

## Purpose

파이프라인이 쓰는 임시 디렉터리의 생명주기(생성·정리·오래된 workspace 청소), 입력 스테이징(buffer·frames 저장), 출력(JPEG 인코딩, 파일 모드 최종 출력 교체)을 소유한다. 파이프라인에서 디스크에 닿는 코드는 extractor의 FFmpeg 호출을 빼면 모두 여기에 있다.

## Conventions

- 경로 규칙(접두사·임시 루트·프레임 파일 패턴·확장자)과 디렉터리 helper는 core가 소유한 organ(workspace-layout 상수, filesystem)에서 가져온다. extractor도 같은 것을 쓰므로 이 프랙탈 안에 두지 않는다.
- 출력 JPEG는 resize하지 않는다. 추출 이미지 크기가 곧 출력 크기다.
- 최종 `video`·`animations` 메타데이터는 core가 소유한 `buildVideoMetadata`로 만들고, 파일 모드는 그 결과에 파일 전용 변환(1-based ID, `durationMs` 반올림)만 더한다.

## Boundaries

- 공개 계약은 workspace 생명주기 함수, 입력 저장 함수, `finalizeOutput`, `readFramesAsBuffers`다. 소비자는 orchestrator·segmenter·input-resolver와 `core/index.ts`(CLI 시작 시 `cleanupStaleWorkspaces`)다.
- 어떤 프레임을 남길지는 pruner가, 프레임 메타데이터의 좌표 변환은 `buildVideoMetadata`가 결정한다. 여기서는 그 결과를 쓰기만 한다.

## Always do

- 파일 모드 출력은 staging 디렉터리에 먼저 쓰고, 기존 출력을 삭제한 뒤 rename한다.
- workspace 정리는 `force: true`로 하여 이미 없는 디렉터리에서도 실패하지 않는다.
- 오래된 workspace 청소는 접두사가 맞는 디렉터리만, 수정 시각이 임계값을 넘은 것만 지운다.

## Ask first

- 출력 교체 절차 변경(원자적 교체 도입 등)
- 임시 루트·접두사·stale 임계값 변경
- 파일 metadata 형식(`.metadata.json` 필드) 변경

## Never do

- 삭제-후-rename이 원자적 교체라고 가정하지 않는다. 중간 실패 시 출력이 비어 있을 수 있다.
- 출력 단계에서 이미지를 resize하거나 분석 좌표계 bbox를 직접 변환하지 않는다.
- 사용자 입력 경로 밖의 디렉터리를 삭제하지 않는다 — 삭제 대상은 workspace와 지정된 출력 디렉터리뿐이다.
