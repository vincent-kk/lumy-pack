# Phase 4 — Hooks

## 1. Hook 시스템 개요

### 1.1 hooks.json 설정

Claude Code는 `hooks.json`에 정의된 hook 설정에 따라 특정 이벤트 발생 시 외부 프로세스를 실행한다. Holon은 세 가지 이벤트에 반응한다.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/context-injector.mjs\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/structure-guard.mjs\"",
            "timeout": 3
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/change-tracker.mjs\"",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

**설계 결정:**

- `UserPromptSubmit`은 `matcher: "*"`로 모든 프롬프트에 반응한다. timeout은 5초로 context-injector가 config 파일을 읽는 I/O 시간을 허용한다.
- `PreToolUse`와 `PostToolUse`는 `matcher: "Write|Edit"`로 파일 쓰기 작업에만 반응한다. timeout은 3초로 빠른 경로 분류 작업에 충분하다.
- filid와 달리 `SubagentStart` hook은 없다. Holon은 에이전트 동작을 강제하는 것이 아니라 구조를 안내하는 역할이기 때문이다.

### 1.2 Entry Point 패턴

모든 hook entry 파일은 동일한 stdin → JSON parse → handler → JSON stringify → stdout 패턴을 따른다.

```typescript
// 공통 패턴 (filid에서 재사용)
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
const output = handler(input);
process.stdout.write(JSON.stringify(output));
```

**핵심 원칙:**

- 모든 entry 파일은 top-level `for await` 루프로 stdin을 읽는다 (Node.js ESM 환경에서 top-level await 사용 가능).
- 핸들러 함수(`handler`)는 동기 또는 비동기 모두 가능하다. 비동기인 경우 entry 파일에서 `await`한다.
- 출력은 반드시 유효한 JSON 문자열이어야 하며, `\n` 없이 `process.stdout.write`로 단일 호출로 쓴다.
- 에러 발생 시에도 반드시 `{ continue: true }` 형태의 유효한 JSON을 출력해야 한다. 출력 실패 시 Claude Code가 hook을 오류로 처리한다.

**Hook 입력/출력 타입 (`src/types/hooks.ts`):**

```typescript
// filid에서 그대로 복사
interface HookBaseInput {
  cwd: string;
  session_id: string;
  hook_event_name: string;
}

interface PreToolUseInput extends HookBaseInput {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: {
    file_path?: string;
    path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    [key: string]: unknown;
  };
}

interface PostToolUseInput extends HookBaseInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: {
    file_path?: string;
    path?: string;
    [key: string]: unknown;
  };
  tool_response: {
    [key: string]: unknown;
  };
}

interface UserPromptSubmitInput extends HookBaseInput {
  hook_event_name: 'UserPromptSubmit';
  prompt?: string;
}

interface HookOutput {
  continue: boolean;
  hookSpecificOutput?: {
    additionalContext?: string;
  };
}
```

---

## 2. Hook 핸들러 상세

### 2.1 context-injector (UserPromptSubmit)

**역할:** 사용자가 프롬프트를 제출할 때마다 현재 프로젝트의 프랙탈 구조 규칙 요약을 에이전트의 시스템 컨텍스트에 주입한다. 에이전트가 파일을 작성하거나 디렉토리를 생성할 때 구조 원칙을 인지하도록 한다.

**주입 내용:**

에이전트 컨텍스트에 주입되는 텍스트는 세 부분으로 구성된다.

1. **현재 프로젝트 활성 규칙 요약**: `cwd`에서 `.holonrc.yml`을 로드하여 활성화된 규칙을 간결하게 나열한다. config 파일이 없으면 기본 규칙을 사용한다.
2. **카테고리 분류 기준**: `fractal`, `organ`, `pure-function`, `hybrid` 각각의 식별 기준을 한 줄씩 설명한다.
3. **최근 이격 상태**: `drift-detector`를 경량 실행하여 `critical`/`high` severity 이격이 있으면 간략히 언급한다. 이격 스캔에 실패하면 해당 섹션을 생략하고 나머지를 정상 출력한다.

