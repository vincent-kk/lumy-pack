# 개발 계획서: Personal Environment Manager

> 홈 디렉토리 설정파일 백업·복원과 머신 프로비저닝을 하나의 CLI로 관리하는 도구

---

## 1. 패키지 이름 후보

디렉토리 경로(`~/.{name}/`)와 CLI 명령어를 겸하므로 **짧고 타이핑하기 쉬워야** 합니다.

| 후보          | 디렉토리        | CLI 예시           | 의미                             |
| ------------- | --------------- | ------------------ | -------------------------------- |
| **syncpoint** | `~/.syncpoint/` | `syncpoint backup` | 프로젝트 동기화 및 스캐폴딩 도구 |

결정: syncpoint (`@lumy-pack/syncpoint`)

## 2. 기술 스택

| 항목            | 선택                                 | 이유                                                  |
| --------------- | ------------------------------------ | ----------------------------------------------------- |
| Package Manager | **pnpm**                             | 빠른 설치, 엄격한 의존성 관리                         |
| Runtime         | Node.js 20+                          | LTS                                                   |
| Language        | TypeScript 5+                        | 타입 안전성                                           |
| CLI Renderer    | **Ink 5 + React 18**                 | Interactive TUI, 컴포넌트 기반                        |
| CLI Router      | **Pastel** (Ink 공식) 또는 Commander | 서브커맨드 라우팅                                     |
| YAML            | `yaml` (npm)                         | config·template 파싱                                  |
| Validation      | **ajv 8** + ajv-formats              | JSON Schema 기반 런타임 검증, 기존 프로젝트 경험 활용 |
| Archive         | `tar` (npm, isaacs)                  | tar.gz 생성·해제 — 순수 Node, 외부 바이너리 불필요    |
| Glob            | `fast-glob`                          | backup target 패턴 매칭                               |
| Hash            | `node:crypto` (built-in)             | 파일 무결성 SHA-256                                   |
| Build           | `tsup`                               | ESM 번들링, bin 엔트리                                |

---

## 3. 사용자 데이터 구조 (`~/.{APP}/`)

```
~/.{APP}/
├── config.yml              # 메인 설정
├── backups/                # 기본 백업 저장소 (destination 미설정 시)
│   ├── Vincents-MBP_2025-02-11_221530.tar.gz
│   └── ...
├── templates/              # provisioning 템플릿 (.yml)
│   ├── macos-dev.yml
│   └── ...
├── scripts/                # 커스텀 쉘 스크립트 (.sh) — 자동 백업 포함
│   ├── git-helpers.sh
│   └── ...
└── logs/                   # 실행 로그
    ├── 2025-02-11.log
    └── ...
```

---

## 4. 소스 디렉토리 구조

```
src/
├── cli.tsx                     # entry point — Pastel 또는 Commander + Ink render
├── constants.ts                # APP_NAME, 기본 경로, 파일명 패턴 등
│
├── commands/                   # 명령어별 Ink View 컴포넌트
│   ├── Init.tsx
│   ├── Backup.tsx
│   ├── Restore.tsx
│   ├── Provision.tsx
│   ├── List.tsx
│   └── Status.tsx
│
├── components/                 # 공유 UI 컴포넌트
│   ├── TreeView.tsx            # 파일/백업 트리
│   ├── SelectList.tsx          # 화살표 선택 목록
│   ├── ProgressBar.tsx         # 진행률
│   ├── Confirm.tsx             # Y/N 확인
│   ├── Table.tsx               # 테이블 출력
│   └── StepRunner.tsx          # provisioning 단계 표시
│
├── core/                       # 비즈니스 로직 (순수 모듈, UI 무관)
│   ├── config.ts               # config.yml CRUD + 검증
│   ├── backup.ts               # 백업 생성
│   ├── restore.ts              # 복원
│   ├── provision.ts            # 템플릿 실행
│   ├── metadata.ts             # 메타데이터 생성·파싱
│   └── storage.ts              # tar.gz 압축·해제, 파일 I/O
│
├── schemas/                    # JSON Schema 정의 + AJV 검증 함수
│   ├── config.schema.ts
│   ├── metadata.schema.ts
│   └── template.schema.ts
│
└── utils/
    ├── paths.ts                # ~ 확장, iCloud 경로, 상수 경로 조합
    ├── logger.ts               # logs/ 파일 기록
    ├── system.ts               # hostname, OS 정보
    └── format.ts               # 파일 크기·날짜 포매팅
```

---

## 5. 스키마 설계

