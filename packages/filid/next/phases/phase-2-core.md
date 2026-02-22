# Phase 2: Core Modules — 핵심 비즈니스 로직

filid v2의 10개 core 모듈 상세 명세. 기존 filid의 `organ-classifier.ts`와 `fractal-tree.ts`를 수정하고, 나머지 모듈은 `src/core/`에 신규 추가한다. 각 모듈의 책임, 함수 시그니처, 알고리즘, 의존 관계, 구현 순서를 정의한다.

---

## 구현 순서 다이어그램

```
organ-classifier 수정 (Phase 2.1)    index-analyzer (Phase 2.1)
    ↓                                    ↓
fractal-tree 확장 (Phase 2.2)      module-main-analyzer (Phase 2.2)
    ↓                                    ↓
    └──────────┬─────────────────────────┘
               ↓
rule-engine (Phase 2.3)
    ↓
fractal-validator (Phase 2.4)    lca-calculator (Phase 2.4)
    ↓                                    ↓
drift-detector (Phase 2.5)
    ↓
project-analyzer (Phase 2.6)
```

**구현 원칙:**
- 기존 모듈 수정 시 config-loader 의존을 완전 제거하고 구조 기반으로 전환한다. 인터페이스 변경이 수반될 수 있다.
- 각 모듈은 `packages/filid/src/core/<module-name>.ts`에 위치한다.
- 모든 public 함수는 순수 함수(pure function)를 지향한다. 부작용은 명시적 파라미터로 처리한다.
- 모듈 간 의존은 단방향이어야 한다 (순환 의존 금지).
- 각 모듈은 독립적으로 테스트 가능해야 한다.

---

## Module 1: (제거됨 — config-loader)

**설계 결정:** config-loader 모듈은 제로 설정(zero-config) 아키텍처 전환으로 제거되었다.

- `.fractalrc.yml` 설정 파일 → 불필요 (구조 기반 자동 분류)
- 4단계 설정 병합(default → project → user → cli) → 불필요 (단일 내장 기본값)
- `yaml`, `zod` 의존성 → 불필요
- `FractalConfig`, `FilidConfig`, `CategoryConfig` 타입 → 불필요

대체: `organ-classifier`가 디렉토리 구조를 분석하여 직접 분류한다.
모호한 케이스는 `context-injector`를 통해 LLM 판단에 위임한다.

---

## Module 2: organ-classifier (기존 파일 수정)

**파일:** `src/core/organ-classifier.ts` (기존 파일 수정)
**구현 우선순위:** Phase 2.1 (최우선)

### 책임 및 역할 — 수정 내용

기존 `organ-classifier.ts`는 `ORGAN_DIR_NAMES`를 하드코딩된 배열로 관리하고, `classifyNode()`가 `NodeType`을 반환한다. 이를 다음과 같이 수정한다.

1. **`ORGAN_DIR_NAMES` 하드코딩 → 구조 기반 분류로 전환 (디렉토리 구조 분석 + LLM 판단 위임)**: config-loader 의존을 완전 제거하고, 디렉토리 구조(CLAUDE.md, SPEC.md, 자식 구성)를 직접 분석한다.
2. **`classifyNode()` 반환값을 `CategoryType`으로 재작성**: 새 분류 규칙 적용 — CLAUDE.md→fractal, SPEC.md→fractal, 리프만→organ, 부작용없음→pure-function, 기본→fractal, 모호→LLM.
3. **`config?: FilidConfig` 파라미터 제거**: config 의존 없이 순수 구조 기반 판단.
4. **`organNames`, `customMappings`, `findCustomMapping`, `micromatch` import 제거**.

### 수정 후 코드

```typescript
import type { CategoryType } from '../types/fractal.js';

export interface ClassifyInput {
  dirName: string;
  hasClaudeMd: boolean;
  hasSpecMd: boolean;
  hasFractalChildren: boolean;
  isLeafDirectory: boolean;
  hasSideEffects?: boolean;
}

/**
 * 디렉토리를 구조 기반으로 fractal / organ / pure-function 으로 분류한다.
 *
 * 분류 우선순위:
 * 1. CLAUDE.md 존재 → fractal
 * 2. SPEC.md 존재 → fractal
 * 3. 프랙탈 자식 없음 + 리프 파일만 → organ
 * 4. 부작용 없음 → pure-function
 * 5. 기본값 → fractal
 *
 * 모호한 케이스는 호출자가 context-injector를 통해 LLM에 위임한다.
 */
export function classifyNode(input: ClassifyInput): CategoryType {
  if (input.hasClaudeMd) return 'fractal';
  if (input.hasSpecMd) return 'fractal';
  if (!input.hasFractalChildren && input.isLeafDirectory) return 'organ';
  const hasSideEffects = input.hasSideEffects ?? true;
  if (!hasSideEffects) return 'pure-function';
  return 'fractal';
}
```

