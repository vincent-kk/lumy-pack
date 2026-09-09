# input-resolver

## Purpose

사용자가 준 `SieveOptions`를 검증하고 기본값을 채워 `ResolvedOptions`로 만들며, 세 입력 모드(file·buffer·frames)를 파이프라인이 읽을 수 있는 프레임·경로로 정착시킨다. 파이프라인이 만나는 첫 단계다.

## Conventions

- 검증은 기본값 적용 **전**에 validation organ의 `validateOptions`가 수행한다. 이 organ은 input-resolver만 소비하므로 여기에 둔다.
- 오류 메시지는 `<name> must be …, received: <value>` 형식이다. CLI의 `classifyError`가 이 형식을 `INVALID_INPUT`으로 분류하므로 형식을 바꾸면 CLI 계약이 깨진다.
- 옵션 기본값은 src가 소유한 pipeline-defaults 상수를 쓴다. 옵션의 의미·기본값·검증 규칙 표는 src의 DETAIL(Options)이 소유하며 여기에 복사하지 않는다.
- 경로 정착은 core의 filesystem organ, 입력 저장은 형제 프랙탈 workspace의 entry를 쓴다.

## Boundaries

- 공개 계약은 `resolveOptions`와 `resolveInput`이다. 소비자는 orchestrator·segmenter와 `core/index.ts`다.
- `pruneMode`는 항상 `threshold-with-cap`이다. 다른 모드를 고르는 로직은 존재하지 않으며 여기서 추가하지 않는다.

## Always do

- 지정한 숫자 옵션의 유한성·정수성·범위를 기본값 적용 전에 검사한다.
- frames 입력은 저장 전에 sharp `metadata()`로 모든 버퍼의 너비·높이가 같은지 확인한다.
- file 입력 경로는 `~` 확장과 절대 경로 변환을 거친 값으로 정착시키고, `outputPath` 미지정 시 입력 경로에서 유도한다.

## Ask first

- 옵션 추가·기본값 변경(`../../DETAIL.md` Options 표와 함께 바뀐다)
- 검증 메시지 형식 변경
- 입력 모드 추가

## Never do

- 검증을 건너뛰거나 기본값을 먼저 적용해 잘못된 값을 가리지 않는다.
- 이 프랙탈에서 프레임 추출·분석을 수행하지 않는다.
- `ProcessContext`를 만들거나 조작하지 않는다 — 그것은 orchestrator의 일이다.