### 5-1. `config.yml`

```yaml
# ~/.{APP}/config.yml

backup:
  # 백업 대상 (~ 확장, glob 지원)
  targets:
    - ~/.zshrc
    - ~/.zprofile
    - ~/.gitconfig
    - ~/.gitignore_global
    - ~/.ssh/config
    - ~/.config/starship.toml

  # 제외 패턴
  exclude:
    - "**/*.swp"
    - "**/.DS_Store"

  # 파일명 패턴 — 치환 변수: {hostname}, {date}, {time}, {datetime}
  filename: "{hostname}_{datetime}"

  # 백업 저장 위치 (미설정 → ~/.{APP}/backups/)
  destination: ~/Library/Mobile Documents/com~apple~CloudDocs/{APP}

scripts:
  # true면 scripts/ 디렉토리를 백업에 자동 포함
  includeInBackup: true
```

### 5-2. Backup Metadata (`_metadata.json` — 압축 내부)

```jsonc
{
  "version": "1.0.0", // 메타데이터 스키마 버전
  "toolVersion": "0.1.0", // CLI 도구 버전
  "createdAt": "2025-02-11T22:15:30+09:00",
  "hostname": "Vincents-MacBook-Pro",
  "system": {
    "platform": "darwin",
    "release": "24.3.0",
    "arch": "arm64",
  },
  "config": {
    // 백업 당시 설정 스냅샷
    "filename": "{hostname}_{datetime}",
    "destination": "~/Library/...",
  },
  "files": [
    {
      "path": "~/.zshrc", // 논리 경로
      "absolutePath": "/Users/vincent/.zshrc",
      "size": 4096,
      "hash": "sha256:a1b2c3d4...",
    },
  ],
  "summary": {
    "fileCount": 12,
    "totalSize": 48320,
  },
}
```

> **설계 의도**: 압축 파일 하나만으로 _"언제·어디서·무엇을"_ 백업했는지 완전 파악 가능.
> restore 시 metadata를 먼저 읽어서 충돌 여부를 사전 확인.

### 5-3. Template YAML (provisioning)

```yaml
# ~/.{APP}/templates/macos-dev.yml

name: "macOS 개발환경 셋업"
description: "새 맥북 초기 개발환경 구성"

# (선택) 셋업 완료 후 자동 복원할 백업 파일명
backup: "Vincents-MBP_2025-02-11_221530.tar.gz"

steps:
  - name: "Xcode Command Line Tools"
    description: "빌드 도구 설치"
    command: "xcode-select --install"
    skip_if: "xcode-select -p" # exit 0이면 건너뛰기
    continue_on_error: false # 실패 시 중단

  - name: "Homebrew"
    description: "패키지 매니저 설치"
    command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    skip_if: "which brew"

  - name: "CLI 도구 일괄 설치"
    description: "git, node, pnpm, starship, fzf, ripgrep"
    command: "brew install git node pnpm starship fzf ripgrep"

  - name: "Oh My Zsh"
    command: 'sh -c "$(curl -fsSL https://raw.ohmyz.sh/master/tools/install.sh)" "" --unattended'
    skip_if: "test -d $HOME/.oh-my-zsh"

  - name: "GUI 앱 설치"
    description: "VS Code, iTerm2 등"
    command: "brew install --cask visual-studio-code iterm2 slack"
    continue_on_error: true # 일부 실패해도 진행
```

---

## 6. 명령어 상세 설계

### 6-1. `{APP} init`

| 항목         | 설명                                           |
| ------------ | ---------------------------------------------- |
| 동작         | `~/.{APP}/` 구조 생성 + 기본 `config.yml` 작성 |
| 이미 존재 시 | 경고 후 skip (절대 덮어쓰지 않음)              |
| 완료 후      | config.yml 경로 안내, 다음 단계 가이드         |

**UI 흐름:**

```
✓ ~/.{APP}/ 생성
✓ ~/.{APP}/config.yml 생성 (기본값)
✓ ~/.{APP}/backups/ 생성
✓ ~/.{APP}/templates/ 생성
✓ ~/.{APP}/scripts/ 생성
✓ ~/.{APP}/logs/ 생성

초기화 완료! 다음 단계:
  1. config.yml을 편집하여 백업 대상을 지정하세요
     → ~/.{APP}/config.yml
  2. {APP} backup 으로 첫 번째 스냅샷을 만드세요
```

---

### 6-2. `{APP} backup [--dry-run] [--tag <name>]`

