# Phase 1: Foundation — 설정 파일 및 타입 시스템

holon 플러그인의 기반 구조를 정의한다. 모든 설정 파일의 완전한 내용과 TypeScript 타입 시스템을 포함한다.

---

## 1. package.json

```json
{
  "name": "@lumy-pack/holon",
  "version": "0.0.1",
  "description": "Fractal structure management plugin for Claude Code",
  "keywords": [
    "claude-code",
    "plugin",
    "holon",
    "fractal",
    "structure"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/vincent-kk/lumy-pack.git",
    "directory": "packages/holon"
  },
  "license": "MIT",
  "author": {
    "name": "Vincent K. Kelvin",
    "email": "lunox273@gmail.com"
  },
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "agents",
    "libs",
    "hooks",
    "skills",
    "scripts",
    ".claude-plugin",
    ".mcp.json",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.build.json && node build-plugin.mjs",
    "build:plugin": "node build-plugin.mjs",
    "dev": "tsc --watch",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "fast-glob": "^3.0.0",
    "micromatch": "^4.0.8",
    "typescript": "^5.7.2",
    "yaml": "^2.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/micromatch": "^4.0.9",
    "@types/node": "^20.11.0",
    "@vitest/coverage-v8": "^3.2.4",
    "esbuild": "^0.24.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**filid 대비 차이점:**
- `micromatch` 추가: glob 패턴 기반 디렉토리 분류 및 exclude 패턴 매칭에 사용
- `@types/micromatch` devDependency 추가
- keywords: `fca-ai`, `context-architecture` → `holon`, `structure`

---

## 2. tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": [
      "node"
    ]
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

**설명:**
- monorepo 루트의 `tsconfig.base.json` 상속 (strict, ESM, Node 20 target)
- 테스트 파일(`src/**/__tests__/**`)을 포함하여 IDE 타입 지원 제공
- `dist` 출력 디렉토리는 제외

---

## 3. tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "emitDeclarationOnly": true,
    "declarationDir": "./dist"
  },
  "exclude": [
    "node_modules",
    "dist",
    "src/**/__tests__/**"
  ]
}
```

**설명:**
- `tsconfig.json` 상속
- 빌드 시 declaration 파일(`.d.ts`)만 생성 — 실제 JS 번들은 `build-plugin.mjs`(esbuild)가 담당
- 테스트 파일 제외하여 배포용 타입만 생성

---

## 4. vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['**/fixtures/**'],
    globals: true,
  },
});
```

**설명:**
- 테스트 파일 위치: `src/**/__tests__/**/*.test.ts`
- fixtures 디렉토리는 테스트 대상에서 제외
- `globals: true`로 `describe`, `it`, `expect` 전역 사용 가능

---

## 5. .claude-plugin/plugin.json

```json
{
  "name": "holon",
  "version": "0.0.1",
  "description": "Fractal structure management plugin for Claude Code agent workflows",
  "author": {
    "name": "Vincent K. Kelvin"
  },
  "repository": "https://github.com/vincent-kk/lumy-pack",
  "license": "MIT",
  "keywords": [
    "claude-code",
    "plugin",
    "holon",
    "fractal",
    "structure"
  ],
  "skills": "./skills/",
  "agents": "./agents/",
  "mcpServers": "./.mcp.json"
}
```

**설명:**
- Claude Code 플러그인 메타데이터
- `skills/`: Auto Guide, Restructure, Sync 스킬 디렉토리
- `agents/`: 3개 에이전트 정의 디렉토리
- `mcpServers`: MCP 서버 설정 파일 경로

---

## 6. .mcp.json

```json
{
  "mcpServers": {
    "holon": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/libs/server.cjs"]
    }
  }
}
```

**설명:**
- MCP 서버 이름: `holon` (filid는 `filid`)
- `${CLAUDE_PLUGIN_ROOT}`: Claude Code가 플러그인 설치 경로로 치환하는 변수
- `libs/server.cjs`: esbuild로 번들된 단일 CJS 파일 (Node 호환성 최대화)

---

## 7. hooks/hooks.json

```json
{
  "hooks": {
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
    ],
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
    ]
  }
}
```

**Hook 역할:**

| Hook | Matcher | Script | 역할 |
|------|---------|--------|------|
| `PreToolUse` | `Write\|Edit` | `structure-guard.mjs` | 파일 쓰기/편집 전 프랙탈 구조 규칙 검증. 위반 시 중단 |
| `PostToolUse` | `Write\|Edit` | `change-tracker.mjs` | 파일 변경 후 구조 변화 추적 및 이격(drift) 누적 |
| `UserPromptSubmit` | `*` | `context-injector.mjs` | 모든 프롬프트에 현재 프랙탈 구조 컨텍스트 주입 |

---

## 8. build-plugin.mjs

```javascript
/**
 * holon 플러그인 통합 빌드 스크립트.
 *
 * MCP 서버와 Hook 스크립트를 독립적인 단일 파일로 번들링한다.
 * git clone 후 별도 tsc 빌드 없이 플러그인이 동작하도록 한다.
 *
 * Outputs:
 *   libs/server.cjs          — MCP 서버 (CJS, 단일 파일)
 *   scripts/<name>.mjs       — Hook 스크립트 (ESM, 독립 실행 가능)
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 출력 디렉토리 생성
mkdirSync(resolve(__dirname, 'libs'), { recursive: true });
mkdirSync(resolve(__dirname, 'scripts'), { recursive: true });

// 1. MCP 서버 번들 (CJS — 광범위한 Node 호환성)
await build({
  entryPoints: [resolve(__dirname, 'src/mcp/server-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: resolve(__dirname, 'libs/server.cjs'),
  external: ['typescript'],
  minify: false,
  sourcemap: false,
});

console.log('  MCP server  -> libs/server.cjs');

// 2. Hook 스크립트 번들 (ESM, 독립 실행)
// holon은 3개 hook: structure-guard, change-tracker, context-injector
const hookEntries = [
  'structure-guard',
  'change-tracker',
  'context-injector',
];

await Promise.all(
  hookEntries.map((name) =>
    build({
      entryPoints: [resolve(__dirname, `src/hooks/entries/${name}.entry.ts`)],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      outfile: resolve(__dirname, `scripts/${name}.mjs`),
      external: [],
      minify: false,
      sourcemap: false,
    }),
  ),
);

console.log(`  Hook scripts (${hookEntries.length}) -> scripts/*.mjs`);
console.log('Plugin build complete.');
```

**filid 대비 차이점:**
- `hookEntries`: filid의 5개(`pre-tool-validator`, `organ-guard`, `change-tracker`, `agent-enforcer`, `context-injector`) → holon의 3개(`structure-guard`, `change-tracker`, `context-injector`)
- holon은 `SubagentStart` hook 미사용 (구조 관리에 집중)

---

## 9. src/types/ — 타입 정의 파일

### 9.1 src/types/fractal.ts

프랙탈 구조 트리의 핵심 데이터 모델. 디렉토리를 프랙탈 노드로 표현한다.

```typescript
/**
 * @file fractal.ts
 * @description 프랙탈 구조 트리의 핵심 데이터 모델 정의.
 *
 * FractalTree는 프로젝트 디렉토리를 계층적 노드 그래프로 표현하며,
 * 각 노드(FractalNode)는 자신의 분류 타입(CategoryType)과 부모/자식 관계를 보유한다.
 */