### 의존하는 모듈

**없음** (최우선 구현 대상, config-loader 의존 제거)

---

## Module 3: index-analyzer

**파일:** `src/core/index-analyzer.ts` (신규 추가)
**구현 우선순위:** Phase 2.2 (organ-classifier 수정과 병렬)

### 책임 및 역할

`index.ts` 파일을 정적 분석하여 barrel 패턴 준수 여부를 검사한다. TypeScript AST 파싱 없이 정규식 기반으로 export 구문을 분석한다 (경량 구현). re-export, named export, default export, type export를 구분한다.

### 주요 함수 시그니처

```typescript
import type { ExportInfo, BarrelPattern } from '../types/index.js';

/**
 * index.ts 파일을 분석하여 export 정보와 barrel 패턴 평가 결과를 반환한다.
 *
 * @param filePath - index.ts의 절대 경로
 * @returns export 목록과 barrel 패턴 분석 결과
 * @throws Error — 파일을 읽을 수 없는 경우
 */
export async function analyzeIndex(filePath: string): Promise<IndexAnalysis>;

/**
 * export 목록을 받아 barrel 패턴 준수 여부를 평가한다.
 *
 * barrel 패턴 기준:
 * - 모든 export가 re-export ('export ... from ...')여야 한다
 * - 직접 선언(function, class, const 등)이 없어야 한다
 *
 * @param exports - analyzeIndex가 추출한 export 목록
 * @returns barrel 패턴 분석 결과
 */
export function detectBarrelPattern(exports: ExportInfo[]): BarrelPattern;

/**
 * 모듈 디렉토리를 스캔하여 index.ts에서 누락된 export를 찾는다.
 *
 * @param moduleDir - 모듈 디렉토리의 절대 경로
 * @returns 누락된 export 소스 경로 목록
 */
export async function findMissingExports(moduleDir: string): Promise<string[]>;

/**
 * TypeScript/JavaScript 파일에서 export 구문을 정규식으로 추출한다.
 *
 * @param content - 파일 내용 문자열
 * @returns 추출된 ExportInfo 배열
 */
export function extractExports(content: string): ExportInfo[];
```

**보조 타입:**

```typescript
export interface IndexAnalysis {
  filePath: string;
  exports: ExportInfo[];
  barrelPattern: BarrelPattern;
  exists: boolean;
}
```

### 핵심 알고리즘/로직 설명

**정규식 기반 export 추출 패턴:**

```typescript
// re-export: export { X } from './y'
const RE_EXPORT = /^export\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]/gm;

// re-export all: export * from './y'
const RE_EXPORT_ALL = /^export\s+\*\s+(?:as\s+\w+\s+)?from\s+['"][^'"]+['"]/gm;

// type re-export: export type { X } from './y'
const TYPE_RE_EXPORT = /^export\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]/gm;

// named export: export const/function/class/interface/type X
const NAMED_EXPORT = /^export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/gm;

// default export
const DEFAULT_EXPORT = /^export\s+default\s+/gm;
```

**barrel 패턴 판정:** `declarationCount === 0`이면 pure barrel. `declarationCount > 0`이면 혼합 패턴으로 경고.

### 의존하는 모듈

없음 (독립 모듈)

---

## Module 4: fractal-tree (기존 파일 확장)

**파일:** `src/core/fractal-tree.ts` (기존 파일 확장)
**구현 우선순위:** Phase 2.2

### 책임 및 역할 — 수정 내용

기존 `fractal-tree.ts`는 `NodeEntry[]`를 받아 `FractalTree`를 조립하는 `buildFractalTree()` 등을 제공한다. 이를 다음과 같이 확장한다.

1. **`ScanOptions` 기반 include/exclude, maxDepth 지원**: `scanProject()` 신규 추가. `FilidConfig` 대신 `ScanOptions`를 사용한다.
2. **스캔 시간 측정 추가**: `scanProject()`가 소요 시간을 함께 반환.
3. **`FractalTree`의 `depth`, `totalNodes` 필드 채우기**: `buildFractalTree()` 확장.
4. **기존 함수 모두 유지**: `buildFractalTree()`, `findNode()`, `getAncestors()`, `getDescendants()` 하위 호환 유지.

### 추가/수정할 코드

