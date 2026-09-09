# src

## Purpose

scene-sieve 패키지 루트. 라이브러리 공개 API(`extractScenes`)와 CLI 실행 파일을 한 패키지로 묶고, 파이프라인과 CLI가 각자의 프랙탈 경계를 갖도록 한다.

## Structure

- `cli.ts`는 실행 파일 entry이고 같은 이름의 디렉터리는 CLI 모듈 경계다. 실행 파일이 루트에 남는 이유: `createRequire`로 패키지 manifest를 읽는 상대 경로가 소스와 dist 양쪽에서 성립해야 하고 `dev` 스크립트가 이 위치를 가리킨다. filid 설정에 허용 peer로 선언되어 있다.

## Conventions

- 옵션 기본값 표는 하나의 organ에 한 단위로 둔다. 상수별 소비자는 세 프랙탈로 갈리지만 `DETAIL.md`의 Options 표가 열 개를 한 계약으로 문서화하므로 나누지 않는다.
- 공용 로거의 JSON 모드는 CLI가 설정하고 파이프라인 코드는 사용만 한다.
- 공개 타입은 타입 organ이 소유한다. 공개 타입 변경은 거기서 시작한다.

## Boundaries

- 외부 소비자는 `index.ts`가 재수출하는 심볼만 본다. Worker 실행과 stale workspace 정리처럼 CLI만 쓰는 심볼은 파이프라인 경계까지만 공개하고 패키지 최상위 API에는 올리지 않는다.
- 실행 파일은 CLI 프랙탈의 entry만, 라이브러리 entry는 파이프라인 프랙탈의 entry만 import한다.
- 검증 파일은 concrete 파일을 직접 import할 수 있다. 벤치는 검증 파일로 인식되지 않으므로 파이프라인 entry를 경유한다.

## Always do

- 공개 API 변경은 `DETAIL.md`의 계약을 먼저 고친 뒤 코드를 바꾼다.
- `--json` 모드 응답은 `@lumy-pack/shared`의 `respond`/`respondError`로만 만든다.
- 새 organ은 소비자의 최하위 공통 프랙탈 아래에 둔다. 소비자가 하나뿐이면 그 프랙탈의 organ이다.

## Ask first

- `index.ts`에 새 공개 export를 추가하기.
- 외부 의존성 추가.
- `ProcessContext` 구조 변경.

## Never do

- 라이브러리 entry나 CLI에서 파이프라인 내부 파일을 직접 import하기.
- 루트 organ(상수, 로깅, 타입)을 패키지 밖에 공개하기.
- 검증 디렉터리에 비즈니스 로직을 두기.
- INTENT에 파일 목록이나 변경 이력을 적기.