/**
 * 디렉토리의 프랙탈 분류 타입.
 *
 * - `fractal`: 하위 프랙탈 노드를 포함하는 복합 단위. 자체 index.ts를 가질 수 있다.
 * - `organ`: 특정 역할에 특화된 단말 디렉토리 (e.g., `hooks/`, `utils/`, `types/`).
 *            CLAUDE.md를 포함하지 않는다.
 * - `pure-function`: 단일 책임 함수/유틸리티 모음. 외부 의존이 없어야 한다.
 * - `hybrid`: fractal과 organ의 특성을 모두 갖는 과도기적 형태. 리팩토링 대상.
 */
export type CategoryType = 'fractal' | 'organ' | 'pure-function' | 'hybrid';

/**
 * 프랙탈 트리의 단일 노드. 하나의 디렉토리를 표현한다.
 */
export interface FractalNode {
  /** 프로젝트 루트 기준 절대 경로 */
  path: string;

  /** 디렉토리명 (경로의 마지막 segment) */
  name: string;

  /** 이 노드의 프랙탈 분류 */
  category: CategoryType;

  /** 부모 노드의 path. 루트 노드이면 null */
  parent: string | null;

  /** 직접 자식 fractal 노드들의 path 배열 */
  children: string[];

  /** 직접 자식 organ 노드들의 path 배열 */
  organs: string[];

  /** 루트로부터의 깊이. 루트는 0 */
  depth: number;

  /** 해당 디렉토리에 index.ts 또는 index.js가 존재하는지 여부 */
  hasIndex: boolean;

  /** 해당 디렉토리에 main.ts 또는 main.js가 존재하는지 여부 */
  hasMain: boolean;

  /** 확장 메타데이터 (CLAUDE.md 존재 여부, 파일 수 등) */
  metadata: Record<string, unknown>;
}

/**
 * 프로젝트 전체의 프랙탈 구조 트리.
 * 모든 노드를 path → FractalNode 맵으로 관리한다.
 */
export interface FractalTree {
  /** 프로젝트 루트 디렉토리의 절대 경로 */
  root: string;

  /** path → FractalNode 매핑. 모든 스캔된 노드를 포함한다 */
  nodes: Map<string, FractalNode>;

  /** 트리의 최대 깊이 (루트 = 0) */
  depth: number;

  /** 총 노드 수 (루트 포함) */
  totalNodes: number;
}

/**
 * 디렉토리 항목 정보. 스캔 과정에서 내부적으로 사용한다.
 */
export interface DirEntry {
  /** 절대 경로 */
  path: string;

  /** 파일명 또는 디렉토리명 */
  name: string;

