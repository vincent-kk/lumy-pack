# Phase 2: Core Modules — 핵심 비즈니스 로직

holon의 10개 core 모듈 상세 명세. 각 모듈의 책임, 함수 시그니처, 알고리즘, 의존 관계, 구현 순서를 정의한다.

---

## 구현 순서 다이어그램

```
config-loader (Phase 2.1)
    ↓
category-classifier (Phase 2.2)    index-analyzer (Phase 2.2)
    ↓                                    ↓
fractal-scanner (Phase 2.3)      module-main-analyzer (Phase 2.3)
    ↓                                    ↓
    └──────────┬─────────────────────────┘
               ↓
rule-engine (Phase 2.4)
    ↓
fractal-validator (Phase 2.5)    lca-calculator (Phase 2.5)
    ↓                                    ↓
drift-detector (Phase 2.6)
    ↓
project-analyzer (Phase 2.7)
```

**구현 원칙:**
- 각 모듈은 `src/core/<module-name>.ts`에 위치한다.
- 모든 public 함수는 순수 함수(pure function)를 지향한다. 부작용은 명시적 파라미터로 처리한다.
- 모듈 간 의존은 단방향이어야 한다 (순환 의존 금지).
- 각 모듈은 독립적으로 테스트 가능해야 한다.

---

## Module 1: config-loader

**파일:** `src/core/config-loader.ts`
**구현 우선순위:** Phase 2.1 (최우선 — 모든 모듈이 의존)

### 책임 및 역할

4단계 설정 소스(default → project → user → cli)를 순서대로 로드하고 깊은 병합(deep merge)하여 최종 `HolonConfig`를 반환한다. YAML 파싱에는 `yaml` 패키지를, 스키마 검증에는 Zod를 사용한다. 파일이 없거나 파싱에 실패해도 기본값으로 안전하게 폴백한다.

### 주요 함수 시그니처

```typescript
import type { HolonConfig, LoadConfigOptions, ResolvedConfig } from '../types/index.js';
import type { HolonrcSchema } from '../types/index.js';
import { z } from 'zod';

/**
 * 프로젝트의 전체 설정을 로드한다.
 *
 * 로드 순서: default → project (.holonrc.yml) → user (~/.holonrc.yml) → cli
 * 각 단계는 이전 단계를 깊은 병합으로 오버라이드한다.
 *
 * @param options - 로드 옵션 (projectRoot, cliOverrides, homeDir)
 * @returns 병합된 최종 설정과 소스별 로드 성공 여부
 */
export async function loadConfig(options?: LoadConfigOptions): Promise<ResolvedConfig>;

/**
 * YAML 문자열을 파싱하고 HolonrcSchema로 검증한다.
 *
 * @param content - .holonrc.yml 파일의 원시 문자열
 * @returns 검증된 파셜 설정 객체
 * @throws ZodError — 스키마 위반 시 (단, 상위에서 catch하여 기본값으로 폴백)
 */
export function parseHolonrc(content: string): z.infer<typeof HolonrcSchema>;

/**
 * 여러 파셜 설정을 순서대로 깊은 병합한다.
 * 배열 필드는 concatenate가 아닌 replace 전략을 사용한다.
 *
 * @param sources - 낮은 우선순위부터 순서대로 전달
 * @returns 병합된 완전한 HolonConfig (모든 필드가 채워진 상태)
 */
export function mergeConfigs(...sources: Partial<HolonConfig>[]): HolonConfig;

/**
 * 코드에 하드코딩된 기본 설정을 반환한다.
 * HolonrcSchema의 Zod default 값을 기반으로 한다.
 *
 * @returns 완전한 기본 HolonConfig
 */
export function getDefaultConfig(): HolonConfig;

/**
 * 주어진 경로에서 .holonrc.yml 파일을 읽어 파셜 설정을 반환한다.
 * 파일이 없으면 undefined를 반환한다 (에러를 던지지 않는다).
 *
 * @param filePath - .holonrc.yml의 절대 경로
 * @returns 파셜 설정 또는 undefined
 */
export async function readConfigFile(
  filePath: string,
): Promise<Partial<HolonConfig> | undefined>;
```

