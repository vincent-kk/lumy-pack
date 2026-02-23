# 04. 설치, 설정, 사용 방법

> filid 플러그인의 설치, 빌드, 설정 파일 구조, 스킬/MCP/에이전트 사용법, 트러블슈팅.

---

## 설치

### 사전 요구사항

| 요구사항    | 최소 버전 | 비고                        |
| ----------- | --------- | --------------------------- |
| Node.js     | >= 20.0.0 | `package.json` engines 명시 |
| Claude Code | 최신      | 플러그인 시스템 지원 버전   |
| npm / yarn  | -         | 의존성 설치용               |

### 의존성 설치

```bash
# 모노레포 루트에서
yarn install

# 또는 filid 패키지 디렉토리에서
cd packages/filid
npm install
```

핵심 런타임 의존성:

| 패키지                      | 용도                                       |
| --------------------------- | ------------------------------------------ |
| `typescript`                | Compiler API (AST 파싱), MCP 서버에서 사용 |
| `@modelcontextprotocol/sdk` | MCP 서버 프레임워크                        |
| `fast-glob`                 | 파일 패턴 탐색                             |
| `yaml`                      | YAML 설정 파싱                             |
| `zod`                       | 입력 스키마 검증                           |

---

## 빌드

### 플러그인 빌드 (번들링)

```bash
node build-plugin.mjs
```

이 명령은 esbuild로 두 가지 산출물을 생성:

1. **MCP 서버 번들**: `bridge/mcp-server.cjs` (~516KB, CJS)
2. **Hook 스크립트 번들**: `libs/*.mjs` (6개, ESM)

### TypeScript 컴파일 (라이브러리 빌드)

```bash
# tsconfig.build.json 기반 컴파일
tsc -p tsconfig.build.json

# 또는 전체 빌드 (컴파일 + 번들링)
yarn build  # = tsc + node build-plugin.mjs
```

### 개발 모드

```bash
yarn dev  # = tsc --watch
```

### 테스트

```bash
yarn test       # vitest (watch 모드)
yarn test:run   # 1회 실행
```

---

## 설정 파일

### `.claude-plugin/plugin.json` — 플러그인 매니페스트

