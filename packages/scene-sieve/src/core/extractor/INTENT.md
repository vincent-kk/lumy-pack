# extractor

## Purpose

파이프라인의 추출 단계. 번들된 FFmpeg/ffprobe로 입력 영상을 FPS 격자 위의 JPEG 후보 프레임으로 바꾸고, 실제 추출 격자의 FPS와 원본 길이를 `ProcessContext`에 기록한다. frames 입력은 추출 없이 그대로 통과시킨다.

## Conventions

- FFmpeg 필터는 `fps=<effectiveFps>,scale=-1:<scale>` 한 가지 형태만 쓰고, 후보 개수는 `-frames:v`로 상한을 건다.
- 후보 timestamp는 출력 격자의 로컬 시각 `index / effectiveFps`이며 소스 PTS가 아니다. 세그먼트 seek 오프셋은 호출자가 더한다.
- ffprobe 메타데이터로 포맷·길이·비디오 스트림 유무를 판정한다. 확장자 검사는 하지 않는다.
- 파일 패턴·출력 확장자 상수는 `core/constants/`, 디렉터리·존재 확인은 `core/utils/filesystem/` — 둘 다 `core`의 organ이므로 concrete 파일을 직접 import한다.

## Boundaries

- 소비자는 `orchestrator`(전체 추출)와 `segmenter`(범위 추출·메타데이터)이며 entry를 통해서만 접근한다.
- 이 프랙탈은 분석·가지치기·출력 형식을 모른다. 후보의 선택 여부는 상류가 결정한다.
- 상태는 `ProcessContext`의 `effectiveFps`·`sourceDurationSec` 두 필드에만 쓴다.

## Always do

- file/buffer 입력에서 `effectiveFps = min(fps, max(2, maxFrames) / duration)`를 적용하고 FPS 하한을 두지 않는다.
- 길이를 알 수 없는 입력에도 `-frames:v` 개수 제한을 적용한다.
- 워크스페이스에서 생성한 프레임 전용 디렉터리 안에만 쓴다.
- 추출·범위 추출의 결과는 파일명 정렬 순서로 0부터 번호를 매긴다.

## Ask first

- 필터 문자열·품질(`-q:v`)·파일명 패턴 변경 — `../../DETAIL.md`의 옵션 표와 세그먼트 격자 계약이 함께 바뀐다.
- ffprobe 판정 규칙(비디오 스트림 필수) 완화.
- `extractFramesForRange`의 인자 순서·기본 `frameLimit` 변경 — `segmenter`의 예산 계산과 결합되어 있다.

## Never do

- 워크스페이스 밖의 경로에 파일을 쓰거나 입력 파일을 수정하지 않는다.
- FFmpeg 격자 timestamp를 소스 PTS로 보정하지 않는다.
- 시스템 FFmpeg에 의존하지 않는다 — `ffmpeg-static`·`@ffprobe-installer/ffprobe`만 사용한다.
- 다른 core 자식 프랙탈의 내부 파일을 import하지 않는다.