### 핵심 알고리즘/로직 설명

**설정 로드 파이프라인:**

```
1. getDefaultConfig()                    → base
2. readConfigFile(projectRoot/.holonrc.yml) → projectConfig (없으면 {})
3. readConfigFile(homeDir/.holonrc.yml)     → userConfig    (없으면 {})
4. cliOverrides                             → cliConfig     (없으면 {})
5. mergeConfigs(base, projectConfig, userConfig, cliConfig) → final
```

**깊은 병합 전략 (`mergeConfigs`):**
- 스칼라 값: 나중 소스가 우선
- 객체: 재귀적 깊은 병합
- 배열: 나중 소스가 전체 교체 (concat하지 않음 — 사용자가 exclude 패턴을 완전히 교체할 수 있도록)
- `undefined` 값은 병합에서 무시 (이전 값 유지)

**에러 처리:** 파일 읽기 실패 또는 Zod 검증 실패 시 경고를 로깅하고 해당 소스를 건너뜀. 전체 프로세스는 기본값으로 안전하게 완료.

### 의존하는 모듈

없음 (최우선 구현 대상)

---

## Module 2: category-classifier

**파일:** `src/core/category-classifier.ts`
**구현 우선순위:** Phase 2.2

### 책임 및 역할

디렉토리 항목(파일 목록, 이름)을 분석하여 `CategoryType`을 결정한다. 분류 우선순위: 명시적 config 매핑 > organ 이름 패턴 > pure-function 판정 > 기본 fractal. `micromatch`를 사용해 glob 패턴 매칭을 수행한다.

### 주요 함수 시그니처

```typescript
import type { CategoryType, HolonConfig } from '../types/index.js';

/**
 * 디렉토리를 CategoryType으로 분류한다.
 *
 * 분류 우선순위 (높은 순):
 * 1. config.categories.customMappings에 경로가 명시된 경우
 * 2. 이름이 config.categories.organNames 목록에 있는 경우 → 'organ'
 * 3. isPureFunctionModule() 판정 → 'pure-function'
 * 4. 기본값 → 'fractal'
 *
 * @param path - 분류할 디렉토리의 프로젝트 루트 기준 상대 경로
 * @param entries - 해당 디렉토리에 포함된 파일/디렉토리 이름 목록
 * @param config - 현재 holon 설정
 * @returns 결정된 CategoryType
 */
export function classifyDirectory(
  path: string,
  entries: string[],
  config: HolonConfig,
): CategoryType;

/**
 * 디렉토리 이름이 organ 패턴에 해당하는지 판정한다.
 *
 * @param name - 디렉토리명 (경로의 마지막 segment)
 * @param config - organNames 목록을 포함한 holon 설정
 * @returns organ이면 true
 */
export function isOrganDirectory(name: string, config: HolonConfig): boolean;

/**
 * 디렉토리가 pure-function 모듈 조건을 충족하는지 판정한다.
 *
 * pure-function 조건:
 * - 하위에 디렉토리(중첩 모듈)가 없다
 * - TypeScript/JavaScript 파일만 포함한다
 * - 내부 파일들이 상위 프랙탈 디렉토리를 import하지 않는다 (정적 분석)
 *
 * @param path - 판정할 디렉토리의 절대 경로
 * @param entries - 해당 디렉토리의 파일 목록
 * @returns pure-function 조건 충족 시 true
 */
export function isPureFunctionModule(path: string, entries: string[]): boolean;

/**
 * customMappings에서 주어진 경로에 매칭되는 CategoryType을 찾는다.
 * micromatch를 사용한 glob 패턴 매칭을 수행한다.
 *
 * @param path - 검사할 경로
 * @param customMappings - 패턴 → CategoryType 맵
 * @returns 매칭된 CategoryType 또는 undefined
 */
export function findCustomMapping(
  path: string,
  customMappings: Record<string, CategoryType>,
): CategoryType | undefined;
```

### 핵심 알고리즘/로직 설명

