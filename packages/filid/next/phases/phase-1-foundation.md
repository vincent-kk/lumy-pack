# Phase 1 — 타입 확장 & 설정 시스템

기존 `@lumy-pack/filid` 플러그인에 프랙탈 구조 관리 기능을 통합한다. 새 패키지를 만들지 않고, 기존 filid의 타입 시스템과 설정 인프라를 확장한다.

---

## 1. package.json — 의존성 추가

기존 `packages/filid/package.json`에 다음 의존성을 추가한다. `yaml`과 `zod`는 이미 존재하므로 신규 추가 대상만 기재한다.

```json
{
  "dependencies": {
    "micromatch": "^4.0.8"
  },
  "devDependencies": {
    "@types/micromatch": "^4.0.9"
  }
}
```

**추가 이유:**
- `micromatch`: glob 패턴 기반 디렉토리 분류 및 exclude 패턴 매칭에 사용
- `yaml`, `zod`는 설정 시스템 제거로 불필요

---

## 2. tsconfig.json / tsconfig.build.json / vitest.config.ts

기존 파일을 그대로 사용한다. 변경 없음.

---

## 3. .claude-plugin/plugin.json — 기존 파일 수정

기존 `packages/filid/.claude-plugin/plugin.json`의 내용을 다음과 같이 갱신한다.

```json
{
  "name": "filid",
  "version": "0.0.2",
  "description": "FCA-AI rule enforcement + fractal structure management plugin for Claude Code agent workflows",
  "author": {
    "name": "Vincent K. Kelvin"
  },
  "repository": "https://github.com/vincent-kk/lumy-pack",
  "license": "MIT",
  "keywords": [
    "claude-code",
    "plugin",
    "fca-ai",
    "fractal",
    "context-architecture",
    "structure"
  ],
  "skills": "./skills/",
  "agents": "./agents/",
  "mcpServers": "./.mcp.json"
}
```

**변경 내용:**
- `version`: `0.0.1` → `0.0.2` (기능 추가 반영)
- `description`: 프랙탈 구조 관리 기능 추가 명시
- `keywords`: `"structure"` 추가

---

## 4. .mcp.json — 기존 유지

`packages/filid/.mcp.json`은 이미 `filid` 서버를 정의하고 있다. 변경 없음.

---

## 5. hooks/hooks.json — 기존 파일 수정

기존 `packages/filid/hooks/hooks.json`에 다음 hook을 추가한다. 기존 5개 hook(`pre-tool-validator`, `organ-guard`, `change-tracker`, `agent-enforcer`, `context-injector`)은 유지하고, `structure-guard`와 프랙탈 컨텍스트 주입 기능을 `context-injector`가 통합 처리하도록 한다.

`context-injector.entry.ts`를 업데이트하여 프랙탈 컨텍스트 주입 기능을 포함시키는 방식으로 확장한다(별도 hook 추가 없음).

---

## 6. build-plugin.mjs — 기존 파일 확장

기존 `packages/filid/build-plugin.mjs`는 5개 hook 엔트리를 번들링한다. 신규 hook 스크립트가 추가되면 `hookEntries` 배열에 항목을 추가한다.

현재 기존 상태:
```javascript
// filid의 현재 hook 엔트리 (5개)
const hookEntries = [
  'pre-tool-validator',
  'organ-guard',
  'change-tracker',
  'agent-enforcer',
  'context-injector',
];
```

Phase 3에서 `structure-guard` hook이 별도로 필요한 경우 해당 배열에 추가한다.

---

## 7. src/types/fractal.ts — 기존 파일 확장

기존 `packages/filid/src/types/fractal.ts`를 다음과 같이 수정한다.

**현재 상태:**
```typescript
export type NodeType = 'fractal' | 'organ' | 'pure-function';

export interface FractalNode {
  path: string;
  name: string;
  type: NodeType;
  parent: string | null;
  children: string[];
  organs: string[];
  hasClaudeMd: boolean;
  hasSpecMd: boolean;
}

export interface FractalTree {
  root: string;
  nodes: Map<string, FractalNode>;
}
```

**수정 후:**
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
 * 하위 호환성을 위한 alias. 기존 코드는 NodeType을 계속 사용할 수 있다.
 * @deprecated CategoryType을 사용할 것을 권장한다.
 */
export type NodeType = CategoryType;