  /** 디렉토리 여부 */
  isDirectory: boolean;

  /** 파일 여부 */
  isFile: boolean;
}

/**
 * 개별 모듈의 정적 분석 정보.
 * index-analyzer 및 module-main-analyzer가 생성한다.
 */
export interface ModuleInfo {
  /** 모듈 디렉토리의 절대 경로 */
  path: string;

  /** 모듈명 (디렉토리명) */
  name: string;

  /** 모듈의 진입점 파일 경로. 없으면 null */
  entryPoint: string | null;

  /** 이 모듈이 외부에 공개하는 export 식별자 목록 */
  exports: string[];

  /** 이 모듈이 사용하는 import 경로 목록 */
  imports: string[];

  /** 해석된 의존 모듈의 path 목록 */
  dependencies: string[];
}

/**
 * export 항목 하나의 정보. index-analyzer 내부에서 사용한다.
 */
export interface ExportInfo {
  /** export 식별자 이름 */
  name: string;

  /** export 종류 */
  kind: 'named' | 'default' | 'type' | 're-export';

  /** re-export인 경우 원본 소스 경로 */
  source?: string;
}

/**
 * index.ts의 barrel 패턴 분석 결과.
 */
export interface BarrelPattern {
  /** 순수 re-export만으로 구성된 barrel인지 여부 */
  isPureBarrel: boolean;

  /** re-export 항목 수 */
  reExportCount: number;

  /** 직접 정의(declaration) 항목 수 */
  declarationCount: number;

  /** 누락된 하위 모듈 export 목록 */
  missingExports: string[];
}

/**
 * 모듈의 공개 API 명세. module-main-analyzer가 생성한다.
 */
export interface PublicApi {
  /** export 항목 전체 목록 */
  exports: ExportInfo[];

  /** 외부에 노출되는 타입 이름 목록 */
  types: string[];

  /** 외부에 노출되는 함수 이름 목록 */
  functions: string[];

  /** 외부에 노출되는 클래스 이름 목록 */
  classes: string[];
}
```

---

### 9.2 src/types/rules.ts

규칙 엔진의 규칙 정의 및 평가 결과 타입.

```typescript
/**
 * @file rules.ts
 * @description rule-engine의 규칙 정의 및 평가 결과 타입.
 *
 * Rule은 순수 함수 `check`를 통해 RuleViolation[] 을 반환하는 구조이다.
 * 규칙은 built-in과 custom으로 나뉘며, config를 통해 on/off 및 severity 조정이 가능하다.
 */

import type { FractalNode, FractalTree } from './fractal.js';
import type { HolonConfig } from './config.js';

/**
 * 규칙 위반의 심각도 수준.
 *
 * - `error`: 즉시 수정이 필요한 구조적 위반. 빌드/CI를 블로킹할 수 있다.
 * - `warning`: 권장 패턴에서 벗어남. 기능은 동작하나 개선이 필요하다.
 * - `info`: 정보성 제안. 선택적 개선 사항.
 */
export type RuleSeverity = 'error' | 'warning' | 'info';

/**
 * 규칙이 다루는 관심 영역 분류.
 *
 * - `naming`: 파일/디렉토리 이름 규칙
 * - `structure`: 프랙탈 구조 계층 규칙
 * - `dependency`: 모듈 간 의존 관계 규칙
 * - `documentation`: CLAUDE.md 등 문서화 규칙
 * - `index`: index.ts barrel 패턴 규칙
 * - `module`: 진입점 및 public API 규칙
 */
export type RuleCategory = 'naming' | 'structure' | 'dependency' | 'documentation' | 'index' | 'module';

/**
 * 단일 규칙의 검사 컨텍스트. `Rule.check` 함수에 전달된다.
 */
export interface RuleContext {
  /** 현재 검사 중인 프랙탈 노드 */
  node: FractalNode;

  /** 프로젝트 전체 트리 (다른 노드 참조 가능) */
  tree: FractalTree;

  /** 현재 적용 중인 설정 */
  config: HolonConfig;
}

/**
 * 규칙 위반 항목 하나. `Rule.check`의 반환 배열 원소.
 */
export interface RuleViolation {
  /** 위반한 규칙의 고유 ID (e.g., "naming-convention", "organ-no-claudemd") */
  ruleId: string;

  /** 위반 심각도 (규칙 기본값이나 config 오버라이드 적용 후) */
  severity: RuleSeverity;

  /** 사람이 읽을 수 있는 위반 설명 */
  message: string;

  /** 위반이 발생한 경로 */
  path: string;

  /** 수정 방법 제안 (선택적) */
  suggestion?: string;
}

/**
 * 단일 규칙 정의.
 * `check` 함수는 순수 함수여야 하며 부작용이 없어야 한다.
 */
export interface Rule {
  /** 규칙의 고유 식별자 (kebab-case). e.g., "naming-convention" */
  id: string;

  /** 규칙의 표시 이름 */
  name: string;

  /** 규칙이 검사하는 내용에 대한 설명 */
  description: string;