```typescript
import fg from 'fast-glob';
import { resolve, dirname, basename } from 'node:path';
import { existsSync } from 'node:fs';
import type { FractalTree, FractalNode, DirEntry, NodeType } from '../types/fractal.js';
import type { ScanOptions } from '../types/index.js';
import { classifyNode } from './organ-classifier.js';

// 기존 NodeEntry 인터페이스 및 buildFractalTree, findNode, getAncestors, getDescendants 유지

/**
 * 프로젝트 루트에서 시작하여 FractalTree를 구축한다.
 * fast-glob으로 디렉토리를 나열하고 organ-classifier로 각 노드를 분류한다.
 * options의 include/exclude/maxDepth를 준수한다.
 *
 * @param root - 프로젝트 루트의 절대 경로
 * @param options - 스캔 옵션 (include, exclude, maxDepth)
 * @returns 완성된 FractalTree
 */
export async function scanProject(root: string, options?: ScanOptions): Promise<FractalTree>;

/**
 * DirEntry 목록에서 FractalTree를 조립한다.
 * 경로 기반으로 부모-자식 관계를 결정하고 노드를 연결한다.
 * depth, totalNodes 필드를 계산하여 채운다.
 *
 * @param root - 트리 루트 경로
 * @param entries - scanProject가 수집한 전체 DirEntry 목록
 * @returns 조립된 FractalTree (depth, totalNodes 포함)
 */
export function buildTree(root: string, entries: DirEntry[]): FractalTree;

/**
 * 스캔에서 제외해야 하는 경로인지 판정한다.
 * micromatch를 사용한 glob 패턴 매칭.
 *
 * @param path - 검사할 경로 (루트 기준 상대 경로)
 * @param options - ScanOptions
 * @returns 제외 대상이면 true
 */
export function shouldExclude(path: string, options: ScanOptions): boolean;
```

### 핵심 알고리즘/로직 설명

**트리 구축 알고리즘 (`scanProject`):**

```
scanProject(root, options)
  │
  ├─ 1. fast-glob으로 모든 디렉토리 나열 (파일 제외)
  │      glob: '**/', options: { cwd: root, deep: maxDepth, ignore: exclude }
  │
  ├─ 2. 각 디렉토리에 대해 노드 생성
  │      - classifyNode({ dirName, hasClaudeMd, hasSpecMd, hasFractalChildren, isLeafDirectory }) → CategoryType
  │      - existsSync(dir/index.ts) → hasIndex
  │      - existsSync(dir/main.ts)  → hasMain
  │      - depth = relPath.split('/').length
  │
  ├─ 3. buildTree()로 노드 간 관계 연결
  │      - 각 노드의 parent = 가장 가까운 상위 경로
  │      - parent.children.push(node.path) — fractal/pure-function 노드
  │      - parent.organs.push(node.path)   — organ 노드
  │      - FractalTree.depth = 최대 depth 값
  │      - FractalTree.totalNodes = nodes.size
  │
  └─ 4. FractalTree 반환
```

**기존 `buildFractalTree(entries)` 함수 수정:**

기존 함수는 `NodeEntry[]`를 받아 `FractalTree`를 반환한다. Phase 2에서 `FractalTree`에 `depth`와 `totalNodes` 필드가 추가되므로, 기존 함수가 이 필드를 올바르게 채우도록 수정한다. 기존 시그니처와 동작은 유지한다.

```typescript
// 기존 반환 타입 FractalTree에 depth, totalNodes 계산 추가
export function buildFractalTree(entries: NodeEntry[]): FractalTree {
  // ... 기존 로직 유지 ...

  // Phase 2 추가: depth, totalNodes 계산
  let maxDepth = 0;
  for (const [, node] of nodes) {
    const d = node.path.split('/').length - root.split('/').length;
    (node as any).depth = d;
    if (d > maxDepth) maxDepth = d;
  }

  return { root, nodes, depth: maxDepth, totalNodes: nodes.size };
}
```

### 의존하는 모듈

- `organ-classifier` (classifyNode)

---

## Module 5: module-main-analyzer

**파일:** `src/core/module-main-analyzer.ts` (신규 추가)
**구현 우선순위:** Phase 2.3 (fractal-tree 확장과 병렬)

### 책임 및 역할

모듈 디렉토리의 진입점을 탐색하고 public API를 추출한다. 진입점 탐색 순서: `index.ts` → `index.js` → `main.ts` → `main.js` → 디렉토리 내 단일 `.ts` 파일. `index-analyzer`를 활용하여 barrel export를 분석한다.

### 주요 함수 시그니처

