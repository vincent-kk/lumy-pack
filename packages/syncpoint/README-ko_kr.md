# Syncpoint

> 개인용 환경 관리자 — 설정파일 백업/복원 및 머신 프로비저닝 CLI

[![npm version](https://img.shields.io/npm/v/@lumy-pack/syncpoint.svg)](https://www.npmjs.com/package/@lumy-pack/syncpoint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Syncpoint는 개발 환경 설정을 관리하기 위한 강력한 CLI 도구입니다. dotfiles과 설정파일을 백업하고, 새로운 머신에서 복원하며, 자동화된 템플릿으로 시스템을 프로비저닝할 수 있습니다. 모두 내장된 안전 기능과 보안 검사를 포함하고 있습니다.

## ✨ 기능

- 🧙 **AI 기반 마법사** — Claude Code를 이용한 LLM 지원 설정 생성 및 템플릿 작성
- 📦 **설정 백업** — 메타데이터 추적을 포함한 dotfiles 및 설정파일의 압축 아카이브 생성
- 🔄 **스마트 복원** — 해시 기반 파일 비교 및 덮어쓰기 전 자동 안전 백업
- 🚀 **머신 프로비저닝** — YAML로 정의된 설치 단계를 통한 템플릿 기반 시스템 설정
- 🛡️ **보안 최우선** — 민감한 파일 감지, 심볼릭 링크 공격 방지, 원격 스크립트 차단
- 📊 **대화형 관리** — 아름다운 터미널 UI로 백업 및 템플릿 탐색
- 🎯 **유연한 패턴** — Glob/정규식 지원, 틸드 확장, 사용자 정의 파일명 플레이스홀더

## 📦 설치

**권장사항: npx로 실행 (설치 불필요)**

```bash
npx @lumy-pack/syncpoint <command>
```

또는 필요하면 전역으로 설치하세요:

```bash
# npm 사용
npm install -g @lumy-pack/syncpoint

# yarn 사용
yarn global add @lumy-pack/syncpoint
```

## 🚀 빠른 시작

### 옵션 A: 🧙 AI 기반 설정 (권장)

가장 빠르고 쉬운 시작 방법입니다. AI가 자동으로 설정파일을 생성합니다.

**요구사항:** [Claude Code CLI](https://claude.ai/code) 설치 (또는 `--print` 모드 사용)

1. **Syncpoint 초기화**

   ```bash
   npx @lumy-pack/syncpoint init
   ```

2. **AI 마법사 실행하여 설정 생성**

   ```bash
   npx @lumy-pack/syncpoint wizard
   ```

   마법사가 자동으로:
   - 홈 디렉터리에서 백업 대상 스캔
   - AI를 통해 최적화된 config.yml 생성
   - 검증 및 자동 수정 (최대 3회 재시도)

3. **첫 번째 백업 생성**

   ```bash
   npx @lumy-pack/syncpoint backup
   ```

4. **다른 머신에서 복원**

   ```bash
   npx @lumy-pack/syncpoint restore
   ```

**팁:** Claude Code가 없으면 `--print`를 사용하여 모든 LLM용 프롬프트를 얻을 수 있습니다:

```bash
npx @lumy-pack/syncpoint wizard --print
```

---

### 옵션 B: 📝 수동 설정

설정파일을 직접 편집하려면 이 방식을 사용하세요.

1. **Syncpoint 초기화**

   ```bash
   npx @lumy-pack/syncpoint init
   ```

2. **설정 편집**

   `~/.syncpoint/config.yml`을 열고 백업 대상을 사용자 정의하세요:

   ```yaml
   backup:
     targets:
       - ~/.zshrc
       - ~/.gitconfig
       - ~/.ssh/config
     exclude:
       - '**/*.swp'
     filename: '{hostname}_{datetime}'
   ```

3. **첫 번째 백업 생성**

   ```bash
   npx @lumy-pack/syncpoint backup
   ```

4. **다른 머신에서 복원**

   ```bash
   npx @lumy-pack/syncpoint restore
   ```

---

### 🎯 보너스: 프로비저닝 템플릿 생성

새로운 머신 설정을 자동화하려면:

```bash
# AI 마법사로 템플릿 생성
npx @lumy-pack/syncpoint create-template my-dev-setup

# 프로비저닝 실행
npx @lumy-pack/syncpoint provision my-dev-setup
```

## 📖 명령어

### `syncpoint init`

Syncpoint 디렉터리 구조를 초기화하고 기본 설정을 생성합니다.

**동작:**

- `~/.syncpoint/` 디렉터리 구조 생성
- 하위 디렉터리 설정: `backups/`, `templates/`, `scripts/`, `logs/`
- 기본 `config.yml` 생성
- 예제 프로비저닝 템플릿 생성

**사용법:**

```bash
npx @lumy-pack/syncpoint init
```

---

### `syncpoint wizard [options]`

홈 디렉터리를 기반으로 개인 맞춤형 `config.yml`을 생성하는 대화형 LLM 기반 마법사입니다.

**동작:**

1. 홈 디렉터리에서 일반적인 설정파일 스캔
2. 파일 분류 (셸 설정, git, SSH, 애플리케이션 설정)
3. Claude Code 호출하여 사용자 맞춤 백업 설정 생성
4. 생성된 설정 검증 및 오류 시 자동 재시도 (최대 3회)
5. 기존 설정 백업 (config.yml.bak로 저장)
6. 검증된 설정을 `~/.syncpoint/config.yml`에 작성

**옵션:**

| Option        | 설명                                                          |
| ------------- | ------------------------------------------------------------- |
| `-p, --print` | Claude Code 호출 대신 수동 LLM 사용용 프롬프트 출력           |

**사용법:**

```bash
# 대화형 마법사 (Claude Code CLI 필요)
npx @lumy-pack/syncpoint wizard

# 수동 사용용 프롬프트 출력
npx @lumy-pack/syncpoint wizard --print
```

**요구사항:**

- 기본 모드는 Claude Code CLI가 필요합니다
- Claude Code가 없으면 `--print` 모드 사용

**검증:**

- 자동 AJV 스키마 검증
- 오류 피드백을 통한 재시도 루프
- 세션 재개 시 대화 컨텍스트 보존

---

### `syncpoint create-template [name] [options]`

사용자 정의 프로비저닝 템플릿을 생성하는 대화형 LLM 기반 마법사입니다.

**동작:**

1. 프로비저닝 요구사항 정의 안내
2. Claude Code 호출하여 템플릿 YAML 생성
3. 템플릿 구조 검증 및 자동 재시도 (최대 3회)
4. 템플릿을 `~/.syncpoint/templates/`에 작성
5. 기존 템플릿 덮어쓰기 방지

**옵션:**

| Option        | 설명                                                          |
| ------------- | ------------------------------------------------------------- |
| `-p, --print` | Claude Code 호출 대신 수동 LLM 사용용 프롬프트 출력           |

**사용법:**

```bash
# 대화형 템플릿 생성 (Claude Code CLI 필요)
npx @lumy-pack/syncpoint create-template

# 특정 이름으로 생성
npx @lumy-pack/syncpoint create-template my-dev-setup

# 수동 사용용 프롬프트 출력
npx @lumy-pack/syncpoint create-template --print
```

**템플릿 필드:**

- `name` (필수) — 템플릿 이름
- `description` (선택) — 템플릿 설명
- `steps` (필수) — 프로비저닝 단계 배열
- `backup` (선택) — 프로비저닝 후 복원할 백업 이름
- `sudo` (선택) — sudo 권한 필요 여부

**단계 필드:**

- `name` (필수) — 단계 이름
- `command` (필수) — 실행할 셸 명령어
- `description` (선택) — 단계 설명
- `skip_if` (선택) — 단계 스킵 조건
- `continue_on_error` (선택) — 오류 시에도 계속 (기본값: false)

---

### `syncpoint backup [options]`

설정파일의 압축 백업 아카이브를 생성합니다.

**동작:**

1. 설정된 대상 파일 및 디렉터리 스캔
2. Glob 패턴 및 제외 규칙 적용
3. 큰 파일 (>10MB) 및 민감한 파일 (SSH 키, 인증서) 경고
4. 비교용 파일 해시 수집
5. 선택적으로 `~/.syncpoint/scripts/`의 스크립트 포함
6. 메타데이터가 포함된 압축 tar.gz 아카이브 생성

**옵션:**

| Option         | 설명                                                   |
| -------------- | ------------------------------------------------------ |
| `--dry-run`    | 아카이브 생성 없이 백업할 파일 미리보기                |
| `--tag <name>` | 백업 파일명에 사용자 정의 태그 추가                    |

**사용법:**

```bash
# 백업 생성
npx @lumy-pack/syncpoint backup

# 백업 내용 미리보기
npx @lumy-pack/syncpoint backup --dry-run

# 태그가 지정된 백업 생성
npx @lumy-pack/syncpoint backup --tag "before-upgrade"
```

**출력:**

백업은 `~/.syncpoint/backups/` (또는 사용자 정의 경로)에 설정의 파일명 패턴으로 저장됩니다. 예: `macbook-pro_2024-01-15_14-30-00.tar.gz`

---

### `syncpoint restore [filename] [options]`

백업 아카이브에서 설정파일을 복원합니다.

**동작:**

1. 사용 가능한 백업 나열 (파일명 미제공 시)
2. 파일 해시 비교를 통해 복원 계획 생성:
   - `create` — 파일이 로컬에 없음
   - `skip` — 파일이 동일 (같은 해시)
   - `overwrite` — 파일이 수정됨
3. 덮어쓸 파일의 자동 안전 백업 생성 (`_pre-restore_` 태그)
4. 파일 추출 및 원래 위치로 복원
5. 보안 공격 방지를 위한 심볼릭 링크 검증

**옵션:**

| Option      | 설명                                       |
| ----------- | ------------------------------------------ |
| `--dry-run` | 실제 복원 없이 복원 계획 표시              |

**사용법:**

```bash
# 대화형: 사용 가능한 백업에서 선택
npx @lumy-pack/syncpoint restore

# 특정 백업 복원
npx @lumy-pack/syncpoint restore macbook-pro_2024-01-15.tar.gz

# 복원 작업 미리보기
npx @lumy-pack/syncpoint restore --dry-run
```

**안전 기능:**

- 파일 덮어쓰기 전 자동 안전 백업
- 동일한 파일을 스킵하기 위한 해시 기반 비교
- 디렉터리 순회 공격 방지를 위한 심볼릭 링크 검증

---

### `syncpoint provision [template] [options]`

템플릿 기반 머신 프로비저닝을 실행하여 소프트웨어를 설치하고 시스템을 구성합니다.

**동작:**

1. `~/.syncpoint/templates/`에서 템플릿 YAML 로드 (이름으로) 또는 사용자 정의 경로 (`--file` 사용)
2. 템플릿 구조 및 보안 검증
3. sudo 요구사항 확인 (필요 시 프롬프트)
4. 실시간 진행 상황을 표시하며 단계 순차 실행
5. 단계 실행 전 `skip_if` 조건 평가
6. 명령어 출력 캡처 및 오류 처리
7. 선택적으로 프로비저닝 후 설정 백업 복원

**옵션:**

| Option              | 설명                                              |
| ------------------- | ------------------------------------------------- |
| `-f, --file <path>` | 템플릿 파일 경로 (템플릿 이름 대신 사용)         |
| `--dry-run`         | 명령어 실행 없이 실행 계획 표시                  |
| `--skip-restore`    | 프로비저닝 후 자동 설정 복원 스킵                |

**사용법:**

```bash
# 템플릿 이름으로 프로비저닝 실행
npx @lumy-pack/syncpoint provision my-setup

# 사용자 정의 경로에서 템플릿 실행
npx @lumy-pack/syncpoint provision --file ./my-template.yml

# 상대 경로에서 짧은 플래그 사용
npx @lumy-pack/syncpoint provision -f ~/templates/custom.yaml

# 템플릿 실행 미리보기
npx @lumy-pack/syncpoint provision my-setup --dry-run

# 설정 복원 없이 프로비저닝
npx @lumy-pack/syncpoint provision my-setup --skip-restore

# --file을 다른 옵션과 함께 사용
npx @lumy-pack/syncpoint provision -f ./template.yml --dry-run --skip-restore
```

**경로 해석:**

- 절대 경로 지원: `/path/to/template.yml`
- 상대 경로 지원: `./template.yml`, `../templates/setup.yaml`
- 틸드 확장 지원: `~/templates/custom.yml`
- `.yml` 또는 `.yaml` 확장자 필수

**보안:**

- 위험한 원격 스크립트 패턴 차단 (`curl | bash`, `wget | sh`)
- 민감한 경로 및 자격증명 마스킹을 위한 오류 출력 정제
- 모든 템플릿의 스키마 검증
- 단계별 5분 타임아웃

---

### `syncpoint list [type]`

백업 및 템플릿을 대화형으로 탐색하고 관리합니다.

**동작:**

- 백업 또는 템플릿을 탐색할 대화형 메뉴 표시
- 자세한 메타데이터 표시 (크기, 날짜, 파일 개수, 설명)
- 확인 후 백업 안전 삭제 가능
- 템플릿 단계 및 설정 미리보기

**사용법:**

```bash
# 대화형 메뉴
npx @lumy-pack/syncpoint list

# 직접 탐색
npx @lumy-pack/syncpoint list backups
npx @lumy-pack/syncpoint list templates
```

**네비게이션:**

- 화살표 키로 항목 선택
- Enter 키로 상세 정보 보기
- ESC 키로 뒤로가기
- 삭제 전 확인

---

### `syncpoint status [options]`

상태 요약 표시 및 `~/.syncpoint/` 디렉터리 정리를 관리합니다.

**동작:**

- 모든 하위 디렉터리 스캔 및 통계 계산
- 파일 개수 및 총 크기 표시
- 백업 타임라인 (최신 및 최오래) 표시
- 여러 전략을 제공하는 선택적 정리 모드

**옵션:**

| Option      | 설명                         |
| ----------- | ---------------------------- |
| `--cleanup` | 대화형 정리 모드 진입        |

**사용법:**

```bash
# 상태 요약 표시
npx @lumy-pack/syncpoint status

# 오래된 백업 정리
npx @lumy-pack/syncpoint status --cleanup
```

**정리 전략:**

- 가장 최근 5개의 백업만 보존
- 30일 이상 된 백업 제거
- 모든 로그 파일 삭제
- 정확한 제어를 위한 수동 선택

---

## ⚙️ 설정

Syncpoint는 설정에 `~/.syncpoint/config.yml`을 사용합니다.

### 설정 스키마

```yaml
backup:
  targets:
    - ~/.zshrc
    - ~/.zprofile
    - ~/.gitconfig
    - ~/.ssh/config
    - ~/.config/**/*.conf
  exclude:
    - '**/*.swp'
    - '**/.DS_Store'
    - '**/node_modules'
  filename: '{hostname}_{datetime}'
  destination: ~/Backups

scripts:
  includeInBackup: true
```

### 파일명 플레이스홀더

| 플레이스홀더 | 예제                  | 설명                         |
| ------------ | --------------------- | ---------------------------- |
| `{hostname}` | `macbook-pro`         | 시스템 호스트명              |
| `{date}`     | `2024-01-15`          | 현재 날짜 (YYYY-MM-DD)       |
| `{time}`     | `14-30-00`            | 현재 시간 (HH-MM-SS)         |
| `{datetime}` | `2024-01-15_14-30-00` | 날짜 및 시간 결합            |
| `{tag}`      | `before-upgrade`      | `--tag` 옵션의 사용자 정의 태그 |

### 패턴 타입

Syncpoint는 `targets` 및 `exclude` 필드에 대해 세 가지 패턴 타입을 지원합니다:

#### 리터럴 경로

직접 파일 또는 디렉터리 경로입니다. 틸드(`~`)는 자동으로 홈 디렉터리로 확장됩니다.

**예제:**

- `~/.zshrc` — 홈 디렉터리의 특정 파일
- `/etc/hosts` — 절대 경로
- `~/.ssh/config` — 중첩된 파일

#### Glob 패턴

여러 파일을 매칭하는 와일드카드 패턴입니다. 표준 glob 문법을 사용합니다.

**예제:**

- `*.conf` — 현재 디렉터리의 모든 .conf 파일
- `~/.config/*.yml` — ~/.config/의 모든 .yml 파일
- `**/*.toml` — 모든 .toml 파일 (재귀)
- `~/.config/**/*.conf` — ~/.config/ 하위의 모든 .conf 파일 (재귀)

**Glob 메타문자:** `*` (모두), `?` (단일), `{a,b}` (선택지)

#### 정규식 패턴

고급 패턴 매칭용 정규식입니다. 슬래시(`/pattern/`)로 감싸야 합니다.

**형식:** `/pattern/` (예: `/\.conf$/`)

**예제:**

- `/\.conf$/` — .conf로 끝나는 파일
- `/\.toml$/` — .toml로 끝나는 파일
- `/\.(bak|tmp)$/` — .bak 또는 .tmp로 끝나는 파일
- `/^\.config\//` — .config/로 시작하는 파일

**제한사항:**

- 정규식 대상은 홈 디렉터리(`~/`)만 스캔
- 최대 깊이: 성능을 위해 5 레벨
- 패턴 본문에 이스케이프되지 않은 슬래시 없음

**정규식 사용 시기:**

- 복잡한 확장명 매칭: `/\.(conf|toml|yaml)$/`
- 패턴 기반 제외: `/\.(bak|tmp|cache)$/`
- 경로 접두사/접미사 매칭

### 예제 설정

```yaml
backup:
  targets:
    - ~/.zshrc
    - ~/.zprofile
    - ~/.gitconfig
    - ~/.gitignore_global
    - ~/.ssh/config
    - ~/.config/starship.toml
    - ~/Documents/notes

  exclude:
    - '**/*.swp'
    - '**/*.tmp'
    - '**/.DS_Store'
    - '**/*cache*'

  filename: '{hostname}_{date}_{tag}'
  destination: ~/Dropbox/backups

scripts:
  includeInBackup: true
```

---

## 📝 프로비저닝 템플릿

템플릿은 `~/.syncpoint/templates/`에 저장된 YAML 파일로, 자동화된 프로비저닝 단계를 정의합니다.

### 템플릿 스키마

```yaml
name: string
description: string
backup: string
sudo: boolean
steps:
  - name: string
    description: string
    command: string
    skip_if: string
    continue_on_error: boolean
```

### 예제 템플릿

`~/.syncpoint/templates/dev-setup.yml`을 생성하세요:

```yaml
name: Development Setup
description: Install development tools and configure environment
sudo: true

steps:
  - name: Update System
    description: Update package manager
    command: apt-get update && apt-get upgrade -y

  - name: Install Git
    command: apt-get install -y git
    skip_if: which git

  - name: Install Node.js
    command: curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
    skip_if: which node

  - name: Install pnpm
    command: npm install -g pnpm
    skip_if: which pnpm

  - name: Configure Git
    command: |
      git config --global user.name "Your Name"
      git config --global user.email "your.email@example.com"
    continue_on_error: true

  - name: Clone Repositories
    description: Clone important repositories
    command: |
      mkdir -p ~/projects
      cd ~/projects
      git clone https://github.com/username/repo.git
```

### 템플릿 실행

```bash
npx @lumy-pack/syncpoint provision dev-setup
npx @lumy-pack/syncpoint provision --file ./my-template.yml
npx @lumy-pack/syncpoint provision dev-setup --dry-run
npx @lumy-pack/syncpoint provision dev-setup --skip-restore
npx @lumy-pack/syncpoint provision -f ~/templates/setup.yaml --dry-run
```

---

## 📁 디렉터리 구조

초기화 후 Syncpoint는 다음 구조를 생성합니다:

```
~/.syncpoint/
├── config.yml
├── backups/
│   ├── host1_2024-01-15.tar.gz
│   └── host1_2024-01-20.tar.gz
├── templates/
│   ├── example.yml
│   └── dev-setup.yml
├── scripts/
│   └── custom-script.sh
└── logs/
```

### 백업 아카이브 내용

각 백업 아카이브에는 다음이 포함됩니다:

- 상대 경로로 저장된 설정파일
- 백업 정보를 담은 `_metadata.json`:
  - 비교용 파일 해시
  - 시스템 정보 (호스트명, 플랫폼, 아키텍처)
  - 백업 생성 타임스탐프
  - 파일 개수 및 총 크기

---

## 💡 예제

### 백업 및 복원 워크플로우

**현재 머신에서:**

```bash
npx @lumy-pack/syncpoint init
vim ~/.syncpoint/config.yml

npx @lumy-pack/syncpoint backup --tag "work-setup"
```

**새로운 머신에서:**

```bash
npx @lumy-pack/syncpoint init
npx @lumy-pack/syncpoint restore
```

### 머신 프로비저닝 워크플로우

**새로운 개발 머신 설정:**

```bash
npx @lumy-pack/syncpoint init
npx @lumy-pack/syncpoint create-template my-dev-setup
npx @lumy-pack/syncpoint provision new-machine --dry-run
npx @lumy-pack/syncpoint provision new-machine
```

### 오래된 백업 정리

```bash
npx @lumy-pack/syncpoint status
npx @lumy-pack/syncpoint status --cleanup
```

---

## 🛡️ 보안 기능

### 백업 보안
- **민감한 파일 경고** — SSH 키, 인증서, 개인 키 백업 시 알림
- **큰 파일 경고** — 10MB보다 큰 파일에 대한 경고
- **파일 해싱** — 신뢰할 수 있는 파일 비교를 위한 SHA-256 해시

### 복원 보안
- **자동 안전 백업** — 파일 덮어쓰기 전 `_pre-restore_` 백업 생성
- **해시 비교** — 동일한 파일 스킵하여 불필요한 변경 방지
- **심볼릭 링크 검증** — 심볼릭 링크 공격 및 디렉터리 순회 방지
- **Dry-run 모드** — 적용 전 모든 변경사항 미리보기

### 프로비저닝 보안
- **원격 스크립트 차단** — 위험한 패턴 차단
- **오류 정제** — 오류 출력에서 민감한 정보 마스킹
- **템플릿 검증** — 모든 템플릿의 JSON 스키마 검증
- **Sudo 처리** — 필요한 경우에만 승격 프롬프트
- **명령어 타임아웃** — 단계별 5분 타임아웃으로 행(hang) 방지

### 일반 안전성
- **경로 검증** — 허용된 디렉터리 외 작업 방지
- **삭제 제한** — Syncpoint 디렉터리 내에서만 삭제 허용
- **권한 확인** — 작업 전 파일 권한 검증

---

## 🔧 문제 해결

### 마법사 명령어

**Claude Code CLI를 찾을 수 없음**

Claude Code CLI를 설치하거나 `--print` 모드를 사용하세요.

**LLM 생성 후 검증 오류**

마법사는 최대 3회까지 자동으로 재시도합니다.

**Print 모드 사용법**

```bash
npx @lumy-pack/syncpoint wizard --print > prompt.txt
```

### 일반 문제

**권한 오류** — `~/.syncpoint/`에 대한 쓰기 권한 확인
**큰 파일 경고** — 제외 패턴 사용
**백업 복원 충돌** — 먼저 `--dry-run` 사용

---

## 🔧 개발

### 빌드 및 테스트

```bash
yarn install
yarn dev
yarn build
yarn test
yarn test:all
yarn lint
yarn format
```

### 기술 스택

- **CLI 프레임워크:** Commander.js
- **터미널 UI:** Ink + React
- **설정:** YAML 파싱
- **검증:** AJV (JSON Schema)
- **파일 작업:** fast-glob, tar
- **빌드:** tsup, TypeScript
- **테스트:** Vitest

### 프로젝트 구조

```
packages/syncpoint/
├── src/
│   ├── cli.ts
│   ├── commands/
│   ├── core/
│   ├── schemas/
│   ├── components/
│   └── utils/
├── assets/
│   ├── config.default.yml
│   └── template.example.yml
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    └── docker/
```

---

## 📄 라이선스

MIT © [Vincent K. Kelvin](https://github.com/vincent-kk)

---

## 🤝 기여

기여를 환영합니다! Pull Request를 제출해 주세요.

## 🐛 이슈

문제가 발생하거나 질문이 있으면 GitHub에 [이슈를 열어주세요](https://github.com/vincent-kk/lumy-pack/issues).

---

Vincent K. Kelvin이 만들었습니다 ❤️