**로직 흐름:**

```
cwd 수신
  → config-loader.loadConfig(cwd) 호출 (실패 시 기본 설정 사용)
  → rule-engine.getActiveRules(config) 로 활성 규칙 목록 추출
  → 규칙을 "- [ruleId]: [description]" 형식으로 포맷팅
  → (선택적) drift-detector.detectDrift(tree, config, { severity: 'high' })
     로 고위험 이격 항목 수집
  → 세 섹션을 조합하여 additionalContext 문자열 생성
  → { continue: true, hookSpecificOutput: { additionalContext } } 반환
```

**출력 예시:**

```
[Holon] Active in: /Users/vincent/project

Fractal Structure Rules:
- fractal-node-has-index: 모든 fractal 노드는 index.ts barrel export를 가져야 한다
- organ-no-claude-md: organ 디렉토리에 CLAUDE.md를 생성해서는 안 된다
- lca-dependency-rule: 공유 의존성은 LCA 노드 이하에 배치해야 한다
- module-has-main: fractal 모듈은 main.ts 진입점을 가져야 한다

Category Classification:
- fractal: 자체 index.ts와 하위 organ을 가진 독립 모듈 (예: src/features/auth/)
- organ: 단일 책임의 leaf 디렉토리 (예: components/, utils/, types/)
- pure-function: 상태 없이 입출력만 처리하는 함수 모음 (예: src/lib/math/)
- hybrid: fractal + organ 특성을 동시에 가지는 과도기적 노드

⚠ High-severity drifts detected: 2 items
- src/features/payment/utils/ — organ 내부에 중첩 디렉토리 존재 (expected: flat)
- src/shared/ — fractal 노드이지만 index.ts 없음
```

**함수 시그니처 및 로직:**

```typescript
// src/hooks/context-injector.ts

import { loadConfig } from '../core/config-loader.js';
import { getActiveRules } from '../core/rule-engine.js';
import { scanProject } from '../core/fractal-scanner.js';
import { detectDrift } from '../core/drift-detector.js';
import type { UserPromptSubmitInput, HookOutput } from '../types/hooks.js';

const CATEGORY_GUIDE = [
  '- fractal: 자체 index.ts와 하위 organ을 가진 독립 모듈 (예: src/features/auth/)',
  '- organ: 단일 책임의 leaf 디렉토리 (예: components/, utils/, types/)',
  '- pure-function: 상태 없이 입출력만 처리하는 함수 모음 (예: src/lib/math/)',
  '- hybrid: fractal + organ 특성을 동시에 가지는 과도기적 노드',
].join('\n');

export async function injectContext(input: UserPromptSubmitInput): Promise<HookOutput> {
  const cwd = input.cwd;

  // 1단계: 설정 로드 (실패 허용)
  let config;
  try {
    config = await loadConfig(cwd);
  } catch {
    config = getDefaultConfig();
  }

  // 2단계: 활성 규칙 추출 및 포맷팅
  const rules = getActiveRules(config);
  const rulesText = rules
    .map((r) => `- ${r.id}: ${r.description}`)
    .join('\n');

  // 3단계: 고위험 이격 감지 (실패 시 섹션 생략)
  let driftText = '';
  try {
    const tree = await scanProject(cwd, { config });
    const driftResult = await detectDrift(tree, config);
    const highPriority = driftResult.items.filter(
      (d) => d.severity === 'critical' || d.severity === 'high',
    );
    if (highPriority.length > 0) {
      const driftLines = highPriority
        .slice(0, 5) // 최대 5개만 표시
        .map((d) => `- ${d.path} — ${d.expected} (expected: ${d.actual})`)
        .join('\n');
      driftText =
        `\n\n⚠ High-severity drifts detected: ${highPriority.length} items\n` + driftLines;
    }
  } catch {
    // 이격 감지 실패는 조용히 무시
  }

  // 4단계: 컨텍스트 조합
  const additionalContext = [
    `[Holon] Active in: ${cwd}`,
    '',
    'Fractal Structure Rules:',
    rulesText,
    '',
    'Category Classification:',
    CATEGORY_GUIDE,
    driftText,
  ]
    .join('\n')
    .trim();

  return {
    continue: true,
    hookSpecificOutput: { additionalContext },
  };
}
```