  /** 규칙의 관심 영역 */
  category: RuleCategory;

  /** 규칙의 기본 심각도 */
  severity: RuleSeverity;

  /** 규칙 활성화 여부 (config로 오버라이드 가능) */
  enabled: boolean;

  /**
   * 규칙 검사 함수.
   * @param context - 검사 대상 노드와 트리 컨텍스트
   * @returns 위반 항목 배열. 위반이 없으면 빈 배열 반환
   */
  check: (context: RuleContext) => RuleViolation[];
}

/**
 * 규칙 집합. built-in 규칙과 custom 규칙을 묶어 관리한다.
 */
export interface RuleSet {
  /** 규칙 집합 식별자 */
  id: string;

  /** 규칙 집합 표시 이름 */
  name: string;

  /** 이 집합에 속한 규칙 목록 */
  rules: Rule[];
}

/**
 * 전체 규칙 평가 실행 결과.
 * `rule-engine`의 `evaluateRules` 함수가 반환한다.
 */
export interface RuleEvaluationResult {
  /** 발생한 모든 위반 항목 */
  violations: RuleViolation[];

  /** 위반 없이 통과한 규칙 검사 수 */
  passed: number;

  /** 위반이 발생한 규칙 검사 수 */
  failed: number;

  /** 비활성화되어 건너뛴 규칙 수 */
  skipped: number;

  /** 전체 평가 소요 시간 (밀리초) */
  duration: number;
}

/**
 * 내장 규칙 ID 열거형. 상수로 관리하여 오타를 방지한다.
 */
export const BUILTIN_RULE_IDS = {
  /** 디렉토리/파일 이름이 kebab-case를 따르는지 검사 */
  NAMING_CONVENTION: 'naming-convention',

  /** organ 디렉토리가 CLAUDE.md를 포함하지 않는지 검사 */
  ORGAN_NO_CLAUDEMD: 'organ-no-claudemd',

  /** fractal 노드의 index.ts가 barrel 패턴을 따르는지 검사 */
  INDEX_BARREL_PATTERN: 'index-barrel-pattern',

  /** 모듈에 명확한 진입점(index.ts 또는 main.ts)이 존재하는지 검사 */
  MODULE_ENTRY_POINT: 'module-entry-point',

  /** 프랙탈 트리의 최대 깊이를 초과하지 않는지 검사 */
  MAX_DEPTH: 'max-depth',

  /** 모듈 간 순환 의존(circular dependency)이 없는지 검사 */
  CIRCULAR_DEPENDENCY: 'circular-dependency',

  /** pure-function 모듈이 외부 fractal 모듈에 의존하지 않는지 검사 */
  PURE_FUNCTION_ISOLATION: 'pure-function-isolation',
} as const;

export type BuiltinRuleId = (typeof BUILTIN_RULE_IDS)[keyof typeof BUILTIN_RULE_IDS];
```

---

### 9.3 src/types/config.ts

holon 설정 스키마 및 병합 전략 타입.

```typescript
/**
 * @file config.ts
 * @description holon 설정 시스템의 타입 및 Zod 스키마 정의.
 *
 * 설정은 4단계 우선순위로 병합된다:
 * default → project (.holonrc.yml) → user (~/.holonrc.yml) → cli (인자)
 *
 * Zod 스키마는 런타임 검증에 사용되며, TypeScript 타입은 스키마에서 파생된다.
 */

import { z } from 'zod';
import type { RuleSeverity, Rule } from './rules.js';
import type { CategoryType } from './fractal.js';

/**
 * 설정 소스의 우선순위 계층.
 *
 * - `default`: 코드에 하드코딩된 기본값. 항상 존재한다.
 * - `project`: 프로젝트 루트의 `.holonrc.yml`. 팀 공유 설정.
 * - `user`: `~/.holonrc.yml`. 개인 선호 설정.
 * - `cli`: CLI 인자로 전달된 설정. 최고 우선순위.
 */
export type ConfigSource = 'default' | 'project' | 'user' | 'cli';

/**
 * 설정 병합 전략.
 *
 * - `override`: 상위 소스가 하위 소스를 완전히 덮어쓴다.
 * - `merge`: 객체는 깊은 병합, 배열은 concatenate.
 * - `replace`: 배열 전체를 교체 (concatenate하지 않음).
 */
export type MergeStrategy = 'override' | 'merge' | 'replace';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

/**
 * 규칙 설정 Zod 스키마.
 */
export const RuleConfigSchema = z.object({
  /** 규칙 ID → 활성화 여부 맵. true이면 활성, false이면 비활성 */
  enabled: z.record(z.string(), z.boolean()).default({}),

  /** 규칙 ID → severity 오버라이드 맵 */
  severity: z
    .record(z.string(), z.enum(['error', 'warning', 'info']))
    .default({}),

  /** 사용자 정의 커스텀 규칙 목록 (런타임 검증 불가하여 unknown으로 처리) */
  custom: z.array(z.unknown()).default([]),
});

/**
 * 카테고리 분류 설정 Zod 스키마.
 */