/** Fractal node — a domain boundary with independent business logic */
export interface FractalNode {
  /** Absolute directory path */
  path: string;
  /** Node name (directory name) */
  name: string;
  /** Node classification (CategoryType alias: type) */
  type: CategoryType;
  /** Parent fractal path (null if root) */
  parent: string | null;
  /** Child fractal paths */
  children: string[];
  /** Organ directory paths */
  organs: string[];
  /** Whether CLAUDE.md exists */
  hasClaudeMd: boolean;
  /** Whether SPEC.md exists */
  hasSpecMd: boolean;
  /** Whether index.ts or index.js exists in this directory */
  hasIndex: boolean;
  /** Whether main.ts or main.js exists in this directory */
  hasMain: boolean;
  /** Depth from root (root = 0) */
  depth: number;
  /** Extended metadata (file counts, etc.) */
  metadata: Record<string, unknown>;
}

/** Fractal tree — the complete hierarchy */
export interface FractalTree {
  /** Root node path */
  root: string;
  /** Path → node mapping */
  nodes: Map<string, FractalNode>;
  /** Maximum depth of the tree (root = 0) */
  depth: number;
  /** Total node count (including root) */
  totalNodes: number;
}

/** Dependency edge */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'export' | 'call' | 'inheritance';
}

/** Directed Acyclic Graph (DAG) */
export interface DependencyDAG {
  nodes: Set<string>;
  edges: DependencyEdge[];
  adjacency: Map<string, string[]>;
}

/**
 * 디렉토리 항목 정보. 스캔 과정에서 내부적으로 사용한다.
 */
export interface DirEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * 개별 모듈의 정적 분석 정보.
 * index-analyzer 및 module-main-analyzer가 생성한다.
 */
export interface ModuleInfo {
  path: string;
  name: string;
  entryPoint: string | null;
  exports: string[];
  imports: string[];
  dependencies: string[];
}

/**
 * export 항목 하나의 정보. index-analyzer 내부에서 사용한다.
 */
export interface ExportInfo {
  name: string;
  kind: 'named' | 'default' | 'type' | 're-export';
  source?: string;
}

/**
 * index.ts의 barrel 패턴 분석 결과.
 */
export interface BarrelPattern {
  isPureBarrel: boolean;
  reExportCount: number;
  declarationCount: number;
  missingExports: string[];
}

/**
 * 모듈의 공개 API 명세. module-main-analyzer가 생성한다.
 */
export interface PublicApi {
  exports: ExportInfo[];
  types: string[];
  functions: string[];
  classes: string[];
}
```

**변경 요약:**
- `CategoryType` 신규 추가 (`hybrid` 포함)
- `NodeType`을 `CategoryType`의 alias로 변환 (하위 호환 유지)
- `FractalNode`에 `hasIndex`, `hasMain`, `depth`, `metadata` 필드 추가
- `FractalTree`에 `depth`, `totalNodes` 필드 추가
- `DirEntry`, `ModuleInfo`, `ExportInfo`, `BarrelPattern`, `PublicApi` 신규 추가

---

## 8. src/types/rules.ts — 신규 추가

`packages/filid/src/types/rules.ts`를 신규 생성한다.

```typescript
/**
 * @file rules.ts
 * @description rule-engine의 규칙 정의 및 평가 결과 타입.
 *
 * Rule은 순수 함수 `check`를 통해 RuleViolation[] 을 반환하는 구조이다.
 * 규칙은 built-in과 custom으로 나뉘며, config를 통해 on/off 및 severity 조정이 가능하다.
 */

import type { FractalNode, FractalTree } from './fractal.js';
import type { ScanOptions } from './scan.js';

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
  node: FractalNode;
  tree: FractalTree;
  scanOptions?: ScanOptions;
}

/**
 * 규칙 위반 항목 하나. `Rule.check`의 반환 배열 원소.
 */
export interface RuleViolation {
  ruleId: string;
  severity: RuleSeverity;
  message: string;
  path: string;
  suggestion?: string;
}

/**
 * 단일 규칙 정의.
 * `check` 함수는 순수 함수여야 하며 부작용이 없어야 한다.
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  enabled: boolean;
  check: (context: RuleContext) => RuleViolation[];
}

/**
 * 규칙 집합. built-in 규칙과 custom 규칙을 묶어 관리한다.
 */
export interface RuleSet {
  id: string;
  name: string;
  rules: Rule[];
}

/**
 * 전체 규칙 평가 실행 결과.
 * `rule-engine`의 `evaluateRules` 함수가 반환한다.
 */