---

### 2.2 structure-guard (PreToolUse)

**역할:** `Write` 또는 `Edit` 도구 호출이 발생하기 전에 대상 파일 경로를 검사하여 프랙탈 구조 규칙 위반 여부를 사전에 경고한다. 차단하지 않고 경고만 주입하는 것이 원칙이다 (`continue: true` 항상 반환).

**경고 조건:**

1. **organ 디렉토리에 `CLAUDE.md` 생성 시도**: 경로 세그먼트 중 organ 디렉토리명(`components`, `utils`, `types`, `hooks`, `helpers`, `lib`, `styles`, `assets`, `constants`)이 포함된 위치에 `CLAUDE.md`를 쓰려는 경우 경고한다.

2. **프랙탈 노드 밖에서 모듈 생성 시도**: `category-classifier`로 대상 파일의 부모 디렉토리를 분류했을 때 어떤 카테고리에도 해당하지 않는 미분류(`unclassified`) 경로인 경우 경고한다.

3. **순환 의존을 만들 수 있는 import 추가**: `Write`/`Edit` 도구의 `content`/`new_string`에 `import` 구문이 포함되어 있고, import 대상 경로가 현재 파일의 조상 노드를 가리키는 경우 잠재적 순환 의존 위험을 경고한다.

**로직 흐름:**

```
tool_name이 Write 또는 Edit인지 확인
  → tool_input에서 file_path 또는 path 추출
  → 빈 경로이면 { continue: true } 반환

  → [검사 1] organ 내 CLAUDE.md
    파일명이 CLAUDE.md인지 확인
    + 경로 세그먼트 중 organ 디렉토리명 포함 여부 확인
    → 위반 시 경고 메시지 추가

  → [검사 2] 미분류 경로의 모듈 생성
    category-classifier.classify(parentDir) 호출
    → 'unclassified' 반환 시 경고 메시지 추가

  → [검사 3] 잠재적 순환 의존
    content 또는 new_string에서 import 경로 추출
    각 import 경로가 현재 파일의 조상을 참조하는지 확인
    → 의심 import 발견 시 경고 메시지 추가

  → 경고가 없으면 { continue: true } 반환
  → 경고가 있으면 { continue: true, hookSpecificOutput: { additionalContext: "⚠️ Warning: ..." } } 반환
```

**함수 시그니처 및 로직:**