```typescript
import type { ModuleInfo, PublicApi } from '../types/index.js';

/**
 * 모듈 디렉토리를 분석하여 ModuleInfo를 반환한다.
 * 진입점 탐색, export 추출, import 분석을 통합 수행한다.
 *
 * @param modulePath - 모듈 디렉토리의 절대 경로
 * @returns 모듈 정보 (진입점, exports, imports, dependencies)
 */
export async function analyzeModuleMain(modulePath: string): Promise<ModuleInfo>;

/**
 * 모듈 디렉토리에서 진입점 파일을 탐색한다.
 *
 * 탐색 순서:
 * 1. index.ts
 * 2. index.js
 * 3. main.ts
 * 4. main.js
 * 5. 디렉토리 내 유일한 .ts 파일 (여러 개이면 null)
 *
 * @param modulePath - 탐색할 디렉토리의 절대 경로
 * @returns 진입점 파일의 절대 경로 또는 null
 */
export async function findEntryPoint(modulePath: string): Promise<string | null>;

/**
 * 진입점 파일을 분석하여 외부 공개 API를 추출한다.
 * index-analyzer.extractExports()를 내부적으로 사용한다.
 *
 * @param entryPoint - 진입점 파일의 절대 경로
 * @returns 공개 API (exports, types, functions, classes)
 */
export async function extractPublicApi(entryPoint: string): Promise<PublicApi>;

/**
 * TypeScript 파일에서 import 경로를 추출한다.
 * 정규식 기반 (AST 파싱 없음).
 *
 * @param filePath - 분석할 파일의 절대 경로
 * @returns import 경로 목록 (상대 경로 그대로)
 */
export async function extractImports(filePath: string): Promise<string[]>;
```

### 핵심 알고리즘/로직 설명

**진입점 탐색 우선순위:**

```typescript
const ENTRY_CANDIDATES = ['index.ts', 'index.js', 'main.ts', 'main.js'];

async function findEntryPoint(modulePath: string): Promise<string | null> {
  // 1. 후보 파일을 순서대로 확인
  for (const candidate of ENTRY_CANDIDATES) {
    const full = path.join(modulePath, candidate);
    if (await exists(full)) return full;
  }
  // 2. 디렉토리 내 .ts 파일이 하나뿐이면 그것이 진입점
  const tsFiles = await glob('*.ts', { cwd: modulePath });
  if (tsFiles.length === 1) return path.join(modulePath, tsFiles[0]);
  // 3. 판단 불가
  return null;
}
```

**dependency 해석:**
- `extractImports()`로 import 경로를 수집
- 상대 경로(`./`, `../`)는 모듈 경로 기준으로 resolve하여 절대 경로로 변환
- node_modules 경로는 dependencies에서 제외

### 의존하는 모듈

- `index-analyzer`

---

## Module 6: rule-engine

**파일:** `src/core/rule-engine.ts` (신규 추가)
**구현 우선순위:** Phase 2.3

### 책임 및 역할

내장 규칙(builtin rules)을 로드하고, FractalTree의 모든 노드에 대해 규칙을 평가하여 `RuleEvaluationResult`를 반환한다. 규칙은 순수 함수이므로 병렬 평가가 가능하다. config-loader 의존을 완전 제거하고, 선택적 `options` 파라미터로 규칙 활성화/심각도를 조정한다.

### 주요 함수 시그니처

```typescript
import type {
  Rule,
  RuleEvaluationResult,
  RuleViolation,
  RuleContext,
  FractalTree,
  EvaluateOptions,
} from '../types/index.js';

/**
 * 모든 내장 규칙 인스턴스를 생성하여 반환한다.
 *
 * @returns 내장 규칙 전체 목록
 */
export function loadBuiltinRules(): Rule[];

/**
 * FractalTree의 모든 노드에 대해 활성화된 규칙을 평가한다.
 *
 * @param tree - 검증할 프랙탈 트리
 * @param options - 규칙 활성화 및 심각도 오버라이드 (선택적)
 * @returns 전체 평가 결과 (violations, passed, failed, skipped, duration)
 */
export function evaluateRules(tree: FractalTree, options?: EvaluateOptions): RuleEvaluationResult;

/**
 * 단일 노드에 단일 규칙을 적용한다.
 *
 * @param rule - 적용할 규칙
 * @param context - 규칙 컨텍스트 (node, tree)
 * @returns 위반 목록 (없으면 빈 배열)
 */
export function evaluateRule(rule: Rule, context: RuleContext): RuleViolation[];
```

### 핵심 알고리즘/로직 설명

**7개 내장 규칙 정의:**

| Rule ID | 카테고리 | 기본 심각도 | 설명 |
|---------|---------|------------|------|
| `naming-convention` | naming | warning | 디렉토리/파일명이 kebab-case 또는 camelCase를 따르는지 |
| `organ-no-claudemd` | structure | error | organ 노드에 CLAUDE.md가 없어야 한다 (organ은 독립 문서화 금지) |
| `index-barrel-pattern` | index | warning | fractal 노드의 index.ts가 순수 barrel(re-export만)이어야 한다 |
| `module-entry-point` | module | warning | 모든 fractal 노드에 index.ts 또는 main.ts가 존재해야 한다 |
| `max-depth` | structure | error | 프랙탈 깊이가 DEFAULT_SCAN_OPTIONS.maxDepth를 초과하면 안 된다 |
| `circular-dependency` | dependency | error | 모듈 간 순환 의존이 없어야 한다 |
| `pure-function-isolation` | dependency | error | pure-function 노드는 상위 fractal 모듈을 import하면 안 된다 |