export interface RuleEvaluationResult {
  violations: RuleViolation[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

/**
 * 내장 규칙 ID 열거형. 상수로 관리하여 오타를 방지한다.
 */
export const BUILTIN_RULE_IDS = {
  NAMING_CONVENTION: 'naming-convention',
  ORGAN_NO_CLAUDEMD: 'organ-no-claudemd',
  INDEX_BARREL_PATTERN: 'index-barrel-pattern',
  MODULE_ENTRY_POINT: 'module-entry-point',
  MAX_DEPTH: 'max-depth',
  CIRCULAR_DEPENDENCY: 'circular-dependency',
  PURE_FUNCTION_ISOLATION: 'pure-function-isolation',
} as const;

export type BuiltinRuleId = (typeof BUILTIN_RULE_IDS)[keyof typeof BUILTIN_RULE_IDS];
```

---

## 9. src/types/scan.ts — 신규 추가 (config.ts 대체)

`packages/filid/src/types/scan.ts`를 신규 생성한다. 설정 파일 대신 프로그래밍적 스캔 옵션만 제공한다.

```typescript
/**
 * @file scan.ts
 * @description filid v2 스캔 옵션 타입 정의.
 *
 * 제로 설정(zero-config) 아키텍처: 외부 설정 파일 없이 내장 기본값 사용.
 * 필요 시 프로그래밍적으로 옵션을 전달할 수 있다.
 */

/**
 * 프로젝트 스캔 옵션
 */
export interface ScanOptions {
  /** 스캔 포함 glob 패턴. 기본값: ['**'] */
  include?: string[];
  /** 스캔 제외 glob 패턴. 기본값: ['node_modules/**', '.git/**', 'dist/**'] */
  exclude?: string[];
  /** 최대 스캔 깊이. 기본값: 10 */
  maxDepth?: number;
  /** 심볼릭 링크 추적 여부. 기본값: false */
  followSymlinks?: boolean;
}

/** 기본 스캔 옵션 (내장 하드코딩, 외부 설정 파일 없음) */
export const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  include: ['**'],
  exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  maxDepth: 10,
  followSymlinks: false,
};
```

**설계 결정:**
- `FractalConfig`, `FilidConfig`, `CategoryConfig`, `ConfigSource`, `MergeStrategy` 등 설정 타입 전부 제거
- 외부 설정 파일 스키마 및 Zod 검증 코드 제거
- `organNames` 배열 제거 — 구조 기반 분류로 대체
- `yaml`, `zod` 의존성 불필요
- `ScanOptions`만 유지 (프로그래밍적 옵션 전달용)

---

## 10. src/types/drift.ts — 신규 추가

`packages/filid/src/types/drift.ts`를 신규 생성한다.

```typescript
/**
 * @file drift.ts
 * @description 프랙탈 구조 이격(drift) 감지 및 보정 계획 타입.
 *
 * "이격"이란 현재 코드베이스의 실제 구조와 filid v2 규칙이 기대하는
 * 이상적인 구조 사이의 괴리를 말한다.
 * drift-detector가 이를 감지하고, SyncPlan을 통해 보정 방법을 제안한다.
 */

export type DriftSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SyncAction =
  | 'move'
  | 'rename'
  | 'create-index'
  | 'create-main'
  | 'reclassify'
  | 'split'
  | 'merge';

export interface DriftItem {
  path: string;
  rule: string;
  expected: string;
  actual: string;
  severity: DriftSeverity;
  suggestedAction: SyncAction;
}

export interface DriftResult {
  items: DriftItem[];
  totalDrifts: number;
  bySeverity: Record<DriftSeverity, number>;
  scanTimestamp: string;
}

export interface SyncPlanAction {
  action: SyncAction;
  source: string;
  target?: string;
  reason: string;
  riskLevel: DriftSeverity;
  reversible: boolean;
}

export interface SyncPlan {
  actions: SyncPlanAction[];
  estimatedChanges: number;
  riskLevel: DriftSeverity;
}

export interface DetectDriftOptions {
  criticalOnly?: boolean;
  generatePlan?: boolean;
}
```

---

## 11. src/types/hooks.ts — 기존 파일 확장

기존 `packages/filid/src/types/hooks.ts`에 구조 검증 관련 타입을 추가한다. 기존 내용은 유지한다.

추가할 타입:

```typescript
/**
 * structure-guard가 출력하는 검증 결과.
 * 기존 HookOutput을 확장한다.
 */
export interface StructureGuardOutput extends HookOutput {
  hookSpecificOutput?: {
    additionalContext?: string;
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
  root: string;
  totalNodes: number;
  pendingDrifts: number;
  lastScanTimestamp: string | null;
}
```

---

## 12. src/types/report.ts — 신규 추가

`packages/filid/src/types/report.ts`를 신규 생성한다.

```typescript
/**
 * @file report.ts
 * @description filid v2 분석 보고서 타입 정의.
 *
 * project-analyzer는 scan → validate → drift 파이프라인을 실행하고
 * AnalysisReport를 생성한다. 각 단계의 결과는 개별 Report 타입으로 표현된다.
 */

import type { FractalTree, ModuleInfo } from './fractal.js';
import type { RuleEvaluationResult } from './rules.js';
import type { ScanOptions } from './scan.js';
import type { DriftResult, SyncPlan } from './drift.js';

export interface ScanReport {
  tree: FractalTree;
  modules: ModuleInfo[];
  timestamp: string;
  duration: number;
}

export interface ValidationReport {
  result: RuleEvaluationResult;
  scanOptions?: ScanOptions;
  timestamp: string;
}

export interface DriftReport {
  drift: DriftResult;
  syncPlan: SyncPlan | null;
  timestamp: string;
}

export interface AnalysisReport {
  scan: ScanReport;
  validation: ValidationReport;
  drift: DriftReport;
  summary: {
    totalModules: number;
    violations: number;
    drifts: number;
    healthScore: number;
  };
}

export interface AnalyzeOptions {
  detailed?: boolean;
  includeDrift?: boolean;
  generateSyncPlan?: boolean;
}

export interface RenderedReport {
  content: string;
  format: 'text' | 'json' | 'markdown';
  duration: number;
}
```

---

## 13. src/types/index.ts — 기존 파일 확장

기존 `packages/filid/src/types/index.ts`에 신규 타입 파일의 re-export를 추가한다. 기존 export는 모두 유지한다.

```typescript
// 기존 export 유지 (fractal.ts, documents.ts, hooks.ts, ast.ts, metrics.ts)
export * from './fractal.js';
export * from './documents.js';
export * from './hooks.js';
export * from './ast.js';
export * from './metrics.js';

// Phase 1에서 신규 추가
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
  ScanOptions,
} from './scan.js';
export {
  DEFAULT_SCAN_OPTIONS,
} from './scan.js';

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
  ScanReport,
  ValidationReport,
  DriftReport,
  AnalysisReport,
  AnalyzeOptions,
  RenderedReport,
} from './report.js';
```

---

## 14. src/index.ts — 기존 파일 확장

기존 `packages/filid/src/index.ts`에 신규 모듈의 re-export를 추가한다. 기존 export는 모두 유지한다.

Phase 1에서 추가할 내용 (Phase 2 구현 완료 후 주석 해제):

```typescript
// Phase 2 구현 후 활성화
// export { analyzeProject } from './core/project-analyzer.js';
// export { scanProject } from './core/fractal-scanner.js';
// export { validateStructure } from './core/fractal-validator.js';
// export { detectDrift } from './core/drift-detector.js';
```

Phase 1에서 즉시 추가할 내용 (타입 re-export):

```typescript
// 기존 export type * from './types/index.js'; 가 신규 타입을 자동으로 포함
// 별도 추가 불필요 — types/index.ts 확장으로 충분
```

---

## 디렉토리 구조 요약

Phase 1 완료 후 `packages/filid/` 내 변경/추가 파일:

```
packages/filid/
├── package.json                     ← micromatch 의존성 추가
├── .claude-plugin/
│   └── plugin.json                  ← version/description 수정
├── src/
│   ├── index.ts                     ← Phase 2 export 준비 (주석 형태)
│   └── types/
│       ├── fractal.ts               ← CategoryType, hasIndex, hasMain, depth, metadata 추가
│       ├── rules.ts                 ← 신규 추가
│       ├── scan.ts                  ← 신규 추가 (config.ts 대체)
│       ├── drift.ts                 ← 신규 추가
│       ├── hooks.ts                 ← StructureGuardOutput, FractalContextSummary 추가
│       ├── report.ts                ← 신규 추가
│       └── index.ts                 ← 신규 타입 re-export 추가
└── (기존 파일들은 모두 유지)
```

변경하지 않는 파일: `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `build-plugin.mjs`, `.mcp.json`, `hooks/hooks.json` (Phase 3까지 변경 없음)