```typescript
// src/hooks/structure-guard.ts

import { classify } from '../core/category-classifier.js';
import type { PreToolUseInput, HookOutput } from '../types/hooks.js';
import * as path from 'node:path';

const ORGAN_DIR_NAMES = new Set([
  'components', 'utils', 'types', 'hooks', 'helpers',
  'lib', 'styles', 'assets', 'constants',
]);

function extractImportPaths(content: string): string[] {
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function isAncestorPath(filePath: string, importPath: string, cwd: string): boolean {
  // 상대 경로 import만 검사 (절대 경로 및 패키지 import 제외)
  if (!importPath.startsWith('.')) return false;
  const fileDir = path.dirname(path.resolve(cwd, filePath));
  const resolvedImport = path.resolve(fileDir, importPath);
  const fileAbsolute = path.resolve(cwd, filePath);
  // import 대상이 현재 파일의 부모 디렉토리를 참조하는지 확인
  return fileAbsolute.startsWith(resolvedImport + path.sep);
}

export function guardStructure(input: PreToolUseInput, cwd: string): HookOutput {
  const toolName = input.tool_name;
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return { continue: true };
  }

  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';
  if (!filePath) {
    return { continue: true };
  }

  const warnings: string[] = [];
  const segments = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] ?? '';

  // 검사 1: organ 디렉토리 내 CLAUDE.md
  if (fileName === 'CLAUDE.md') {
    const parentSegments = segments.slice(0, -1);
    const organSegment = parentSegments.find((s) => ORGAN_DIR_NAMES.has(s));
    if (organSegment) {
      warnings.push(
        `organ 디렉토리 "${organSegment}" 내에 CLAUDE.md를 생성하려 합니다. ` +
          `Organ 디렉토리는 leaf-level 구획으로 자체 CLAUDE.md를 가져서는 안 됩니다.`,
      );
    }
  }

  // 검사 2: 미분류 경로의 모듈 생성
  const parentDir = path.dirname(path.resolve(cwd, filePath));
  try {
    const category = classify(parentDir, cwd);
    if (category === 'unclassified') {
      warnings.push(
        `대상 경로 "${path.dirname(filePath)}"가 어떤 프랙탈 카테고리에도 속하지 않습니다. ` +
          `새 모듈은 fractal 또는 organ 노드 내에 배치해야 합니다.`,
      );
    }
  } catch {
    // 분류 실패는 무시
  }

  // 검사 3: 잠재적 순환 의존
  const content = input.tool_input.content ?? input.tool_input.new_string ?? '';
  if (content) {
    const importPaths = extractImportPaths(content);
    const circularCandidates = importPaths.filter((p) => isAncestorPath(filePath, p, cwd));
    if (circularCandidates.length > 0) {
      warnings.push(
        `다음 import가 현재 파일의 조상 모듈을 참조합니다 (순환 의존 위험): ` +
          circularCandidates.map((p) => `"${p}"`).join(', '),
      );
    }
  }

  if (warnings.length === 0) {
    return { continue: true };
  }

  const additionalContext =
    `⚠️ Warning from Holon structure-guard:\n` +
    warnings.map((w, i) => `${i + 1}. ${w}`).join('\n');

  return {
    continue: true,
    hookSpecificOutput: { additionalContext },
  };
}
```

**설계 결정 — 차단하지 않고 경고만:**

PLAN.md의 요구사항과 달리, structure-guard는 `continue: false`를 반환하지 않는다. filid의 `pre-tool-validator`와 `organ-guard`는 명확한 규칙 위반(CLAUDE.md 라인 수 초과)을 차단하지만, holon의 구조 규칙은 더 유연하게 적용되어야 한다. 프랙탈 구조 전환 과정에서 일시적으로 규칙에서 벗어난 파일이 존재할 수 있으며, 에이전트가 판단하여 결정해야 하는 상황이 많다. 경고를 통해 인지시키되 작업을 방해하지 않는다.

---

### 2.3 change-tracker (PostToolUse)

**역할:** `Write` 또는 `Edit` 도구 실행 후 변경된 파일 경로와 해당 경로의 프랙탈 카테고리를 추적 태그로 기록한다. 나중에 drift 분석이나 감사 로그로 활용할 수 있다.

**추적 태그 형식:**

```
[holon:change] <timestamp> <action> <path> <category>
```

예시:

```
[holon:change] 2026-02-22T10:30:00.000Z Write src/features/auth/components/LoginForm.tsx organ
[holon:change] 2026-02-22T10:31:15.123Z Edit src/features/auth/index.ts fractal
```

**로직 흐름:**

```
tool_name이 Write 또는 Edit인지 확인
  → tool_input에서 file_path 또는 path 추출
  → 빈 경로이면 { continue: true } 반환

  → category-classifier.classify(filePath, cwd) 로 카테고리 판별
    (실패 시 'unknown' 사용)

  → timestamp: new Date().toISOString()
  → 추적 태그 문자열 생성:
    "[holon:change] {timestamp} {toolName} {filePath} {category}"

  → { continue: true } 반환
    (additionalContext 없이 로깅 목적으로만 사용)
    단, 디버그 모드(HOLON_DEBUG=1 환경변수)이면
    additionalContext에 태그를 포함하여 에이전트가 볼 수 있도록 한다
```