**평가 루프:**

```typescript
function evaluateRules(tree: FractalTree, options?: EvaluateOptions): RuleEvaluationResult {
  const start = Date.now();
  const rules = loadBuiltinRules();
  const violations: RuleViolation[] = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const [, node] of tree.nodes) {
    const context: RuleContext = { node, tree };
    for (const rule of rules) {
      if (!rule.enabled) { skipped++; continue; }
      const nodeViolations = evaluateRule(rule, context);
      if (nodeViolations.length === 0) passed++;
      else { failed++; violations.push(...nodeViolations); }
    }
  }

  return { violations, passed, failed, skipped, duration: Date.now() - start };
}
```

**순환 의존 감지 (circular-dependency 규칙):**
DFS로 의존 그래프를 탐색하며 방문 스택에서 이미 방문한 노드를 재방문하면 순환으로 판정. 기존 filid의 `dependency-graph.ts`의 `detectCycles()`를 활용할 수 있다.

### 의존하는 모듈

없음 (config-loader 의존 제거)

---

## Module 7: fractal-validator

**파일:** `src/core/fractal-validator.ts` (신규 추가)
**구현 우선순위:** Phase 2.5

### 책임 및 역할

`rule-engine`과 확장된 `fractal-tree`를 조합하여 구조 검증을 오케스트레이션한다. 노드별 검증과 트리 전체(의존 관계) 검증을 수행하고, `ValidationReport`를 생성한다.

### 주요 함수 시그니처

```typescript
import type {
  FractalTree,
  FractalNode,
  RuleContext,
  RuleViolation,
  ValidationReport,
} from '../types/index.js';

/**
 * FractalTree 전체를 검증하고 ValidationReport를 반환한다.
 *
 * @param tree - 검증할 프랙탈 트리
 * @returns 검증 보고서 (규칙 평가 결과 + 타임스탬프)
 */
export function validateStructure(tree: FractalTree): ValidationReport;

/**
 * 단일 노드를 컨텍스트와 함께 검증한다.
 *
 * @param node - 검증할 노드
 * @param context - 노드가 속한 트리와 설정을 포함한 컨텍스트
 * @returns 해당 노드에서 발생한 위반 목록
 */
export function validateNode(node: FractalNode, context: RuleContext): RuleViolation[];

/**
 * 트리 전체의 의존 관계를 검증한다.
 * 순환 의존과 레이어 위반(organ이 fractal을 import 등)을 감지한다.
 *
 * @param tree - 의존 관계를 검증할 트리
 * @returns 의존 관계 위반 목록
 */
export function validateDependencies(tree: FractalTree): RuleViolation[];
```

### 핵심 알고리즘/로직 설명

**레이어 위반 감지 (`validateDependencies`):**

프랙탈 구조에서 허용되는 의존 방향:
- fractal → 자신의 organs (허용)
- fractal → 자신의 children fractal (허용)
- organ → 동일 fractal의 다른 organ (허용)
- pure-function → 외부 (금지)

위반 탐지:
1. 각 노드의 `ModuleInfo.dependencies`를 순회
2. 의존 대상 노드의 CategoryType과 레이어(depth)를 비교
3. 상위 fractal로 역방향 의존하면 위반으로 기록

**순환 의존 감지:**

기존 `dependency-graph.ts`의 `detectCycles()`를 재사용하거나, 아래 패턴으로 구현한다:

```typescript
function detectCycles(tree: FractalTree): string[][] {
  const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
  const cycles: string[][] = [];

  function dfs(nodePath: string, stack: string[]): void {
    state.set(nodePath, 'visiting');
    stack.push(nodePath);

    const node = tree.nodes.get(nodePath);
    for (const dep of node?.organs ?? []) {
      if (state.get(dep) === 'visiting') {
        const cycleStart = stack.indexOf(dep);
        cycles.push(stack.slice(cycleStart));
      } else if (state.get(dep) !== 'visited') {
        dfs(dep, [...stack]);
      }
    }

    state.set(nodePath, 'visited');
  }

  for (const [path] of tree.nodes) {
    if (state.get(path) !== 'visited') dfs(path, []);
  }

  return cycles;
}
```

### 의존하는 모듈

- `rule-engine`
- 확장된 `fractal-tree` (FractalTree 타입)

---

## Module 8: lca-calculator

**파일:** `src/core/lca-calculator.ts` (신규 추가)
**구현 우선순위:** Phase 2.5 (fractal-validator와 병렬)

### 책임 및 역할

Lowest Common Ancestor(최근접 공통 조상) 계산을 통해 모듈의 최적 배치 위치를 제안한다. 여러 모듈에서 공유되는 코드를 어느 레벨의 fractal에 배치할지 결정하는 데 사용한다. Naive parent traversal 방식으로 구현한다.