```json
{
  "name": "filid",
  "version": "1.0.0",
  "description": "FCA-AI rule enforcement for Claude Code agent workflows",
  "author": { "name": "Vincent K. Kelvin" },
  "repository": "https://github.com/vincent-kk/lumy-pack",
  "license": "MIT",
  "keywords": ["claude-code", "plugin", "fca-ai", "fractal", "context"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

| 필드         | 설명                                                         |
| ------------ | ------------------------------------------------------------ |
| `skills`     | 스킬 디렉토리 경로. 하위의 `*/SKILL.md` 파일이 스킬로 등록됨 |
| `mcpServers` | MCP 서버 설정 파일 경로                                      |

### `.mcp.json` — MCP 서버 등록

```json
{
  "mcpServers": {
    "t": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/bridge/mcp-server.cjs"]
    }
  }
}
```

| 필드      | 설명                                                           |
| --------- | -------------------------------------------------------------- |
| `command` | 서버 실행 명령 (`node`)                                        |
| `args`    | 서버 번들 경로. `${CLAUDE_PLUGIN_ROOT}`는 플러그인 루트로 치환 |

### `hooks/hooks.json` — Hook 이벤트 등록

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/pre-tool-validator.mjs\"",
            "timeout": 3
          },
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/structure-guard.mjs\"",
            "timeout": 3
          }
        ]
      },
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/plan-gate.mjs\"",
            "timeout": 3
          }
        ]
      }
    ],
    "PostToolUse": [],
    "SubagentStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/agent-enforcer.mjs\"",
            "timeout": 3
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/context-injector.mjs\"",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/find-node.sh\" \"${CLAUDE_PLUGIN_ROOT}/libs/session-cleanup.mjs\"",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

| Hook 이벤트      | matcher             | 스크립트                            | timeout |
| ---------------- | ------------------- | ----------------------------------- | ------- |
| PreToolUse       | `Write\|Edit`       | pre-tool-validator, structure-guard | 3초     |
| PreToolUse       | `ExitPlanMode`      | plan-gate                           | 3초     |
| PostToolUse      | —                   | _(disabled)_                        | —       |
| SubagentStart    | `*` (모든 에이전트) | agent-enforcer                      | 3초     |
| UserPromptSubmit | `*` (모든 프롬프트) | context-injector                    | 5초     |
| SessionEnd       | `*` (모든 세션)     | session-cleanup                     | 3초     |

---

## 스킬 사용법

### /init — 프로젝트 초기화

```
/init [path]
```

| 옵션   | 기본값 | 설명          |
| ------ | ------ | ------------- |
| `path` | cwd    | 대상 디렉토리 |

**예시**:

```
/init
/init ./packages/my-app
```

**결과**: fractal 디렉토리에 CLAUDE.md 생성, organ 디렉토리 건너뜀.

### /scan — 규칙 위반 검출

```
/scan [path] [--fix]
```

| 옵션    | 기본값 | 설명                       |
| ------- | ------ | -------------------------- |
| `path`  | cwd    | 대상 디렉토리              |
| `--fix` | (없음) | 자동 수정 가능한 위반 해결 |

**예시**:

```
/scan
/scan --fix
/scan ./src --fix
```

**결과**: 위반 목록 (severity, 위치, 해결 방법 포함).

### /sync — 문서 동기화

```
/sync [--dry-run]
```

| 옵션        | 기본값 | 설명                    |
| ----------- | ------ | ----------------------- |
| `--dry-run` | (없음) | 실제 변경 없이 미리보기 |

**예시**:

```
/sync
/sync --dry-run
```

**결과**: 변경된 프랙탈의 CLAUDE.md/SPEC.md 갱신.

### /review — PR 검증 파이프라인

```
/review [--stage=1-6] [--verbose]
```

| 옵션        | 기본값 | 설명                   |
| ----------- | ------ | ---------------------- |
| `--stage`   | all    | 특정 단계만 실행 (1-6) |
| `--verbose` | (없음) | 상세 분석 포함         |

**예시**:

```
/review
/review --stage=3
/review --verbose
```

**결과**: 6단계 검증 보고서 (PASS/FAIL + 이슈 목록).

### /promote — 테스트 승격

```
/promote [path] [--days=90]
```

| 옵션     | 기본값 | 설명                |
| -------- | ------ | ------------------- |
| `path`   | cwd    | 대상 디렉토리       |
| `--days` | 90     | 최소 안정 기간 (일) |

**예시**:

```
/promote
/promote --days=60
/promote ./src/core
```

**결과**: 승격 후보 목록 + eligible 상태.

### /query — 컨텍스트 질의

```
/query <question>
```

**예시**:

```
/query fractal-tree 모듈의 역할은?
/query organ 디렉토리에서 허용되는 작업은?
```

**결과**: 3-Prompt Limit 내에서 답변. 컨텍스트 초과 시 압축 적용.

### /code-review — AI 거버넌스 코드 리뷰

```
/code-review [--scope=branch|pr|commit] [--base=ref] [--force] [--verbose]
```

| 옵션        | 기본값   | 설명                         |
| ----------- | -------- | ---------------------------- |
| `--scope`   | `branch` | 리뷰 범위 (branch/pr/commit) |
| `--base`    | `main`   | 비교 기준 ref                |
| `--force`   | (없음)   | 기존 리뷰 삭제 후 재시작     |
| `--verbose` | (없음)   | 상세 분석 포함               |

**예시**:

```
/code-review
/code-review --scope=pr --verbose
/code-review --force
```

**결과**: `.filid/review/<branch>/`에 review-report.md, fix-requests.md 생성. `--scope=pr` 시 PR 코멘트 게시.

### /resolve-review — 수정 사항 해결

```
/resolve-review
```

파라미터 없음. 현재 브랜치 자동 감지.

**예시**:

```
/resolve-review
```

**결과**: 각 fix 항목에 대해 수용/거부 선택 → 거부 시 소명 수집 → justifications.md + 부채 파일 생성.

### /re-validate — Delta 재검증

```
/re-validate
```

파라미터 없음. 현재 브랜치 자동 감지.

**예시**:

```
/re-validate
```

**결과**: PASS/FAIL 판정 → re-validate.md 생성. `gh` 인증 시 PR 코멘트 게시.

### .filid/ 디렉토리 구조

거버넌스 스킬이 사용하는 파일 시스템:

```
.filid/
├── review/<branch>/       # 브랜치별 리뷰 산출물
│   ├── session.md            # Phase A: 위원회 선출 결과
│   ├── verification.md       # Phase B: 기술 검증 결과
│   ├── review-report.md      # Phase C: 최종 리뷰 보고서
│   ├── fix-requests.md       # Phase C: 수정 요청 사항
│   ├── justifications.md     # /resolve-review: 수용/거부 결정
│   └── re-validate.md        # /re-validate: PASS/FAIL 판정
└── debt/                  # 기술 부채 (전체 공유, 커밋 대상)
    └── <debt-id>.md          # 개별 부채 항목 (YAML frontmatter)
```

- `.filid/review/` — 커밋 대상 (PR에 리뷰 이력 남김)
- `.filid/debt/` — 커밋 대상 (팀 간 부채 공유)

---

## MCP 도구 사용법

에이전트가 MCP 도구를 호출하는 JSON 입출력 예시.

### ast_analyze: 의존성 분석

```json
// 입력
{
  "source": "import { readFile } from 'fs/promises';\nexport function load() { return readFile('test'); }",
  "analysisType": "dependency-graph"
}

// 출력
{
  "imports": [{ "source": "fs/promises", "specifiers": ["readFile"], "isTypeOnly": false, "line": 1 }],
  "exports": [{ "name": "load", "isTypeOnly": false, "isDefault": false, "line": 2 }],
  "calls": [{ "callee": "readFile", "line": 2 }]
}
```

### ast_analyze: LCOM4 계산

```json
// 입력
{
  "source": "class Foo { x = 0; y = 0; getX() { return this.x; } getY() { return this.y; } }",
  "analysisType": "lcom4",
  "className": "Foo"
}