| 항목        | 설명                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| 동작        | config targets 읽기 → 파일 수집 → metadata 생성 → tar.gz → destination 이동 |
| `--dry-run` | 실제 압축 없이 대상 파일 목록만 표시                                        |
| `--tag`     | 파일명에 태그 추가 (`hostname_datetime_pre-update.tar.gz`)                  |
| 자동 포함   | `scripts/` (config.scripts.includeInBackup 기준)                          |
| 로그        | `logs/` 에 실행 결과 기록                                                   |
| metadata    | `_metadata.json`을 tar.gz 내부 루트에 포함                                  |

**UI 흐름:**

```
▸ 백업 대상 스캔 중...
  ✓ ~/.zshrc                    4.0 KB
  ✓ ~/.gitconfig                  512 B
  ✓ ~/.ssh/config               1.2 KB
  ⚠ ~/.vimrc                    파일 없음, 건너뜀

▸ 압축 중... ████████████████████ 100%

✓ 백업 완료
  파일: Vincents-MBP_2025-02-11_221530.tar.gz
  크기: 12.3 KB (3개 파일 + metadata)
  위치: ~/Library/Mobile Documents/.../
```

---

### 6-3. `{APP} restore [<filename>] [--dry-run]`

| 항목          | 설명                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| 파일명 미지정 | 백업 목록을 인터랙티브 리스트로 표시, 선택                                               |
| 선택 후       | ① metadata 읽기 → ② 덮어쓰기 대상 표시 → ③ 현재 파일 자동 백업(safety) → ④ 확인 → ⑤ 복원 |
| `--dry-run`   | 실제 복원 없이 변경 예정 사항만 표시                                                     |
| Safety backup | 복원 전 현재 파일을 `_pre-restore_{datetime}.tar.gz`로 자동 백업                         |
| Hash 비교     | 동일 파일은 건너뛰고 변경분만 복원                                                       |

**UI 흐름:**

```
▸ 백업 선택
  ❯ 1  Vincents-MBP_2025-02-11_221530    12 KB   2/11 22:15
    2  Vincents-MBP_2025-02-10_180000     8 KB   2/10 18:00
    3  Vincents-MBP_2025-02-09_120000    11 KB   2/09 12:00

▸ 메타데이터 (Vincents-MBP_2025-02-11_221530)
  호스트: Vincents-MacBook-Pro
  생성:  2025-02-11 22:15:30
  파일:  3개 (12.3 KB)

▸ 복원 계획:
  덮어쓰기  ~/.zshrc        (4.1 KB → 4.0 KB, 변경됨)
  건너뜀    ~/.gitconfig    (동일)
  새로 생성  ~/.ssh/config   (현재 없음)

▸ 현재 파일을 safety 백업 중... ✓
  복원을 진행할까요? [Y/n]
```

---

### 6-4. `{APP} provision <template> [--dry-run] [--skip-restore]`

| 항목                | 설명                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| 동작                | template YAML 파싱 → step별 순차 실행 → (선택) restore                |
| `skip_if`           | 조건 명령이 exit 0이면 해당 step 건너뛰기                             |
| `continue_on_error` | `false`면 실패 시 전체 중단, `true`면 경고 후 계속                    |
| `--dry-run`         | 실행 없이 계획만 표시                                                 |
| `--skip-restore`    | template.backup이 있어도 restore 건너뛰기                             |
| 완료 후             | backup 필드 있으면 → restore 화면으로 자동 전환 (선택 없이 바로 진행) |

**UI 흐름:**

```
▸ macOS 개발환경 셋업
  새 맥북 초기 개발환경 구성

  Step 1/5  Xcode Command Line Tools
            빌드 도구 설치
            ⏭ 건너뜀 (이미 설치됨)

  Step 2/5  Homebrew
            패키지 매니저 설치
            ⏳ 실행 중...
            ✓ 완료 (32s)

  Step 3/5  CLI 도구 일괄 설치
            git, node, pnpm, starship, fzf, ripgrep
            ✓ 완료 (45s)

  Step 4/5  Oh My Zsh
            ⏭ 건너뜀 (이미 설치됨)

  Step 5/5  GUI 앱 설치
            VS Code, iTerm2 등
            ⚠ 일부 실패 (slack: already installed), 계속 진행

  ────────────────────
  결과: 3 성공 · 2 건너뜀 · 0 실패

▸ 설정파일 복원을 진행합니다...
  [restore 화면으로 전환 — template에 backup 명시됨, 선택 없이 바로 진행]
```

---