기존 `fractal-tree.ts`의 `getAncestors()` 함수를 내부적으로 활용한다.

### 주요 함수 시그니처

```typescript
import type { FractalTree } from '../types/index.js';

/**
 * 두 노드의 Lowest Common Ancestor(LCA)를 반환한다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param pathA - 첫 번째 노드의 경로
 * @param pathB - 두 번째 노드의 경로
 * @returns LCA 노드의 경로. 없으면 root 반환
 * @throws Error — pathA 또는 pathB가 트리에 없는 경우
 */
export function findLCA(tree: FractalTree, pathA: string, pathB: string): string;

/**
 * 여러 의존 모듈을 분석하여 공유 코드를 배치할 최적 fractal 레벨을 제안한다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param dependencies - 배치 위치를 결정할 의존 모듈 경로 목록
 * @returns 최적 배치 fractal 노드의 경로
 */
export function suggestPlacement(tree: FractalTree, dependencies: string[]): string;

/**
 * 트리에서 두 노드 간의 거리를 계산한다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param from - 시작 노드의 경로
 * @param to - 목적지 노드의 경로
 * @returns 두 노드 간의 트리 거리 (엣지 수)
 */
export function calculateDistance(tree: FractalTree, from: string, to: string): number;

/**
 * 노드에서 루트까지의 조상 경로 배열을 반환한다.
 * 기존 fractal-tree.getAncestors()를 path 배열 형태로 래핑한다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param nodePath - 시작 노드의 경로
 * @returns [nodePath, parent, grandparent, ..., root] 순서의 경로 배열
 */
export function getAncestorPaths(tree: FractalTree, nodePath: string): string[];
```

### 핵심 알고리즘/로직 설명

**Naive LCA (Parent Traversal):**

```typescript
function findLCA(tree: FractalTree, pathA: string, pathB: string): string {
  const ancestorsA = new Set(getAncestorPaths(tree, pathA));

  for (const ancestor of getAncestorPaths(tree, pathB)) {
    if (ancestorsA.has(ancestor)) return ancestor;
  }

  return tree.root;
}
```

**최적 배치 제안 (`suggestPlacement`):**

```typescript
function suggestPlacement(tree: FractalTree, dependencies: string[]): string {
  if (dependencies.length === 0) return tree.root;
  if (dependencies.length === 1) {
    const node = tree.nodes.get(dependencies[0]);
    return node?.parent ?? tree.root;
  }

  let deepestLCA = tree.root;
  let maxDepth = 0;

  for (let i = 0; i < dependencies.length; i++) {
    for (let j = i + 1; j < dependencies.length; j++) {
      const lca = findLCA(tree, dependencies[i], dependencies[j]);
      const lcaNode = tree.nodes.get(lca);
      if (lcaNode && lcaNode.depth > maxDepth) {
        maxDepth = lcaNode.depth;
        deepestLCA = lca;
      }
    }
  }

  return deepestLCA;
}
```

**사용 예시:** `lca-calculator`는 MCP 도구 `suggest-module-placement`에서 활용된다. 개발자가 "이 함수를 어디에 배치해야 하나?"라고 물으면, 해당 함수를 사용하는 모듈들의 LCA를 계산하여 최적 위치를 제안한다.

### 의존하는 모듈

- 확장된 `fractal-tree` (FractalTree 타입, getAncestors 활용)

---

## Module 9: drift-detector

**파일:** `src/core/drift-detector.ts` (신규 추가)
**구현 우선순위:** Phase 2.5

### 책임 및 역할

`fractal-validator`의 `RuleEvaluationResult`를 분석하여 현재 구조와 이상적 구조 사이의 이격(drift)을 `DriftItem` 목록으로 정량화한다. 각 위반에 대해 `DriftSeverity`를 계산하고, 실행 가능한 `SyncPlan`을 생성한다. config-loader 의존 없이 동작한다.

### 주요 함수 시그니처

```typescript
import type {
  FractalTree,
  DriftResult,
  DriftItem,
  DriftSeverity,
  SyncPlan,
  RuleViolation,
  RuleEvaluationResult,
  DetectDriftOptions,
} from '../types/index.js';

/**
 * FractalTree를 분석하여 구조 이격을 감지하고 DriftResult를 반환한다.
 *
 * @param tree - 이격을 감지할 프랙탈 트리
 * @param options - 감지 옵션 (criticalOnly, generatePlan)
 * @returns 이격 감지 결과 (항목 목록, 심각도별 집계, 타임스탬프)
 */
export function detectDrift(
  tree: FractalTree,
  options?: DetectDriftOptions,
): DriftResult;

/**
 * 규칙 평가 결과를 DriftItem 목록으로 변환한다.
 *
 * @param tree - 참조할 프랙탈 트리
 * @param rules - 규칙 평가 결과
 * @returns DriftItem 배열 (심각도 내림차순 정렬)
 */
export function compareCurrent(
  tree: FractalTree,
  rules: RuleEvaluationResult,
): DriftItem[];

/**
 * RuleViolation의 심각도를 DriftSeverity로 변환한다.
 *
 * @param violation - 변환할 규칙 위반 항목
 * @returns 대응하는 DriftSeverity
 */
export function calculateSeverity(violation: RuleViolation): DriftSeverity;

/**
 * DriftItem 목록을 분석하여 실행 가능한 SyncPlan을 생성한다.
 *
 * @param drifts - 보정할 이격 항목 목록
 * @returns 실행 계획 (액션 목록, 예상 변경 수, 위험도)
 */
export function generateSyncPlan(drifts: DriftItem[]): SyncPlan;
```