**추적 로그 저장:**

추적 태그는 `{cwd}/.holon/change-log.jsonl`에 JSON Lines 형식으로 저장된다. 파일이 없으면 생성하고, 있으면 append한다.

```typescript
interface ChangeLogEntry {
  timestamp: string;
  action: string;         // 'Write' | 'Edit'
  path: string;
  category: string;       // CategoryType | 'unknown'
  sessionId: string;
}
```

**함수 시그니처 및 로직:**

```typescript
// src/hooks/change-tracker.ts

import { classify } from '../core/category-classifier.js';
import type { PostToolUseInput, HookOutput } from '../types/hooks.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ChangeLogEntry {
  timestamp: string;
  action: string;
  path: string;
  category: string;
  sessionId: string;
}

function appendChangeLog(cwd: string, entry: ChangeLogEntry): void {
  try {
    const logDir = path.join(cwd, '.holon');
    const logFile = path.join(logDir, 'change-log.jsonl');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // 로그 쓰기 실패는 조용히 무시 (hook 실패로 이어지지 않도록)
  }
}

export function trackChange(input: PostToolUseInput): HookOutput {
  const toolName = input.tool_name;
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return { continue: true };
  }

  const filePath = input.tool_input.file_path ?? input.tool_input.path ?? '';
  if (!filePath) {
    return { continue: true };
  }

  const cwd = input.cwd;

  // 카테고리 판별 (실패 시 'unknown')
  let category = 'unknown';
  try {
    category = classify(filePath, cwd);
  } catch {
    // 무시
  }

  const timestamp = new Date().toISOString();
  const entry: ChangeLogEntry = {
    timestamp,
    action: toolName,
    path: filePath,
    category,
    sessionId: input.session_id,
  };

  // 로그 파일에 기록
  appendChangeLog(cwd, entry);

  // 추적 태그 생성 (HOLON_DEBUG=1이면 에이전트 컨텍스트에도 포함)
  const tag = `[holon:change] ${timestamp} ${toolName} ${filePath} ${category}`;

  if (process.env['HOLON_DEBUG'] === '1') {
    return {
      continue: true,
      hookSpecificOutput: { additionalContext: tag },
    };
  }

  return { continue: true };
}
```

**설계 결정 — `additionalContext` 미포함:**

change-tracker는 기본적으로 `additionalContext`를 주입하지 않는다. 모든 Write/Edit 작업 후 에이전트 컨텍스트에 추적 태그가 삽입되면 컨텍스트 윈도우가 불필요하게 소모된다. 추적 데이터는 `.holon/change-log.jsonl`에 기록되어 에이전트 외부에서 분석 용도로 활용한다. 디버그 모드(`HOLON_DEBUG=1`)에서만 에이전트 컨텍스트에 태그를 포함한다.

---

## 3. Entry Point 코드 설계

### 3.1 context-injector.entry.ts

```typescript
// src/hooks/entries/context-injector.entry.ts

import { injectContext } from '../context-injector.js';
import type { UserPromptSubmitInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as UserPromptSubmitInput;

let result;
try {
  result = await injectContext(input);
} catch {
  result = { continue: true };
}

process.stdout.write(JSON.stringify(result));
```

**비고:** `injectContext`는 `async` 함수이므로 entry 파일에서 `await`한다. 예외 발생 시에도 `{ continue: true }`를 반환하여 hook 실패로 인한 Claude Code 중단을 방지한다.

---

### 3.2 structure-guard.entry.ts

```typescript
// src/hooks/entries/structure-guard.entry.ts

import { guardStructure } from '../structure-guard.js';
import type { PreToolUseInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as PreToolUseInput;

let result;
try {
  result = guardStructure(input, input.cwd);
} catch {
  result = { continue: true };
}

process.stdout.write(JSON.stringify(result));
```