// 출력
{
  "value": 2,
  "components": [["getX"], ["getY"]],
  "methodCount": 2,
  "fieldCount": 2
}
```

### test_metrics: 의사결정 트리

```json
// 입력
{
  "action": "decide",
  "decisionInput": { "testCount": 20, "lcom4": 3, "cyclomaticComplexity": 10 }
}

// 출력
{
  "decision": {
    "action": "split",
    "reason": "LCOM4 = 3 indicates multiple responsibilities. Extract into sub-fractals along component boundaries.",
    "metrics": { "testCount": 20, "lcom4": 3, "cyclomaticComplexity": 10 }
  }
}
```

### fractal_navigate: 디렉토리 분류

```json
// 입력
{
  "action": "classify",
  "path": "/src/components",
  "entries": []
}

// 출력
{
  "classification": "organ"
}
```

### doc_compress: 가역적 압축

```json
// 입력
{
  "mode": "reversible",
  "filePath": "/src/core/fractal-tree.ts",
  "content": "...",
  "exports": ["buildFractalTree", "findNode"]
}

// 출력
{
  "compacted": "[REF] /src/core/fractal-tree.ts\n[EXPORTS] buildFractalTree, findNode\n[LINES] 129",
  "meta": { "method": "reversible", "originalLines": 129, "compressedLines": 3, "recoverable": true, "timestamp": "..." }
}
```

---

## 에이전트 사용법

`agents/` 디렉토리의 에이전트는 Claude Code의 subagent 시스템에 등록됨.

### 에이전트 호출 (Claude Code 내부)

에이전트는 Claude Code가 자동으로 인식. 사용자가 직접 호출하거나,
스킬 실행 시 자동으로 적절한 에이전트가 활성화됨.

### 에이전트 YAML Frontmatter 구조

```yaml
---
name: architect
description: 'FCA-AI Architect agent — read-only design and planning'
disallowedTools: # 선택적 — 도구 제한
  - Write
  - Edit
  - Bash
---
```

| 에이전트        | disallowedTools   | 주 용도                         |
| --------------- | ----------------- | ------------------------------- |
| architect       | Write, Edit, Bash | 설계, 분석, SPEC.md 초안 제안   |
| qa-reviewer     | Write, Edit, Bash | 규칙 검증, 메트릭 분석, PR 리뷰 |
| implementer     | (없음)            | SPEC.md 범위 내 코드 구현       |
| context-manager | (없음)            | CLAUDE.md/SPEC.md 문서 관리     |

---

## 트러블슈팅

### MCP 서버가 시작되지 않음

**증상**: 도구 호출 시 "MCP server not found" 또는 timeout.

**원인 및 해결**:

1. `bridge/mcp-server.cjs` 미존재 → `node build-plugin.mjs` 실행
2. `typescript` 미설치 → `npm install` 실행
3. Node.js 버전 < 20 → 업그레이드

### Hook이 동작하지 않음

**증상**: CLAUDE.md 100줄 초과해도 차단 안 됨.

**원인 및 해결**:

1. `scripts/*.mjs` 미존재 → `node build-plugin.mjs` 실행
2. `hooks.json` 경로 오류 → `${CLAUDE_PLUGIN_ROOT}` 변수 확인
3. 플러그인 미등록 → `.claude-plugin/plugin.json` 확인

### Hook이 timeout으로 실패

**증상**: "Hook timed out" 오류.

**원인 및 해결**:

1. 대형 파일 Write 시 stdin 처리 지연 → 정상 동작, timeout 내 처리됨
2. Node.js 초기 로딩 느림 → 콜드 스타트 문제, 재시도하면 해결

### 에이전트 역할 제한이 적용되지 않음

**증상**: architect 에이전트가 파일을 수정함.

**원인 및 해결**:

1. `agent-enforcer` 훅은 지시만 주입 → 에이전트가 무시할 수 있음
2. `agents/*.md`의 `disallowedTools` 확인 — 이것이 실제 도구 차단 메커니즘
3. 두 메커니즘이 모두 올바르게 설정되어야 함

### 빌드 실패

**증상**: `build-plugin.mjs` 실행 시 에러.

**원인 및 해결**:

1. esbuild 미설치 → `npm install` (devDependencies)
2. TypeScript 문법 에러 → `yarn typecheck` 으로 확인
3. `libs/` 또는 `scripts/` 디렉토리 권한 → `mkdir -p` 로 재생성

---

## 관련 문서

- [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) — 설정 파일의 전체 구조 내 위치
- [03-LIFECYCLE.md](./03-LIFECYCLE.md) — 각 스킬의 상세 워크플로우
- [05-COST-ANALYSIS.md](./05-COST-ANALYSIS.md) — 빌드 산출물 크기 분석
- [07-RULES-REFERENCE.md](./07-RULES-REFERENCE.md) — 스킬이 시행하는 규칙 상세