### 핵심 알고리즘/로직 설명

**RuleViolation → DriftItem 매핑:**

```typescript
const RULE_TO_ACTION: Record<string, SyncAction> = {
  'naming-convention':       'rename',
  'organ-no-claudemd':       'move',
  'index-barrel-pattern':    'create-index',
  'module-entry-point':      'create-index',
  'max-depth':               'merge',
  'circular-dependency':     'move',
  'pure-function-isolation': 'move',
};
```

**심각도 계산:**
- `circular-dependency` (error) → `critical`
- `pure-function-isolation` (error) → `critical`
- `max-depth` (error) → `high`
- `organ-no-claudemd` (error) → `high`
- `index-barrel-pattern` (warning) → `medium`
- `module-entry-point` (warning) → `medium`
- `naming-convention` (warning) → `low`

**SyncPlan 정렬 전략:**
1. `critical` → `high` → `medium` → `low` 순으로 정렬
2. 같은 심각도 내에서는 `reversible: true` 액션 우선 (안전한 작업 먼저)
3. `move` → `rename` → `create-*` → `split` → `merge` 순서로 선행 처리

### 의존하는 모듈

- `fractal-validator`

---

## Module 10: project-analyzer

**파일:** `src/core/project-analyzer.ts` (신규 추가)
**구현 우선순위:** Phase 2.6 (최후 — 모든 모듈에 의존)

### 책임 및 역할

scan → validate → drift detect → report 파이프라인을 오케스트레이션하는 최상위 모듈. MCP 도구와 Hook 스크립트가 이 모듈을 통해 분석을 수행한다. 건강도 점수(0~100)를 계산하고 다양한 형식의 보고서를 생성한다.

### 주요 함수 시그니처

```typescript
import type { AnalysisReport, AnalyzeOptions, RenderedReport, OutputConfig } from '../types/index.js';

/**
 * 프로젝트 루트에서 시작하여 전체 분석 파이프라인을 실행한다.
 *
 * 파이프라인:
 * 1. fractal-tree.scanProject() → ScanReport (DEFAULT_SCAN_OPTIONS 직접 사용)
 * 2. fractal-validator.validateStructure() → ValidationReport
 * 3. drift-detector.detectDrift() → DriftReport (options.includeDrift)
 * 4. calculateHealthScore() → summary.healthScore
 *
 * @param root - 분석할 프로젝트 루트의 절대 경로
 * @param options - 분석 옵션 (detailed, includeDrift, generateSyncPlan)
 * @returns 종합 분석 보고서
 */
export async function analyzeProject(
  root: string,
  options?: AnalyzeOptions,
): Promise<AnalysisReport>;

/**
 * AnalysisReport를 지정된 형식으로 렌더링한다.
 *
 * @param analysis - 렌더링할 분석 보고서
 * @param outputConfig - 형식, 상세 수준, 컬러 설정
 * @returns 렌더링된 보고서 문자열과 메타정보
 */
export function generateReport(
  analysis: AnalysisReport,
  outputConfig: OutputConfig,
): RenderedReport;

/**
 * AnalysisReport에서 건강도 점수(0~100)를 계산한다.
 *
 * 계산 공식:
 * base = 100
 * - error violations: -5점씩 (최대 -50)
 * - warning violations: -2점씩 (최대 -20)
 * - critical drifts: -10점씩 (최대 -30)
 * - high drifts: -5점씩 (최대 -20)
 * 최솟값: 0
 */
export function calculateHealthScore(report: AnalysisReport): number;

export function renderTextReport(analysis: AnalysisReport, config: OutputConfig): string;
export function renderMarkdownReport(analysis: AnalysisReport): string;
```

### 핵심 알고리즘/로직 설명

**파이프라인 실행 흐름:**