**분류 흐름:**

```
classifyDirectory(path, entries, config)
  │
  ├─ 1. customMappings에서 micromatch 패턴 매칭
  │      → 매칭되면 즉시 반환
  │
  ├─ 2. isOrganDirectory(basename(path), config)
  │      → organNames 배열에 포함되면 'organ' 반환
  │
  ├─ 3. isPureFunctionModule(path, entries)
  │      → 하위 디렉토리 없고, ts/js만 있으면 'pure-function' 반환
  │
  └─ 4. 기본값 'fractal' 반환
```

**micromatch 패턴 매칭 예시:**
```yaml
# .holonrc.yml
categories:
  customMappings:
    "src/shared/**": pure-function
    "packages/*/src/utils": organ
```

### 의존하는 모듈

- `config-loader` (HolonConfig 타입 사용)

---

## Module 3: index-analyzer

**파일:** `src/core/index-analyzer.ts`
**구현 우선순위:** Phase 2.2 (category-classifier와 병렬)

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
 * 규칙: 직접 하위 .ts 파일 또는 하위 디렉토리의 index.ts가
 * 현재 index.ts에서 re-export되어야 한다.
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
/** analyzeIndex의 반환 타입 */
export interface IndexAnalysis {
  /** index.ts의 절대 경로 */
  filePath: string;

  /** 추출된 export 목록 */
  exports: ExportInfo[];

  /** barrel 패턴 분석 결과 */
  barrelPattern: BarrelPattern;