**비고:** `guardStructure`는 동기 함수다. `cwd`는 `input.cwd`에서 직접 읽는다. `category-classifier.classify`가 실패해도 예외를 잡아 `{ continue: true }`를 반환하므로 구조 분류 오류가 hook 전체 실패로 이어지지 않는다.

---

### 3.3 change-tracker.entry.ts

```typescript
// src/hooks/entries/change-tracker.entry.ts

import { trackChange } from '../change-tracker.js';
import type { PostToolUseInput } from '../../types/hooks.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as PostToolUseInput;

let result;
try {
  result = trackChange(input);
} catch {
  result = { continue: true };
}

process.stdout.write(JSON.stringify(result));
```

**비고:** `trackChange`는 동기 함수다. 파일 시스템 쓰기(`appendChangeLog`)가 실패해도 함수 내부에서 예외를 잡아 처리하므로 entry 파일의 try/catch는 최후의 안전망 역할만 한다.

---

## 4. 빌드 설정

각 hook entry 파일은 esbuild로 개별 `.mjs` 파일로 번들링된다. `build-plugin.mjs`에서 처리한다.

```javascript
// build-plugin.mjs — Hook 번들 설정 부분
const hookEntries = [
  { entry: 'src/hooks/entries/context-injector.entry.ts', out: 'scripts/context-injector.mjs' },
  { entry: 'src/hooks/entries/structure-guard.entry.ts',  out: 'scripts/structure-guard.mjs' },
  { entry: 'src/hooks/entries/change-tracker.entry.ts',   out: 'scripts/change-tracker.mjs' },
];

for (const { entry, out } of hookEntries) {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: out,
    banner: { js: '#!/usr/bin/env node' },
    external: [],  // 완전 번들
  });
}
```

**산출물:**

```
scripts/
├── context-injector.mjs    # UserPromptSubmit hook
├── structure-guard.mjs     # PreToolUse hook
└── change-tracker.mjs      # PostToolUse hook
```

---

## 5. 테스트 전략

### hooks/ 테스트 케이스

각 hook은 stdin/stdout JSON 직렬화 테스트와 핸들러 로직 단위 테스트로 나뉜다.

**context-injector.test.ts:**

```typescript
// 핵심 케이스
- injectContext: config 로드 성공 시 규칙 요약 포함 여부
- injectContext: config 파일 없을 때 기본 설정으로 폴백
- injectContext: drift 감지 실패 시에도 continue: true 반환
- injectContext: 반환값이 { continue: true, hookSpecificOutput: { additionalContext: string } } 구조인지 확인
- injectContext: additionalContext에 "[Holon] Active in:" 헤더 포함 확인
```

**structure-guard.test.ts:**

```typescript
// 핵심 케이스
- guardStructure: Write 아닌 도구 → { continue: true } (조기 반환)
- guardStructure: organ 디렉토리 내 CLAUDE.md 쓰기 → 경고 포함, continue: true
- guardStructure: 루트 CLAUDE.md 쓰기 → 경고 없음, continue: true
- guardStructure: 미분류 경로 → 경고 포함, continue: true
- guardStructure: 순환 import 포함 content → 경고 포함, continue: true
- guardStructure: 정상 경로의 정상 파일 → { continue: true, hookSpecificOutput 없음 }
```

**change-tracker.test.ts:**

```typescript
// 핵심 케이스
- trackChange: Write 아닌 도구 → { continue: true }
- trackChange: Write 도구, 정상 경로 → { continue: true } (additionalContext 없음)
- trackChange: Write 도구, HOLON_DEBUG=1 → additionalContext에 [holon:change] 태그 포함
- trackChange: change-log.jsonl에 올바른 JSON Lines 항목 기록 확인
- trackChange: 파일 시스템 쓰기 실패 시에도 { continue: true } 반환
```