```typescript
async function analyzeProject(root: string, options?: AnalyzeOptions): Promise<AnalysisReport> {
  const opts = { detailed: true, includeDrift: true, generateSyncPlan: false, ...options };

  // 1. 스캔 (DEFAULT_SCAN_OPTIONS 직접 사용, config-loader 불필요)
  const scanStart = Date.now();
  const tree = await scanProject(root);
  const modules = await analyzeAllModules(tree); // module-main-analyzer 일괄 실행
  const scanReport: ScanReport = {
    tree, modules,
    timestamp: new Date().toISOString(),
    duration: Date.now() - scanStart,
  };

  // 2. 검증
  const validationReport = validateStructure(tree);

  // 3. 이격 감지 (옵션)
  const driftReport = opts.includeDrift
    ? buildDriftReport(tree, { generatePlan: opts.generateSyncPlan })
    : emptyDriftReport();

  // 5. 종합
  const summary = {
    totalModules: tree.totalNodes,
    violations: validationReport.result.violations.length,
    drifts: driftReport.drift.totalDrifts,
    healthScore: 0,
  };
  const report: AnalysisReport = { scan: scanReport, validation: validationReport, drift: driftReport, summary };
  report.summary.healthScore = calculateHealthScore(report);

  return report;
}
```

**건강도 점수 계산:**

```typescript
function calculateHealthScore(report: AnalysisReport): number {
  let score = 100;

  const { violations } = report.validation.result;
  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  score -= Math.min(errorCount * 5, 50);
  score -= Math.min(warningCount * 2, 20);

  const { bySeverity } = report.drift.drift;
  score -= Math.min((bySeverity.critical ?? 0) * 10, 30);
  score -= Math.min((bySeverity.high ?? 0) * 5, 20);

  return Math.max(0, score);
}
```

**text 보고서 예시 출력:**

```
filid v2 Analysis Report
═══════════════════════════════════════
Root: /Users/dev/my-project
Scanned: 2026-02-22T09:00:00Z | Duration: 342ms

Summary
───────────────────────────────────────
Total Modules  : 24
Violations     : 3 (2 errors, 1 warning)
Drifts         : 2
Health Score   : 78 / 100

Violations
───────────────────────────────────────
[ERROR] circular-dependency
  src/features/auth → src/features/user → src/features/auth
  Suggestion: Extract shared logic to src/shared/

[ERROR] pure-function-isolation
  src/utils/format.ts imports from src/features/auth
  Suggestion: Move format.ts to src/features/auth/utils/

[WARN] index-barrel-pattern
  src/components/index.ts has 2 direct declarations
  Suggestion: Extract declarations to separate files

Drifts
───────────────────────────────────────
[HIGH] src/features/auth — circular-dependency
  Expected: No circular imports
  Actual:   Circular: auth → user → auth
  Action:   move

[MEDIUM] src/components/index.ts — index-barrel-pattern
  Expected: Pure re-export barrel
  Actual:   Contains 2 declarations
  Action:   create-index
```

### 의존하는 모듈

모든 모듈에 의존 (최상위 오케스트레이터):
- `fractal-tree` (확장된 scanProject 포함)
- `module-main-analyzer`
- `fractal-validator`
- `drift-detector`

---

## 디렉토리 구조 (Phase 2 완료 후)

```
packages/filid/src/core/
├── organ-classifier.ts       ← 기존 수정 (구조 기반 분류로 전환, config 의존 제거)
├── fractal-tree.ts           ← 기존 확장 (scanProject, buildTree, shouldExclude 추가)
├── document-validator.ts     ← 기존 유지
├── dependency-graph.ts       ← 기존 유지
├── change-queue.ts           ← 기존 유지
├── index-analyzer.ts         ← 신규 추가 (Phase 2.1)
├── module-main-analyzer.ts   ← 신규 추가 (Phase 2.2)
├── rule-engine.ts            ← 신규 추가 (Phase 2.3)
├── fractal-validator.ts      ← 신규 추가 (Phase 2.4)
├── lca-calculator.ts         ← 신규 추가 (Phase 2.4)
├── drift-detector.ts         ← 신규 추가 (Phase 2.5)
└── project-analyzer.ts       ← 신규 추가 (Phase 2.6)
```

각 모듈의 테스트는 `packages/filid/src/__tests__/core/<module-name>.test.ts`에 작성한다.

---

## 모듈 간 의존 관계 매트릭스

| 모듈 | organ-classifier | index-analyzer | fractal-tree | module-main-analyzer | rule-engine | fractal-validator | lca-calculator | drift-detector |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| organ-classifier | — | | | | | | | |
| index-analyzer | | — | | | | | | |
| fractal-tree | 사용 | | — | | | | | |
| module-main-analyzer | | 사용 | | — | | | | |
| rule-engine | | | | | — | | | |
| fractal-validator | | | 사용 | | 사용 | — | | |
| lca-calculator | | | 사용 | | | | — | |
| drift-detector | | | | | | 사용 | | — |
| project-analyzer | | | 사용 | 사용 | | 사용 | | 사용 |
