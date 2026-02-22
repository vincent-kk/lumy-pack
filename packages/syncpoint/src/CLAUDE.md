# syncpoint/src

## Purpose

설정파일 백업/복원 및 머신 프로비저닝 CLI 도구의 소스 루트.
Commander.js 진입점, Ink React 명령 컴포넌트, 순수 비즈니스 로직, 스키마, 유틸리티로 구성된다.

## Structure

```
src/
├── cli.ts             # Commander.js 진입점 — 명령 등록 후 parseAsync
├── index.ts           # 라이브러리 공개 API (타입 + core 함수 re-export)
├── constants.ts       # 앱 상수 (경로, 임계값, 민감 패턴)
├── version.ts         # 빌드 시 inject-version.js 가 주입하는 VERSION 상수
├── commands/          # Ink React CLI 컴포넌트 (registerXxxCommand 함수 포함)
├── components/        # 재사용 Ink UI 컴포넌트 (ProgressBar, Table 등)
├── core/              # 순수 async 비즈니스 로직 (UI 의존성 없음)
├── schemas/           # AJV 기반 JSON 스키마 검증기
├── utils/             # 타입, 유틸리티 함수, 경로 헬퍼
└── __tests__/         # 유닛/통합/E2E/Docker 테스트
```

## Conventions

- ESM 모듈 (`"type": "module"`), 임포트 시 `.js` 확장자 필수
- 레이어 의존성: `cli.ts → commands → core → utils/schemas`
- 역방향 임포트 금지 (core는 commands를 import하지 않는다)
- 명령 메타데이터는 `utils/command-registry.ts`의 `COMMANDS` 맵이 단일 출처
- `provision.ts`의 `runProvision()`은 `AsyncGenerator<StepResult>` 반환

## Boundaries

### Always do

- `core/` 함수는 UI import 없이 순수 async 함수로 유지한다
- 설정 로드 시 반드시 `loadConfig()`를 사용하고 AJV 검증을 통과해야 한다
- 새 명령 추가 시 `command-registry.ts`에 메타데이터를 먼저 등록한다
- 버전은 `version.ts`를 통해서만 참조한다

### Ask first

- `constants.ts`의 `SENSITIVE_PATTERNS` 수정 (보안 영향 범위 확인 필요)
- 공개 API(`index.ts`) 변경 (semver 호환성 검토 필요)
- 레이어 경계를 변경하거나 새 레이어 추가

### Never do

- `core/` 모듈에서 Ink/React import 추가
- `cli.ts`에 비즈니스 로직 직접 작성
- `SENSITIVE_PATTERNS`에 매칭되는 파일을 아카이브에 포함
- `curl | sh` 패턴의 provision 스텝 허용 (provision.ts에서 차단됨)

## Dependencies

- **외부**: Commander.js, Ink 5, React 18, AJV 8, fast-glob, micromatch, tar
- **런타임**: Node.js >=20, `~/.syncpoint/` 데이터 디렉토리