  /** 파일 존재 여부 (없으면 false) */
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

**barrel 패턴 판정:** `declarationCount === 0` 이면 pure barrel. `declarationCount > 0` 이면 혼합 패턴으로 경고.

### 의존하는 모듈

없음 (독립 모듈)

---

## Module 4: fractal-scanner

**파일:** `src/core/fractal-scanner.ts`
**구현 우선순위:** Phase 2.3

### 책임 및 역할

프로젝트 디렉토리를 순회하여 `FractalTree`를 구축한다. `fast-glob`으로 디렉토리 목록을 수집하고, `category-classifier`로 각 노드를 분류하며, 부모-자식 관계를 연결한다. include/exclude 패턴을 적용하고 maxDepth를 준수한다.

### 주요 함수 시그니처

```typescript
import type { FractalTree, FractalNode, DirEntry, HolonConfig, ScanConfig } from '../types/index.js';

/**
 * 프로젝트 루트에서 시작하여 FractalTree를 구축한다.
 * 내부적으로 fast-glob으로 디렉토리를 나열하고
 * category-classifier로 각 노드를 분류한다.
 *
 * @param root - 프로젝트 루트의 절대 경로
 * @param config - 스캔 및 분류 설정
 * @returns 완성된 FractalTree
 */
export async function scanProject(root: string, config: HolonConfig): Promise<FractalTree>;

/**
 * DirEntry 목록에서 FractalTree를 조립한다.
 * 경로 기반으로 부모-자식 관계를 결정하고 노드를 연결한다.
 *
 * @param root - 트리 루트 경로
 * @param entries - scanProject가 수집한 전체 DirEntry 목록
 * @param config - 분류에 사용할 holon 설정
 * @returns 조립된 FractalTree
 */
export function buildTree(root: string, entries: DirEntry[], config: HolonConfig): FractalTree;

/**
 * 디렉토리를 비동기 제너레이터로 순회한다.
 * fast-glob을 사용하며 include/exclude 패턴 및 maxDepth를 적용한다.
 *
 * @param path - 순회 시작 디렉토리의 절대 경로
 * @param config - ScanConfig (include, exclude, maxDepth, followSymlinks)
 * @yields DirEntry — 발견된 각 파일/디렉토리
 */
export async function* walkDirectory(
  path: string,
  config: ScanConfig,
): AsyncGenerator<DirEntry>;

/**
 * 스캔에서 제외해야 하는 경로인지 판정한다.
 * micromatch를 사용한 glob 패턴 매칭.
 *
 * @param path - 검사할 경로 (루트 기준 상대 경로)
 * @param config - ScanConfig
 * @returns 제외 대상이면 true
 */
export function shouldExclude(path: string, config: ScanConfig): boolean;
```

### 핵심 알고리즘/로직 설명

**트리 구축 알고리즘:**

```
scanProject(root, config)
  │
  ├─ 1. fast-glob으로 모든 디렉토리 나열 (파일 제외)
  │      glob: '**/', options: { cwd: root, deep: maxDepth, ignore: exclude }
  │
  ├─ 2. 각 디렉토리에 대해 buildNode() 호출
  │      - category-classifier.classifyDirectory() → CategoryType
  │      - fs.existsSync(dir/index.ts) → hasIndex
  │      - fs.existsSync(dir/main.ts)  → hasMain
  │      - depth = path.split('/').length - root.split('/').length
  │
  ├─ 3. buildTree()로 노드 간 관계 연결
  │      - 각 노드의 parent = 가장 가까운 상위 경로
  │      - parent.children.push(node.path) — fractal 노드인 경우
  │      - parent.organs.push(node.path)   — organ 노드인 경우
  │
  └─ 4. FractalTree 반환
         { root, nodes: Map, depth: maxDepth, totalNodes }
```

**부모 경로 결정:**
```typescript
// '/a/b/c/d' 의 부모는 '/a/b/c' (단순 dirname)
// 단, '/a/b/c' 가 nodes에 없으면 '/a/b', '/a', root 순으로 탐색
function findParentPath(nodePath: string, nodes: Map<string, FractalNode>): string | null;
```

### 의존하는 모듈

- `category-classifier`
- `config-loader` (HolonConfig 타입)

---

## Module 5: module-main-analyzer

**파일:** `src/core/module-main-analyzer.ts`
**구현 우선순위:** Phase 2.3 (fractal-scanner와 병렬)

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

**파일:** `src/core/rule-engine.ts`
**구현 우선순위:** Phase 2.4

### 책임 및 역할

내장 규칙(builtin rules)을 로드하고, FractalTree의 모든 노드에 대해 규칙을 평가하여 `RuleEvaluationResult`를 반환한다. 규칙은 순수 함수이므로 병렬 평가가 가능하다. config의 `rules.enabled`와 `rules.severity`로 각 규칙을 on/off 및 심각도 조정한다.

### 주요 함수 시그니처

```typescript
import type { Rule, RuleEvaluationResult, RuleViolation, RuleContext, FractalTree, HolonConfig } from '../types/index.js';

/**
 * 모든 내장 규칙 인스턴스를 생성하여 반환한다.
 * 각 규칙은 config로 활성화 여부와 severity를 조정하기 전의 기본 상태이다.
 *
 * @returns 내장 규칙 전체 목록
 */
export function loadBuiltinRules(): Rule[];

/**
 * FractalTree의 모든 노드에 대해 활성화된 규칙을 평가한다.
 * config.rules.enabled로 비활성 규칙을 건너뛴다.
 * config.rules.severity로 각 규칙의 기본 심각도를 오버라이드한다.
 *
 * @param tree - 검증할 프랙탈 트리
 * @param config - 규칙 활성화 및 심각도 오버라이드 포함 설정
 * @returns 전체 평가 결과 (violations, passed, failed, skipped, duration)
 */
export function evaluateRules(tree: FractalTree, config: HolonConfig): RuleEvaluationResult;

/**
 * 단일 노드에 단일 규칙을 적용한다.
 * 규칙의 check() 함수를 호출하고 config의 severity 오버라이드를 적용한다.
 *
 * @param rule - 적용할 규칙
 * @param context - 규칙 컨텍스트 (node, tree, config)
 * @returns 위반 목록 (없으면 빈 배열)
 */
export function evaluateRule(rule: Rule, context: RuleContext): RuleViolation[];

/**
 * 규칙을 config 설정에 맞게 조정한다.
 * enabled 오버라이드와 severity 오버라이드를 적용하여 새 Rule 인스턴스를 반환한다.
 *
 * @param rule - 원본 규칙
 * @param config - 오버라이드 설정
 * @returns 조정된 규칙 (원본 불변)
 */
export function applyRuleConfig(rule: Rule, config: HolonConfig): Rule;
```

### 핵심 알고리즘/로직 설명

**7개 내장 규칙 정의:**

| Rule ID | 카테고리 | 기본 심각도 | 설명 |
|---------|---------|------------|------|
| `naming-convention` | naming | warning | 디렉토리/파일명이 kebab-case 또는 camelCase를 따르는지 |
| `organ-no-claudemd` | structure | error | organ 노드에 CLAUDE.md가 없어야 한다 (organ은 독립 문서화 금지) |
| `index-barrel-pattern` | index | warning | fractal 노드의 index.ts가 순수 barrel(re-export만)이어야 한다 |
| `module-entry-point` | module | warning | 모든 fractal 노드에 index.ts 또는 main.ts가 존재해야 한다 |
| `max-depth` | structure | error | 프랙탈 깊이가 config.scanning.maxDepth를 초과하면 안 된다 |
| `circular-dependency` | dependency | error | 모듈 간 순환 의존이 없어야 한다 |
| `pure-function-isolation` | dependency | error | pure-function 노드는 상위 fractal 모듈을 import하면 안 된다 |

**평가 루프:**

```typescript
function evaluateRules(tree: FractalTree, config: HolonConfig): RuleEvaluationResult {
  const start = Date.now();
  const rules = loadBuiltinRules().map(r => applyRuleConfig(r, config));
  const violations: RuleViolation[] = [];
  let passed = 0, failed = 0, skipped = 0;

  for (const [, node] of tree.nodes) {
    const context: RuleContext = { node, tree, config };
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
DFS로 의존 그래프를 탐색하며 방문 스택에서 이미 방문한 노드를 재방문하면 순환으로 판정.

### 의존하는 모듈

- `config-loader` (HolonConfig 타입)

---

## Module 7: fractal-validator

**파일:** `src/core/fractal-validator.ts`
**구현 우선순위:** Phase 2.5

### 책임 및 역할

`rule-engine`과 `fractal-scanner`를 조합하여 구조 검증을 오케스트레이션한다. 노드별 검증과 트리 전체(의존 관계) 검증을 수행하고, `ValidationReport`를 생성한다.

### 주요 함수 시그니처

```typescript
import type { FractalTree, FractalNode, RuleContext, RuleViolation, HolonConfig, ValidationReport } from '../types/index.js';

/**
 * FractalTree 전체를 검증하고 ValidationReport를 반환한다.
 * rule-engine.evaluateRules()를 호출하고 결과를 보고서로 래핑한다.
 *
 * @param tree - 검증할 프랙탈 트리
 * @param config - 검증에 사용할 holon 설정
 * @returns 검증 보고서 (규칙 평가 결과 + 설정 스냅샷 + 타임스탬프)
 */
export function validateStructure(tree: FractalTree, config: HolonConfig): ValidationReport;

/**
 * 단일 노드를 컨텍스트와 함께 검증한다.
 * rule-engine의 각 규칙을 적용하여 위반 목록을 반환한다.
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
```typescript
function detectCycles(tree: FractalTree): string[][] {
  // 방문 상태: 'unvisited' | 'visiting' | 'visited'
  const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
  const cycles: string[][] = [];

  function dfs(nodePath: string, stack: string[]): void {
    state.set(nodePath, 'visiting');
    stack.push(nodePath);

    const node = tree.nodes.get(nodePath);
    for (const dep of node?.organs ?? []) {
      if (state.get(dep) === 'visiting') {
        // 스택에서 순환 구간 추출
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
- `fractal-scanner` (FractalTree 타입)

---

## Module 8: lca-calculator

**파일:** `src/core/lca-calculator.ts`
**구현 우선순위:** Phase 2.5 (fractal-validator와 병렬)

### 책임 및 역할

Lowest Common Ancestor(최근접 공통 조상) 계산을 통해 모듈의 최적 배치 위치를 제안한다. 여러 모듈에서 공유되는 코드를 어느 레벨의 fractal에 배치할지 결정하는 데 사용한다. Naive parent traversal 방식으로 구현한다 (트리 크기가 충분히 작아 Euler tour + sparse table 불필요).

### 주요 함수 시그니처

```typescript
import type { FractalTree } from '../types/index.js';

/**
 * 두 노드의 Lowest Common Ancestor(LCA)를 반환한다.
 * 루트 방향으로 부모를 따라 올라가며 공통 조상을 찾는다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param pathA - 첫 번째 노드의 경로
 * @param pathB - 두 번째 노드의 경로
 * @returns LCA 노드의 경로. 같은 노드이면 그 노드를, 없으면 root 반환
 * @throws Error — pathA 또는 pathB가 트리에 없는 경우
 */
export function findLCA(tree: FractalTree, pathA: string, pathB: string): string;

/**
 * 여러 의존 모듈을 분석하여 공유 코드를 배치할 최적 fractal 레벨을 제안한다.
 *
 * 알고리즘: 모든 의존 모듈 쌍의 LCA를 계산하고, 가장 깊은(낮은 레벨) 공통 조상을 선택.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param dependencies - 배치 위치를 결정할 의존 모듈 경로 목록
 * @returns 최적 배치 fractal 노드의 경로
 */
export function suggestPlacement(tree: FractalTree, dependencies: string[]): string;

/**
 * 트리에서 두 노드 간의 거리를 계산한다.
 * 거리 = (depth_A - depth_LCA) + (depth_B - depth_LCA)
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param from - 시작 노드의 경로
 * @param to - 목적지 노드의 경로
 * @returns 두 노드 간의 트리 거리 (엣지 수)
 */
export function calculateDistance(tree: FractalTree, from: string, to: string): number;

/**
 * 노드에서 루트까지의 조상 경로 배열을 반환한다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param nodePath - 시작 노드의 경로
 * @returns [nodePath, parent, grandparent, ..., root] 순서의 경로 배열
 */
export function getAncestors(tree: FractalTree, nodePath: string): string[];
```

### 핵심 알고리즘/로직 설명

**Naive LCA (Parent Traversal):**

```typescript
function findLCA(tree: FractalTree, pathA: string, pathB: string): string {
  // 두 노드에서 루트까지의 조상 집합을 구한다
  const ancestorsA = new Set(getAncestors(tree, pathA));

  // pathB에서 루트 방향으로 올라가며 ancestorsA에서 처음 만나는 노드가 LCA
  for (const ancestor of getAncestors(tree, pathB)) {
    if (ancestorsA.has(ancestor)) return ancestor;
  }

  return tree.root; // 항상 루트가 공통 조상
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

  // 모든 쌍의 LCA를 계산 → 가장 깊은(depth가 큰) LCA 선택
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

- `fractal-scanner` (FractalTree 타입)

---

## Module 9: drift-detector

**파일:** `src/core/drift-detector.ts`
**구현 우선순위:** Phase 2.6

### 책임 및 역할

`fractal-validator`의 `RuleEvaluationResult`를 분석하여 현재 구조와 이상적 구조 사이의 이격(drift)을 `DriftItem` 목록으로 정량화한다. 각 위반에 대해 `DriftSeverity`를 계산하고, 실행 가능한 `SyncPlan`을 생성한다.

### 주요 함수 시그니처

```typescript
import type { FractalTree, HolonConfig, DriftResult, DriftItem, DriftSeverity, SyncPlan, RuleViolation, RuleEvaluationResult, DetectDriftOptions } from '../types/index.js';

/**
 * FractalTree를 분석하여 구조 이격을 감지하고 DriftResult를 반환한다.
 * 내부적으로 fractal-validator를 호출하여 규칙 위반을 수집한다.
 *
 * @param tree - 이격을 감지할 프랙탈 트리
 * @param config - 규칙 및 이격 감지 설정
 * @param options - 감지 옵션 (criticalOnly, generatePlan)
 * @returns 이격 감지 결과 (항목 목록, 심각도별 집계, 타임스탬프)
 */
export function detectDrift(
  tree: FractalTree,
  config: HolonConfig,
  options?: DetectDriftOptions,
): DriftResult;

/**
 * 규칙 평가 결과를 DriftItem 목록으로 변환한다.
 * RuleViolation을 DriftItem으로 매핑하며 expected/actual 설명을 생성한다.
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
 * 변환 규칙:
 * - RuleSeverity 'error' + 구조적 위반 → 'critical'
 * - RuleSeverity 'error'              → 'high'
 * - RuleSeverity 'warning'            → 'medium'
 * - RuleSeverity 'info'               → 'low'
 *
 * @param violation - 변환할 규칙 위반 항목
 * @returns 대응하는 DriftSeverity
 */
export function calculateSeverity(violation: RuleViolation): DriftSeverity;

/**
 * DriftItem 목록을 분석하여 실행 가능한 SyncPlan을 생성한다.
 * 각 이격 항목에 대해 적절한 SyncAction을 결정하고 실행 순서를 정렬한다.
 *
 * @param drifts - 보정할 이격 항목 목록
 * @returns 실행 계획 (액션 목록, 예상 변경 수, 위험도)
 */
export function generateSyncPlan(drifts: DriftItem[]): SyncPlan;
```

### 핵심 알고리즘/로직 설명

**RuleViolation → DriftItem 매핑:**

각 `RuleViolation`은 위반한 `ruleId`를 기반으로 적절한 `SyncAction`이 결정된다:

```typescript
const RULE_TO_ACTION: Record<string, SyncAction> = {
  'naming-convention':       'rename',
  'organ-no-claudemd':       'move',        // CLAUDE.md를 상위로 이동
  'index-barrel-pattern':    'create-index', // 올바른 barrel index.ts 생성
  'module-entry-point':      'create-index', // index.ts 생성
  'max-depth':               'merge',        // 깊은 모듈 병합
  'circular-dependency':     'move',         // 의존 방향 역전
  'pure-function-isolation': 'move',         // 격리 위반 모듈 이동
};
```

**SyncPlan 정렬 전략:**
1. `critical` → `high` → `medium` → `low` 순으로 정렬
2. 같은 심각도 내에서는 `reversible: true` 액션 우선 (안전한 작업 먼저)
3. `move` → `rename` → `create-*` → `split` → `merge` 순서로 선행 처리

**심각도 계산 상세:**
- `circular-dependency` (error) → `critical` (구조 붕괴)
- `pure-function-isolation` (error) → `critical`
- `max-depth` (error) → `high`
- `organ-no-claudemd` (error) → `high`
- `index-barrel-pattern` (warning) → `medium`
- `module-entry-point` (warning) → `medium`
- `naming-convention` (warning) → `low`

### 의존하는 모듈

- `fractal-validator`
- `config-loader` (HolonConfig 타입)

---

## Module 10: project-analyzer

**파일:** `src/core/project-analyzer.ts`
**구현 우선순위:** Phase 2.7 (최후 — 모든 모듈에 의존)

### 책임 및 역할

scan → validate → drift detect → report 파이프라인을 오케스트레이션하는 최상위 모듈. MCP 도구와 Hook 스크립트가 이 모듈을 통해 분석을 수행한다. 건강도 점수(0~100)를 계산하고 다양한 형식의 보고서를 생성한다.

### 주요 함수 시그니처

```typescript
import type { AnalysisReport, AnalyzeOptions, RenderedReport, OutputConfig } from '../types/index.js';

/**
 * 프로젝트 루트에서 시작하여 전체 분석 파이프라인을 실행한다.
 *
 * 파이프라인:
 * 1. config-loader.loadConfig()
 * 2. fractal-scanner.scanProject() → ScanReport
 * 3. fractal-validator.validateStructure() → ValidationReport
 * 4. drift-detector.detectDrift() → DriftReport (options.includeDrift)
 * 5. calculateHealthScore() → summary.healthScore
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
 * - 'text': 터미널 출력용 (ANSI 컬러 선택적)
 * - 'json': JSON.stringify (pretty-print)
 * - 'markdown': GitHub/문서 렌더링용
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
 *
 * @param report - 계산할 분석 보고서
 * @returns 0~100 사이의 건강도 점수
 */
export function calculateHealthScore(report: AnalysisReport): number;

/**
 * text 형식으로 보고서를 렌더링한다. generateReport의 내부 구현.
 *
 * @param analysis - 렌더링할 보고서
 * @param config - 출력 설정
 * @returns 렌더링된 문자열
 */
export function renderTextReport(analysis: AnalysisReport, config: OutputConfig): string;

/**
 * markdown 형식으로 보고서를 렌더링한다. generateReport의 내부 구현.
 *
 * @param analysis - 렌더링할 보고서
 * @returns 렌더링된 마크다운 문자열
 */
export function renderMarkdownReport(analysis: AnalysisReport): string;
```

### 핵심 알고리즘/로직 설명

**파이프라인 실행 흐름:**

```typescript
async function analyzeProject(root: string, options?: AnalyzeOptions): Promise<AnalysisReport> {
  const opts = { detailed: true, includeDrift: true, generateSyncPlan: false, ...options };

  // 1. 설정 로드
  const { config } = await loadConfig({ projectRoot: root });

  // 2. 스캔
  const scanStart = Date.now();
  const tree = await scanProject(root, config);
  const modules = await analyzeAllModules(tree); // module-main-analyzer 일괄 실행
  const scanReport: ScanReport = {
    tree, modules,
    timestamp: new Date().toISOString(),
    duration: Date.now() - scanStart,
  };

  // 3. 검증
  const validationReport = validateStructure(tree, config);

  // 4. 이격 감지 (옵션)
  const driftReport = opts.includeDrift
    ? buildDriftReport(tree, config, { generatePlan: opts.generateSyncPlan })
    : emptyDriftReport();

  // 5. 종합
  const summary = {
    totalModules: tree.totalNodes,
    violations: validationReport.result.violations.length,
    drifts: driftReport.drift.totalDrifts,
    healthScore: 0, // 아래서 계산
  };
  const report: AnalysisReport = { scan: scanReport, validation: validationReport, drift: driftReport, summary };
  report.summary.healthScore = calculateHealthScore(report);

  return report;
}
```

**건강도 점수 계산 공식:**

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
Holon Analysis Report
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
- `config-loader`
- `fractal-scanner`
- `module-main-analyzer`
- `fractal-validator`
- `drift-detector`

---

## 디렉토리 구조 (Phase 2 완료 후)

```
packages/holon/src/core/
├── config-loader.ts          # Phase 2.1
├── category-classifier.ts    # Phase 2.2
├── index-analyzer.ts         # Phase 2.2
├── fractal-scanner.ts        # Phase 2.3
├── module-main-analyzer.ts   # Phase 2.3
├── rule-engine.ts            # Phase 2.4
├── fractal-validator.ts      # Phase 2.5
├── lca-calculator.ts         # Phase 2.5
├── drift-detector.ts         # Phase 2.6
└── project-analyzer.ts       # Phase 2.7
```

각 모듈의 테스트는 `src/__tests__/core/<module-name>.test.ts`에 작성한다.

---

## 모듈 간 의존 관계 매트릭스

| 모듈 | config-loader | category-classifier | index-analyzer | fractal-scanner | module-main-analyzer | rule-engine | fractal-validator | lca-calculator | drift-detector |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| config-loader | — | | | | | | | | |
| category-classifier | 사용 | — | | | | | | | |
| index-analyzer | | | — | | | | | | |
| fractal-scanner | 사용 | 사용 | | — | | | | | |
| module-main-analyzer | | | 사용 | | — | | | | |
| rule-engine | 사용 | | | | | — | | | |
| fractal-validator | | | | 사용 | | 사용 | — | | |
| lca-calculator | | | | 사용 | | | | — | |
| drift-detector | 사용 | | | | | | 사용 | | — |
| project-analyzer | 사용 | | | 사용 | 사용 | | 사용 | | 사용 |