### 6-5. `{APP} list [backups | templates] [--delete <n>]`

| 항목           | 설명                                 |
| -------------- | ------------------------------------ |
| 인자 없음      | 백업·템플릿 모두 표시                |
| `backups`      | 백업만 (번호, 이름, 크기, 날짜)      |
| `templates`    | 템플릿만, 선택하면 step 목록 상세 뷰 |
| `--delete <n>` | n번 항목 삭제 (확인 프롬프트)        |
| 수정           | 불가 — 직접 파일 편집 안내           |

**Template 상세 뷰:**

```
▸ macos-dev.yml
  macOS 개발환경 셋업
  새 맥북 초기 개발환경 구성
  백업 연동: Vincents-MBP_2025-02-11_221530.tar.gz

  #   단계                          설명
  ─── ──────────────────────────── ──────────────────────
  1   Xcode Command Line Tools     빌드 도구 설치
  2   Homebrew                     패키지 매니저 설치
  3   CLI 도구 일괄 설치             git, node, pnpm ...
  4   Oh My Zsh                    —
  5   GUI 앱 설치                   VS Code, iTerm2 등
```

---

### 6-6. `{APP} status [--cleanup]`

| 항목        | 설명                       |
| ----------- | -------------------------- |
| 기본        | `~/.{APP}/` 전체 상태 요약 |
| `--cleanup` | 인터랙티브 정리 모드       |

**기본 표시:**

```
▸ {APP} 상태 — ~/.{APP}/

  항목            개수     크기
  ─────────────  ──────  ────────
  backups/        23개    980 KB
  templates/       2개      4 KB
  scripts/         5개     12 KB
  logs/           30개    156 KB
  ─────────────  ──────  ────────
  합계            60개   1.15 MB

  최근 백업: 2025-02-11 22:15 (2시간 전)
  가장 오래된 백업: 2025-01-05 (37일 전)
```

**`--cleanup` 인터랙티브:**

```
▸ 정리 옵션

  ❯ 최근 5개 백업만 유지       18개 삭제, 780 KB 확보
    30일 이전 백업 제거          8개 삭제, 320 KB 확보
    특정 백업 선택 삭제
    로그 전체 삭제              156 KB 확보
    취소
```

---

## 7. 추가 디벨롭 사항

원래 요구사항에서 아래 항목들을 추가·구체화했습니다.

| #   | 항목                      | 설명                                                       | 근거                                                 |
| --- | ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| 1   | **`--dry-run`**           | backup·restore·provision 전부 지원                         | provision처럼 시스템을 변경하는 작업에 필수 안전장치 |
| 2   | **Safety backup**         | restore 전 현재 파일을 `_pre-restore_*.tar.gz`로 자동 백업 | 복원 후 문제 발생 시 롤백 경로 확보                  |
| 3   | **파일 해시 검증**        | backup 시 SHA-256 기록, restore 시 비교                    | 동일 파일 건너뛰기, 무결성 검증                      |
| 4   | **exclude 패턴**          | `.DS_Store`, `*.swp` 등 glob으로 제외                      | 불필요한 파일이 백업에 섞이는 것 방지                |
| 5   | **`--tag`**               | backup 파일명에 커스텀 태그                                | OS 업데이트 전 `--tag pre-ventura` 같은 용도         |
| 6   | **`skip_if`**             | provisioning step의 조건부 건너뛰기                        | 기존 머신에서도 template 재실행 가능                 |
| 7   | **`continue_on_error`**   | step 실패 시 중단/계속 선택                                | brew cask처럼 일부 실패가 흔한 작업 대응             |
| 8   | **`scripts/` 자동 로드**  | .zshrc snippet으로 `scripts/*.sh` 자동 source              | 커스텀 명령어 체계적 관리 (원래 요구사항 연장)       |
| 9   | **config 스냅샷**         | metadata에 백업 당시 config 포함                           | 압축 파일 단독 의미 보장 강화                        |

---

## 8. 개발 단계

### Phase 1: 프로젝트 기반 + `init` — 3일

```
- [ ] 프로젝트 스캐폴딩 (package.json, tsconfig, tsup, ink 셋업)
- [ ] constants.ts (APP_NAME, 기본 경로)
- [ ] JSON Schema 정의 + AJV 검증 함수 (config, metadata, template)
- [ ] utils/ 모듈 (paths, system, format, logger)
- [ ] core/config.ts (config.yml CRUD + 검증)
- [ ] commands/Init.tsx (디렉토리 생성, 기본 config)
- [ ] CLI entry point 연결
- [ ] 테스트: schema 검증, config CRUD, paths 유틸리티
```

