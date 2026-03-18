# git — Git 작업

## Purpose

Git CLI 상호작용을 캡슐화한다. 명령 실행, 리모트 URL 파싱, Git 헬스 체크(버전 감지, bloom filter 지원)를 포함한다.

## Structure

| 경로 | 역할 |
|------|------|
| `index.ts` | 배럴 익스포트 |
| `executor.ts` | execa 래퍼 `gitExec()` |
| `remote.ts` | 리모트 URL 파싱 (SSH/HTTPS) 및 플랫폼 감지 |
| `health.ts` | Git 버전 확인 및 기능 지원 감지 |

## Conventions

- 모든 git 명령은 `gitExec()`을 통해 일관된 에러 처리
- 호출별 타임아웃 및 허용 종료 코드 설정 가능

## Boundaries

### Always do

- 모든 git 서브프로세스 호출에 `gitExec()` 사용
- 비정상 종료 코드를 우아하게 처리

### Ask first

- 새로운 git 서브커맨드 래퍼 추가

### Never do

- `executor.ts` 외부에서 `execa('git', ...)` 직접 호출
