# lumy-pack

Personal Environment Manager 모노레포. 설정파일 백업/복원 및 머신 프로비저닝 CLI 도구 모음.

## Project Structure

- **Monorepo**: Yarn 4.12 workspaces (`packages/*`)
- **Package**: `@lumy-pack/syncpoint` — CLI tool (v0.0.8, npm public)

```
packages/syncpoint/
├── src/
│   ├── cli.ts              # Commander.js CLI 엔트리
│   ├── index.ts            # 라이브러리 export
│   ├── core/               # 순수 비즈니스 로직 (backup, restore, provision, config, storage)
│   ├── commands/            # Ink React CLI 컴포넌트 (Backup.tsx, Restore.tsx 등)
│   ├── components/          # 재사용 UI 컴포넌트 (ProgressBar, Table, Confirm 등)
│   ├── schemas/             # TypeScript 기반 JSON Schema 정의
│   ├── utils/               # 유틸리티 (types, logger, paths, pattern 등)
│   └── __tests__/           # 테스트 (unit, integration, e2e, docker)
└── assets/schemas/          # JSON Schema 파일 (config, metadata, template)
```

## Tech Stack

- TypeScript 5.7.2, Node.js >=20
- Build: tsup (ESM + CJS dual output)
- Test: Vitest 3.2
- UI: Ink 5 + React 18 (terminal renderer)
- CLI: Commander.js 12
- Validation: AJV 8 + JSON Schema
- File: fast-glob, micromatch, tar

## Commands

```bash
# 모노레포 전체
yarn build:all          # 전체 빌드
yarn test:run           # 전체 테스트
yarn typecheck          # TypeScript 타입 체크
yarn lint               # ESLint 검사

# syncpoint 패키지
yarn syncpoint build    # syncpoint 빌드
yarn syncpoint dev      # 개발 모드 (tsx)
yarn syncpoint test     # syncpoint 테스트
yarn syncpoint test:e2e # E2E 테스트
```

## Data Paths

사용자 데이터는 `~/.syncpoint/` 하위에 저장:

| 경로 | 용도 |
|------|------|
| `~/.syncpoint/config.yml` | 백업 설정 파일 |
| `~/.syncpoint/backups/` | 백업 아카이브 (.tar.gz) |
| `~/.syncpoint/templates/` | 프로비저닝 템플릿 (.yml) |
| `~/.syncpoint/scripts/` | 사용자 스크립트 |
| `~/.syncpoint/logs/` | 실행 로그 |

## CLI Commands

| 명령어 | 설명 |
|--------|------|
| `syncpoint init` | 초기 설정 생성 |
| `syncpoint wizard` | AI 기반 대화형 설정 |
| `syncpoint backup` | 설정파일 백업 |
| `syncpoint restore` | 백업 복원 |
| `syncpoint provision <template>` | 머신 프로비저닝 |
| `syncpoint create-template <name>` | 템플릿 생성 |
| `syncpoint list <type>` | 백업/템플릿 목록 |
| `syncpoint status` | 현재 상태 확인 |
| `syncpoint migrate` | 설정 스키마 마이그레이션 |

## Conventions

- ESM modules (`"type": "module"`)
- 출력 확장자: `.mjs` (ESM), `.cjs` (CJS)
- 버전: `scripts/inject-version.js`로 빌드 시 자동 주입
- 릴리즈: Changesets 기반 (`yarn changeset`)
- 패턴: glob (`*.conf`) / regex (`/\.conf$/`) 지원