### Phase 2: `backup` — 3일

```
- [ ] core/storage.ts (tar.gz 생성·해제 래퍼)
- [ ] core/metadata.ts (시스템 정보, 파일 해시, 생성)
- [ ] core/backup.ts (파일 수집 → 검증 → 압축 → 이동)
- [ ] commands/Backup.tsx (스캔·진행률·결과 UI)
- [ ] --dry-run, --tag 옵션
- [ ] 로그 기록
- [ ] 테스트: storage 압축·해제, metadata 생성·파싱, backup 파일 수집·해시
```

### Phase 3: `restore` — 3일

```
- [ ] core/restore.ts (metadata 파싱, 해시 비교, 복원 실행)
- [ ] Safety backup 로직 (복원 전 자동 백업)
- [ ] components/SelectList.tsx (백업 선택 UI)
- [ ] commands/Restore.tsx (목록·미리보기·확인·복원 UI)
- [ ] --dry-run 옵션
- [ ] 테스트: 해시 비교, 복원 대상 판별 (동일/변경/신규), safety backup 생성
```

### Phase 4: `list` + `status` — 2일

```
- [ ] commands/List.tsx (백업·템플릿 목록, 상세 뷰, 삭제)
- [ ] commands/Status.tsx (상태 요약, cleanup 모드)
- [ ] Cleanup 유틸리티 (최근 N개 유지, 기간 제거, 선택 삭제)
- [ ] 테스트: cleanup 정책 (N개 유지, 기간 제거), 출력 형식 스냅샷
```

### Phase 5: `provision` — 3일

```
- [ ] core/provision.ts (template 파싱, step 실행, skip_if 평가)
- [ ] components/StepRunner.tsx (단계별 체크리스트 UI)
- [ ] commands/Provision.tsx (계획·실행·결과·restore 연동)
- [ ] --dry-run, --skip-restore 옵션
- [ ] 테스트: template 파싱, skip_if 평가, continue_on_error 분기, step 실행 순서
```

### Phase 6: 마무리 — 2일

```
- [ ] .zshrc snippet (scripts/ 자동 로드)
- [ ] 통합 에러 핸들링 (config 미존재, 권한, iCloud 경로 등)
- [ ] README.md
- [ ] pnpm publish 준비 (bin, shebang, package.json)
- [ ] 테스트: E2E 통합 (init → backup → restore 흐름), provision skip_if 평가
```

---

## 9. 의존성 (예상)

```jsonc
{
  "dependencies": {
    "ink": "^5.0.0",
    "ink-select-input": "^6.0.0",
    "ink-spinner": "^5.0.0",
    "react": "^18.0.0",
    "commander": "^12.0.0", // 또는 pastel
    "yaml": "^2.0.0",
    "ajv": "^8.0.0",
    "ajv-formats": "^3.0.0",
    "tar": "^7.0.0",
    "fast-glob": "^3.0.0",
    "picocolors": "^1.1.1",
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "tsup": "^8.0.0",
  },
}
```

---

## 10. 엣지 케이스 및 안전장치

| 시나리오 | 처리 방침 |
| --- | --- |
| **심볼릭 링크** | 링크 자체를 보존 (tar `--dereference` 미사용). metadata에 `type: "symlink"` 기록 |
| **다른 hostname에서 restore** | `⚠ 이 백업은 다른 머신(Vincents-MBP)에서 생성되었습니다` 경고 + 확인 프롬프트 |
| **config 스키마 변경** | metadata `version` 필드 기반 자동 마이그레이션. 미지원 버전은 에러 |
| **대용량 파일 (>10MB)** | 경고 표시 + `--force` 없으면 해당 파일 건너뜀 |
| **iCloud 동기화 중** | destination 쓰기 실패 시 재시도 (최대 3회), 실패 시 로컬 fallback 안내 |
| **권한 부족** | 복원 대상 파일의 permission을 metadata에 기록, restore 시 동일 권한 적용 시도 |
| **보안 민감 경로** | `~/.ssh/id_*`, `*.pem`, `*.key` 등 감지 시 `⚠ SENSITIVE FILE` 경고 표시 후 정상 포함. 사용자가 targets에 명시한 파일은 제외하지 않음 |
| **원격 스크립트 실행** | provision template의 `curl \| bash` 패턴 감지 시 `⚠ REMOTE SCRIPT` 경고 표시 |