export const CategoryConfigSchema = z.object({
  /**
   * organ으로 분류할 디렉토리 이름 목록.
   * 기본값: ['hooks', 'utils', 'types', 'constants', 'assets', 'styles', 'scripts', 'tests', '__tests__']
   */
  organNames: z.array(z.string()).default([
    'hooks',
    'utils',
    'types',
    'constants',
    'assets',
    'styles',
    'scripts',
    'tests',
    '__tests__',
  ]),

  /** 스캔에서 제외할 glob 패턴 목록 */
  ignorePatterns: z.array(z.string()).default([
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/.omc/**',
  ]),

  /** 경로 패턴 → CategoryType 명시적 매핑 */
  customMappings: z
    .record(z.string(), z.enum(['fractal', 'organ', 'pure-function', 'hybrid']))
    .default({}),
});

/**
 * 스캔 설정 Zod 스키마.
 */
export const ScanConfigSchema = z.object({
  /** 스캔에 포함할 glob 패턴. 기본값: 전체 */
  include: z.array(z.string()).default(['**']),

  /** 스캔에서 제외할 glob 패턴 */
  exclude: z.array(z.string()).default([
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.omc/**',
    '**/.metadata/**',
  ]),

  /** 스캔 최대 깊이. 0은 무제한 */
  maxDepth: z.number().int().min(0).default(10),

  /** 심볼릭 링크 추적 여부 */
  followSymlinks: z.boolean().default(false),
});

/**
 * 출력 설정 Zod 스키마.
 */
export const OutputConfigSchema = z.object({
  /** 보고서 출력 형식 */
  format: z.enum(['text', 'json', 'markdown']).default('text'),

  /** 출력 상세 수준 */
  verbosity: z.enum(['quiet', 'normal', 'verbose']).default('normal'),

  /** ANSI 컬러 사용 여부 */
  colorize: z.boolean().default(true),
});

/**
 * holon 전체 설정 Zod 스키마. `.holonrc.yml` 파일의 루트 구조.
 */
export const HolonrcSchema = z.object({
  rules: RuleConfigSchema.default({}),
  categories: CategoryConfigSchema.default({}),
  scanning: ScanConfigSchema.default({}),
  output: OutputConfigSchema.default({}),
});

// ─── TypeScript Types (Zod 스키마에서 파생) ───────────────────────────────────

/** 규칙 설정 타입 */
export type RuleConfig = z.infer<typeof RuleConfigSchema>;

/** 카테고리 분류 설정 타입 */
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>;

/** 스캔 설정 타입 */
export type ScanConfig = z.infer<typeof ScanConfigSchema>;

/** 출력 설정 타입 */
export type OutputConfig = z.infer<typeof OutputConfigSchema>;

/**
 * holon 전체 설정 타입. Zod 스키마에서 파생된다.
 * 내부 모든 필드는 required (default 값 적용 후).
 */
export type HolonConfig = z.infer<typeof HolonrcSchema>;

/**
 * config-loader가 설정을 로드하는 옵션.
 */
export interface LoadConfigOptions {
  /** 프로젝트 루트 경로 (기본값: process.cwd()) */
  projectRoot?: string;

  /** CLI에서 직접 전달된 설정 오버라이드 */
  cliOverrides?: Partial<HolonConfig>;

  /** 사용자 홈 디렉토리 (테스트 시 오버라이드용) */
  homeDir?: string;
}

/**
 * 로드된 설정과 소스 정보를 함께 담는 래퍼.
 */
export interface ResolvedConfig {
  /** 최종 병합된 설정 */
  config: HolonConfig;

  /** 각 설정 소스의 로드 성공 여부 */
  sources: Record<ConfigSource, boolean>;
}
```

---

### 9.4 src/types/drift.ts

이격(drift) 감지 및 보정 계획 타입.

```typescript
/**
 * @file drift.ts
 * @description 프랙탈 구조 이격(drift) 감지 및 보정 계획 타입.
 *
 * "이격"이란 현재 코드베이스의 실제 구조와 holon 규칙이 기대하는 이상적인 구조 사이의 괴리를 말한다.
 * drift-detector가 이를 감지하고, SyncPlan을 통해 보정 방법을 제안한다.
 */

/**
 * 이격 항목의 심각도.
 *
 * - `critical`: 즉시 수정 필요. 프로젝트 구조를 심각하게 훼손한다.
 * - `high`: 우선적으로 수정 권장. 유지보수성에 악영향을 준다.
 * - `medium`: 가능하면 수정. 구조적 일관성이 떨어진다.
 * - `low`: 선택적 개선. 스타일 차원의 문제.
 */
export type DriftSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * 이격 보정을 위한 액션 종류.
 *
 * - `move`: 파일/디렉토리를 다른 위치로 이동
 * - `rename`: 파일/디렉토리 이름 변경
 * - `create-index`: index.ts barrel 파일 생성
 * - `create-main`: main.ts 진입점 파일 생성
 * - `reclassify`: 노드의 CategoryType 재분류 (메타데이터 갱신)
 * - `split`: 하나의 모듈을 여러 모듈로 분리
 * - `merge`: 여러 모듈을 하나로 통합
 */
export type SyncAction =
  | 'move'
  | 'rename'
  | 'create-index'
  | 'create-main'
  | 'reclassify'
  | 'split'
  | 'merge';

/**
 * 개별 이격 항목. 하나의 구조적 문제를 표현한다.
 */
export interface DriftItem {
  /** 이격이 발생한 경로 */
  path: string;

  /** 이격을 유발한 규칙 ID */
  rule: string;

  /** 규칙이 기대하는 상태 설명 */
  expected: string;

  /** 현재 실제 상태 설명 */
  actual: string;

  /** 이격의 심각도 */
  severity: DriftSeverity;

  /** 권장 보정 액션 */
  suggestedAction: SyncAction;
}

/**
 * 전체 이격 감지 결과.
 * `drift-detector`의 `detectDrift` 함수가 반환한다.
 */
export interface DriftResult {
  /** 감지된 이격 항목 전체 목록 */
  items: DriftItem[];

  /** 총 이격 수 */
  totalDrifts: number;

  /** 심각도별 이격 수 */
  bySeverity: Record<DriftSeverity, number>;

  /** 스캔 시각 (ISO 8601 형식) */
  scanTimestamp: string;
}

/**
 * 단일 보정 액션의 상세 계획.
 */
export interface SyncPlanAction {
  /** 수행할 액션 종류 */
  action: SyncAction;

  /** 액션의 소스 경로 (이동/변경의 원본) */
  source: string;

  /** 액션의 대상 경로 (이동/변경의 목적지). 해당 없으면 undefined */
  target?: string;

  /** 이 액션이 필요한 이유 */
  reason: string;

  /** 액션 실행의 위험도 */
  riskLevel: DriftSeverity;

  /** 액션이 되돌릴 수 있는지 여부 */
  reversible: boolean;
}

/**
 * 이격 보정을 위한 전체 실행 계획.
 * `drift-detector`의 `generateSyncPlan` 함수가 반환한다.
 */
export interface SyncPlan {
  /** 순서대로 실행할 보정 액션 목록 */
  actions: SyncPlanAction[];

  /** 예상 파일시스템 변경 수 */
  estimatedChanges: number;

  /** 전체 계획의 위험 수준 (가장 높은 액션의 riskLevel) */
  riskLevel: DriftSeverity;
}

/**
 * drift-detector 실행 옵션.
 */
export interface DetectDriftOptions {
  /** critical/high만 감지할지 여부 (기본값: false — 전체 감지) */
  criticalOnly?: boolean;

  /** 보정 계획 생성 여부 (기본값: true) */
  generatePlan?: boolean;
}
```

---

### 9.5 src/types/hooks.ts

Claude Code hook 입출력 타입. filid 패턴을 그대로 재사용한다.

```typescript
/**
 * @file hooks.ts
 * @description Claude Code hook 입출력 타입 정의.
 *
 * filid 플러그인의 hooks.ts와 동일한 패턴을 따른다.
 * Hook 스크립트(structure-guard, change-tracker, context-injector)는
 * stdin에서 JSON을 읽고 stdout에 JSON을 출력한다.
 */

/**
 * 모든 hook 입력의 공통 필드.
 */
export interface HookBaseInput {
  /** 현재 작업 디렉토리 (절대 경로) */
  cwd: string;

  /** Claude Code 세션 ID */
  session_id: string;

  /** hook 이벤트 종류 */
  hook_event_name: string;
}

/**
 * PreToolUse hook 입력.
 * Write 또는 Edit 도구 실행 직전에 수신한다.
 */
export interface PreToolUseInput extends HookBaseInput {
  hook_event_name: 'PreToolUse';

  /** 실행될 도구 이름 (e.g., "Write", "Edit") */
  tool_name: string;

  /** 도구에 전달될 입력 파라미터 */
  tool_input: {
    /** Write 도구의 대상 파일 경로 */
    file_path?: string;

    /** Edit 도구의 대상 파일 경로 */
    path?: string;

    /** Write 도구의 파일 내용 */
    content?: string;

    /** Edit 도구의 교체 전 문자열 */
    old_string?: string;

    /** Edit 도구의 교체 후 문자열 */
    new_string?: string;

    /** 기타 도구별 파라미터 */
    [key: string]: unknown;
  };
}

/**
 * PostToolUse hook 입력.
 * Write 또는 Edit 도구 실행 직후에 수신한다.
 */
export interface PostToolUseInput extends HookBaseInput {
  hook_event_name: 'PostToolUse';

  /** 실행된 도구 이름 */
  tool_name: string;

  /** 도구에 전달된 입력 파라미터 */
  tool_input: {
    file_path?: string;
    path?: string;
    [key: string]: unknown;
  };

  /** 도구 실행 결과 */
  tool_response: {
    [key: string]: unknown;
  };
}

/**
 * UserPromptSubmit hook 입력.
 * 사용자가 프롬프트를 제출할 때마다 수신한다.
 */
export interface UserPromptSubmitInput extends HookBaseInput {
  hook_event_name: 'UserPromptSubmit';

  /** 사용자가 입력한 프롬프트 텍스트 */
  prompt?: string;
}

/**
 * Hook 스크립트의 표준 출력 형식.
 * `continue: false`이면 Claude Code가 원래 도구 실행을 중단한다.
 */
export interface HookOutput {
  /** 도구 실행 계속 여부. false이면 해당 도구 실행을 차단한다 */
  continue: boolean;

  /** hook 전용 출력 필드 */
  hookSpecificOutput?: {
    /** Claude Code가 컨텍스트로 주입할 추가 텍스트 */
    additionalContext?: string;
  };
}

/**
 * structure-guard가 출력하는 검증 결과.
 */
export interface StructureGuardOutput extends HookOutput {
  hookSpecificOutput?: {
    additionalContext?: string;

    /** 발견된 구조 규칙 위반 요약 */
    violations?: Array<{
      ruleId: string;
      severity: string;
      message: string;
      path: string;
    }>;
  };
}

/**
 * context-injector가 주입하는 프랙탈 컨텍스트 요약.
 */
export interface FractalContextSummary {
  /** 현재 프로젝트의 프랙탈 루트 경로 */
  root: string;

  /** 총 노드 수 */
  totalNodes: number;

  /** 현재 세션에서 감지된 미해결 이격 수 */
  pendingDrifts: number;

  /** 최근 스캔 시각 */
  lastScanTimestamp: string | null;
}
```

---

### 9.6 src/types/report.ts

분석 보고서 타입. project-analyzer가 생성하는 최종 출력.

```typescript
/**
 * @file report.ts
 * @description holon 분석 보고서 타입 정의.
 *
 * project-analyzer는 scan → validate → drift 파이프라인을 실행하고
 * AnalysisReport를 생성한다. 각 단계의 결과는 개별 Report 타입으로 표현된다.
 */

import type { FractalTree, ModuleInfo } from './fractal.js';
import type { RuleEvaluationResult } from './rules.js';
import type { HolonConfig } from './config.js';
import type { DriftResult, SyncPlan } from './drift.js';

/**
 * 프랙탈 트리 스캔 결과 보고서.
 * `fractal-scanner`가 생성한다.
 */
export interface ScanReport {
  /** 스캔된 프랙탈 트리 */
  tree: FractalTree;

  /** 스캔된 모듈 정보 목록 */
  modules: ModuleInfo[];

  /** 스캔 시작 시각 (ISO 8601) */
  timestamp: string;

  /** 스캔 소요 시간 (밀리초) */
  duration: number;
}

/**
 * 규칙 검증 결과 보고서.
 * `fractal-validator`가 생성한다.
 */
export interface ValidationReport {
  /** 규칙 평가 결과 */
  result: RuleEvaluationResult;

  /** 검증에 사용된 설정 */
  config: HolonConfig;

  /** 검증 시작 시각 (ISO 8601) */
  timestamp: string;
}

/**
 * 이격 감지 결과 보고서.
 * `drift-detector`가 생성한다.
 */
export interface DriftReport {
  /** 이격 감지 결과 */
  drift: DriftResult;

  /** 생성된 보정 계획. 요청하지 않았거나 이격이 없으면 null */
  syncPlan: SyncPlan | null;

  /** 이격 감지 시작 시각 (ISO 8601) */
  timestamp: string;
}

/**
 * 종합 분석 보고서. scan + validation + drift 결과를 통합한다.
 * `project-analyzer`의 `analyzeProject` 함수가 최종 반환한다.
 */
export interface AnalysisReport {
  /** 프랙탈 트리 스캔 결과 */
  scan: ScanReport;

  /** 규칙 검증 결과 */
  validation: ValidationReport;

  /** 이격 감지 결과 */
  drift: DriftReport;

  /** 핵심 지표 요약 */
  summary: {
    /** 스캔된 총 모듈 수 */
    totalModules: number;

    /** 발생한 총 규칙 위반 수 */
    violations: number;

    /** 감지된 총 이격 수 */
    drifts: number;

    /** 프랙탈 구조 건강도 점수 (0~100) */
    healthScore: number;
  };
}

/**
 * `project-analyzer`의 `analyzeProject` 옵션.
 */
export interface AnalyzeOptions {
  /** 상세 분석 수행 여부 (기본값: true) */
  detailed?: boolean;

  /** 이격 감지 포함 여부 (기본값: true) */
  includeDrift?: boolean;

  /** 보정 계획 생성 여부 (기본값: false — 비용이 높음) */
  generateSyncPlan?: boolean;
}

/**
 * 보고서 렌더링 결과.
 * `project-analyzer`의 `generateReport` 함수가 반환한다.
 */
export interface RenderedReport {
  /** 렌더링된 보고서 문자열 */
  content: string;

  /** 렌더링에 사용된 형식 */
  format: 'text' | 'json' | 'markdown';

  /** 렌더링 소요 시간 (밀리초) */
  duration: number;
}
```

---

### 9.7 src/types/index.ts

모든 타입의 barrel export.

```typescript
/**
 * @file index.ts
 * @description src/types/ 모듈의 barrel export.
 *
 * 외부에서 타입을 임포트할 때 항상 이 파일을 통해 가져온다:
 * ```typescript
 * import type { FractalNode, HolonConfig, DriftResult } from '../types/index.js';
 * ```
 */

export type {
  CategoryType,
  FractalNode,
  FractalTree,
  DirEntry,
  ModuleInfo,
  ExportInfo,
  BarrelPattern,
  PublicApi,
} from './fractal.js';

export type {
  RuleSeverity,
  RuleCategory,
  RuleContext,
  RuleViolation,
  Rule,
  RuleSet,
  RuleEvaluationResult,
  BuiltinRuleId,
} from './rules.js';

export { BUILTIN_RULE_IDS } from './rules.js';

export type {
  ConfigSource,
  MergeStrategy,
  RuleConfig,
  CategoryConfig,
  ScanConfig,
  OutputConfig,
  HolonConfig,
  LoadConfigOptions,
  ResolvedConfig,
} from './config.js';

export {
  RuleConfigSchema,
  CategoryConfigSchema,
  ScanConfigSchema,
  OutputConfigSchema,
  HolonrcSchema,
} from './config.js';

export type {
  DriftSeverity,
  SyncAction,
  DriftItem,
  DriftResult,
  SyncPlanAction,
  SyncPlan,
  DetectDriftOptions,
} from './drift.js';

export type {
  HookBaseInput,
  PreToolUseInput,
  PostToolUseInput,
  UserPromptSubmitInput,
  HookOutput,
  StructureGuardOutput,
  FractalContextSummary,
} from './hooks.js';

export type {
  ScanReport,
  ValidationReport,
  DriftReport,
  AnalysisReport,
  AnalyzeOptions,
  RenderedReport,
} from './report.js';
```

---

## 10. src/index.ts

라이브러리 공개 API barrel export.

```typescript
/**
 * @file src/index.ts
 * @description @lumy-pack/holon 패키지의 공개 API.
 *
 * 라이브러리로 사용 시 이 파일에서 import한다:
 * ```typescript
 * import { analyzeProject, loadConfig } from '@lumy-pack/holon';
 * import type { AnalysisReport, HolonConfig } from '@lumy-pack/holon';
 * ```
 *
 * 플러그인 내부 모듈(MCP 서버, Hook 스크립트)은 src/core/ 를 직접 import한다.
 */

// 타입 전체 재export
export type {
  CategoryType,
  FractalNode,
  FractalTree,
  DirEntry,
  ModuleInfo,
  ExportInfo,
  BarrelPattern,
  PublicApi,
  RuleSeverity,
  RuleCategory,
  RuleContext,
  RuleViolation,
  Rule,
  RuleSet,
  RuleEvaluationResult,
  BuiltinRuleId,
  ConfigSource,
  MergeStrategy,
  RuleConfig,
  CategoryConfig,
  ScanConfig,
  OutputConfig,
  HolonConfig,
  LoadConfigOptions,
  ResolvedConfig,
  DriftSeverity,
  SyncAction,
  DriftItem,
  DriftResult,
  SyncPlanAction,
  SyncPlan,
  DetectDriftOptions,
  ScanReport,
  ValidationReport,
  DriftReport,
  AnalysisReport,
  AnalyzeOptions,
  RenderedReport,
} from './types/index.js';

// Zod 스키마 및 상수 재export
export {
  BUILTIN_RULE_IDS,
  HolonrcSchema,
  RuleConfigSchema,
  CategoryConfigSchema,
  ScanConfigSchema,
  OutputConfigSchema,
} from './types/index.js';

// Core 함수 재export (Phase 2 구현 후 추가)
// export { analyzeProject } from './core/project-analyzer.js';
// export { loadConfig } from './core/config-loader.js';
// export { scanProject } from './core/fractal-scanner.js';
// export { validateStructure } from './core/fractal-validator.js';
// export { detectDrift } from './core/drift-detector.js';
```

---

## 디렉토리 구조 요약

Phase 1 완료 후 생성되는 파일 구조:

```
packages/holon/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── build-plugin.mjs
├── .mcp.json
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── agents/            # Phase 3에서 구현
├── skills/            # Phase 3에서 구현
└── src/
    ├── index.ts
    ├── types/
    │   ├── fractal.ts
    │   ├── rules.ts
    │   ├── config.ts
    │   ├── drift.ts
    │   ├── hooks.ts
    │   ├── report.ts
    │   └── index.ts
    ├── core/          # Phase 2에서 구현
    ├── mcp/           # Phase 3에서 구현
    └── hooks/         # Phase 3에서 구현
        └── entries/
            ├── structure-guard.entry.ts
            ├── change-tracker.entry.ts
            └── context-injector.entry.ts
```
