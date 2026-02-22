# Phase 3 — MCP 서버

## 1. 서버 구조

### 1.1 server.ts

`createServer()` 함수가 MCP `Server` 인스턴스를 생성하고, `ListToolsRequestSchema`와 `CallToolRequestSchema` 두 개의 요청 핸들러를 등록한다. filid 패턴을 그대로 따른다.

**핵심 설계 결정:**

- `TOOL_DEFINITIONS` 배열을 모듈 상단에 상수로 선언하여 `ListToolsRequestSchema` 핸들러에서 직접 반환한다.
- `CallToolRequestSchema` 핸들러는 `switch (name)` 구문으로 각 도구를 라우팅한다.
- `Map` 타입을 JSON으로 직렬화할 때 plain object로 변환하기 위해 `mapReplacer` 유틸리티를 사용한다 (filid에서 재사용).
- 에러 처리는 `try/catch`로 전체 핸들러를 감싸며, 에러 시 `{ isError: true }` 응답을 반환한다.
- 각 도구 핸들러는 `src/mcp/tools/` 하위의 개별 파일로 분리하고, `server.ts`에서 import하여 switch-case에서 호출한다.

```typescript
// src/mcp/server.ts 구조

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { handleFractalScan } from './tools/fractal-scan.js';
import { handleDriftDetect } from './tools/drift-detect.js';
import { handleLcaResolve } from './tools/lca-resolve.js';
import { handleRuleQuery } from './tools/rule-query.js';
import { handleStructureValidate } from './tools/structure-validate.js';

// Map → plain object 직렬화 유틸 (filid와 동일)
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}
```

**에러 처리 패턴:**

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: unknown;
    switch (name) {
      case 'fractal-scan':      result = await handleFractalScan(args); break;
      case 'drift-detect':      result = await handleDriftDetect(args); break;
      case 'lca-resolve':       result = await handleLcaResolve(args); break;
      case 'rule-query':        result = await handleRuleQuery(args); break;
      case 'structure-validate': result = await handleStructureValidate(args); break;
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, mapReplacer, 2) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
});
```

### 1.2 server-entry.ts

`startServer()`를 호출하는 단순 진입점이다. `StdioServerTransport`를 생성하여 서버에 연결하고, 프로세스가 stdio를 통해 MCP 클라이언트와 통신하도록 한다.

```typescript
// src/mcp/server-entry.ts

import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startServer().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
```

빌드 후 `libs/server.cjs`는 `server-entry.ts`를 esbuild로 번들링한 CJS 결과물이다.

---

## 2. 도구 정의

### 2.1 fractal-scan

**목적:** 주어진 경로에서 프로젝트 프랙탈 구조를 스캔하고 `ScanReport`를 반환한다. 가장 기본적인 진단 도구로, 다른 도구들의 입력 데이터를 제공하는 역할을 한다.

**inputSchema:**

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "스캔할 프로젝트 루트 디렉토리의 절대 경로"
    },
    "depth": {
      "type": "number",
      "description": "스캔할 최대 디렉토리 깊이. 기본값: 10",
      "minimum": 1,
      "maximum": 20
    },
    "includeModuleInfo": {
      "type": "boolean",
      "description": "각 모듈의 진입점(index.ts/main.ts) 분석 결과를 포함할지 여부. 기본값: false"
    }
  },
  "required": ["path"]
}
```

**핸들러 로직 (`tools/fractal-scan.ts`):**

1. `args.path`를 절대 경로로 정규화하고 존재 여부를 확인한다.
2. `config-loader.loadConfig(path)`로 `.holonrc.yml` 설정을 로드한다.
3. `fractal-scanner.scanProject(path, { depth, config })`를 호출하여 `FractalTree`를 빌드한다.
4. `includeModuleInfo`가 `true`이면 `module-main-analyzer.analyzeModules(tree)`로 각 노드의 진입점 정보를 추가한다.
5. 스캔 시작 시각과 완료 시각을 기록하여 `duration` 필드를 계산한다.
6. `ScanReport` 형태로 결과를 조립하여 반환한다.

**반환값 구조 (`ScanReport`):**

```typescript
interface ScanReport {
  tree: {
    root: string;           // 스캔 루트 경로
    nodes: Record<string, FractalNode>; // 경로 → 노드 (Map → plain object 직렬화)
    depth: number;          // 실제 최대 깊이
    totalNodes: number;     // 전체 노드 수
  };
  modules: ModuleInfo[];    // includeModuleInfo=true 시 채워짐
  timestamp: string;        // ISO 8601 스캔 완료 시각
  duration: number;         // 밀리초 단위 소요 시간
}

interface ModuleInfo {
  path: string;
  category: CategoryType;   // 'fractal' | 'organ' | 'pure-function' | 'hybrid'
  hasIndex: boolean;        // index.ts barrel export 존재 여부
  hasMain: boolean;         // main.ts/main.tsx 존재 여부
  exportCount: number;      // index.ts에서 export하는 심볼 수
}
```

---

### 2.2 drift-detect

**목적:** 현재 프로젝트 구조와 holon 규칙 사이의 이격(drift)을 감지한다. 각 이격 항목에는 기대값, 실제값, severity, 보정 액션 제안이 포함된다.

**inputSchema:**

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "이격을 검사할 프로젝트 루트 디렉토리의 절대 경로"
    },
    "severity": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low"],
      "description": "이 severity 이상의 이격만 반환. 기본값: 모든 severity 반환"
    },
    "generatePlan": {
      "type": "boolean",
      "description": "이격 해소를 위한 SyncPlan(액션 목록)을 함께 생성할지 여부. 기본값: false"
    }
  },
  "required": ["path"]
}
```

**핸들러 로직 (`tools/drift-detect.ts`):**

1. `config-loader.loadConfig(path)`로 설정을 로드한다.
2. `fractal-scanner.scanProject(path, { config })`로 현재 트리를 빌드한다.
3. `drift-detector.detectDrift(tree, config)`를 호출하여 `DriftResult`를 생성한다.
4. `severity` 필터가 지정된 경우 `DriftSeverity` 우선순위(`critical > high > medium > low`)에 따라 결과를 필터링한다.
5. `generatePlan`이 `true`이면 `generateSyncPlan(driftResult)`를 호출하여 각 `DriftItem`에 대응하는 `SyncAction` 목록을 생성한다.
6. 결과를 `DriftReport`로 조립하여 반환한다.

**반환값 구조 (`DriftReport`):**

```typescript
interface DriftReport {
  items: DriftItem[];             // 감지된 이격 목록
  totalDrifts: number;
  bySeverity: Record<DriftSeverity, number>;  // severity별 집계
  scanTimestamp: string;          // ISO 8601
  syncPlan?: SyncPlanItem[];      // generatePlan=true 시 포함
}

interface SyncPlanItem {
  action: SyncAction;             // 'move' | 'rename' | 'create-index' | 'create-main' | 'reclassify' | 'split' | 'merge'
  targetPath: string;
  description: string;
  estimatedRisk: 'safe' | 'moderate' | 'risky';
}
```

---

### 2.3 lca-resolve

**목적:** 두 모듈의 Lowest Common Ancestor(LCA)를 프랙탈 트리에서 계산하고, 새로운 공유 의존성을 배치할 최적 위치를 제안한다. 의존성을 어느 레이어에 두어야 하는지 결정할 때 사용한다.

**inputSchema:**

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "프로젝트 루트 디렉토리의 절대 경로 (FractalTree 빌드에 사용)"
    },
    "moduleA": {
      "type": "string",
      "description": "첫 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: 'src/features/auth')"
    },
    "moduleB": {
      "type": "string",
      "description": "두 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: 'src/features/payment')"
    }
  },
  "required": ["path", "moduleA", "moduleB"]
}
```

**핸들러 로직 (`tools/lca-resolve.ts`):**

1. `fractal-scanner.scanProject(path, { config })`로 `FractalTree`를 빌드한다.
2. `moduleA`와 `moduleB`를 절대 경로로 정규화하고 트리에 존재하는지 검증한다. 존재하지 않으면 에러를 반환한다.
3. `lca-calculator.findLCA(tree, moduleA, moduleB)`를 호출하여 LCA 노드를 찾는다. LCA는 두 노드의 공통 조상 중 가장 깊은 노드다.
4. `calculateDistance(tree, moduleA, lca)`와 `calculateDistance(tree, moduleB, lca)`로 각 모듈에서 LCA까지의 거리를 계산한다.
5. LCA의 `category`와 `depth`를 기반으로 `suggestedPlacement`를 결정한다:
   - LCA가 `fractal` 카테고리이면 `{lca}/shared/` 하위를 제안한다.
   - LCA가 프로젝트 루트이면 `src/shared/` 또는 `src/common/`을 제안한다.
6. 결과를 반환한다.

**반환값 구조:**

```typescript
interface LcaResolveResult {
  lca: string;                    // LCA 노드의 절대 경로
  lcaCategory: CategoryType;      // LCA 노드의 카테고리
  lcaDepth: number;               // 루트로부터의 깊이
  distanceA: number;              // moduleA → LCA 경로 거리 (엣지 수)
  distanceB: number;              // moduleB → LCA 경로 거리 (엣지 수)
  suggestedPlacement: string;     // 공유 의존성의 권장 배치 경로
  explanation: string;            // 제안 이유 설명
}
```

---

### 2.4 rule-query

**목적:** 현재 프로젝트에 적용되는 holon 규칙을 조회하거나, 특정 경로에 대한 규칙 준수 여부를 확인한다. 에이전트가 규칙을 이해하고 적용할 때 사용한다.

**inputSchema:**

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "get", "check"],
      "description": "'list': 전체 규칙 목록 반환 | 'get': 특정 규칙 상세 조회 | 'check': 경로의 규칙 준수 여부 확인"
    },
    "path": {
      "type": "string",
      "description": "프로젝트 루트 디렉토리의 절대 경로 (설정 로드에 사용)"
    },
    "ruleId": {
      "type": "string",
      "description": "action='get'일 때 조회할 규칙 ID (예: 'fractal-node-has-index')"
    },
    "category": {
      "type": "string",
      "enum": ["fractal", "organ", "pure-function", "hybrid", "structure", "dependency"],
      "description": "action='list'일 때 이 카테고리에 해당하는 규칙만 필터링"
    },
    "targetPath": {
      "type": "string",
      "description": "action='check'일 때 규칙을 검사할 대상 경로 (프로젝트 루트 기준 상대 경로)"
    }
  },
  "required": ["action", "path"]
}
```

**핸들러 로직 (`tools/rule-query.ts`):**

`action` 값에 따라 세 가지 경로로 분기한다.

- **`list`**: `config-loader.loadConfig(path)`로 설정을 로드하고 `rule-engine.getRules({ category })`로 규칙 목록을 반환한다. `category`가 지정된 경우 해당 카테고리 규칙만 필터링한다.
- **`get`**: `ruleId`가 필수다. `rule-engine.getRule(ruleId)`로 단일 규칙의 상세 정보(설명, 적용 조건, 예시)를 반환한다. 존재하지 않는 `ruleId`이면 에러를 반환한다.
- **`check`**: `targetPath`가 필수다. `category-classifier.classify(targetPath)`로 경로를 분류하고, `rule-engine.evaluatePath(targetPath, config)`로 해당 경로에 적용 가능한 모든 규칙의 준수 여부를 평가하여 `RuleEvaluationResult`를 반환한다.

**반환값 구조:**

```typescript
// action='list'
interface RuleListResult {
  rules: RuleSummary[];
  total: number;
  filtered: boolean;   // category 필터 적용 여부
}

interface RuleSummary {
  id: string;
  description: string;
  severity: RuleSeverity;       // 'error' | 'warning' | 'info'
  category: string;
  enabled: boolean;
}

// action='get'
interface RuleDetail extends RuleSummary {
  rationale: string;            // 규칙의 존재 이유
  appliesTo: string[];          // 적용 대상 카테고리 목록
  examples: { valid: string[]; invalid: string[] };
}

// action='check'
interface RuleEvaluationResult {
  path: string;
  category: CategoryType;
  violations: RuleViolation[];
  passed: number;
  failed: number;
  warnings: number;
}
```

---

### 2.5 structure-validate

**목적:** 프로젝트 전체 또는 특정 경로에 대해 프랙탈 구조 유효성을 종합 검증한다. 선택적으로 자동 수정(`fix`)을 시도할 수 있다.

**inputSchema:**

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "검증할 프로젝트 루트 디렉토리의 절대 경로"
    },
    "rules": {
      "type": "array",
      "items": { "type": "string" },
      "description": "검사할 규칙 ID 목록. 생략 시 모든 활성화된 규칙을 검사"
    },
    "fix": {
      "type": "boolean",
      "description": "자동 수정 가능한 위반 항목을 수정할지 여부. 기본값: false. true 설정 시 safe 등급 액션만 자동 실행"
    }
  },
  "required": ["path"]
}
```

**핸들러 로직 (`tools/structure-validate.ts`):**

1. `config-loader.loadConfig(path)`로 설정을 로드한다.
2. `fractal-scanner.scanProject(path, { config })`로 현재 트리를 빌드한다.
3. `fractal-validator.validateStructure(tree, config, { rules })`를 호출한다. `rules`가 지정된 경우 해당 규칙 ID만 평가한다.
4. `fix`가 `true`이면:
   - `estimatedRisk === 'safe'`인 위반 항목에 대해서만 자동 수정 액션을 실행한다.
   - 수정된 항목 목록을 `fixedItems`에 기록한다.
   - 자동 수정 후 재검증을 수행하여 잔여 위반 항목을 확인한다.
5. `ValidationReport`를 조립하여 반환한다.

**반환값 구조 (`ValidationReport`):**

```typescript
interface ValidationReport {
  result: RuleEvaluationResult;   // 전체 검증 결과
  config: {                       // 검증에 사용된 설정 요약
    configPath: string;
    rulesApplied: number;
    rulesSkipped: number;
  };
  fixedItems?: FixedItem[];       // fix=true일 때만 포함
  remainingViolations?: RuleViolation[]; // fix 후 잔여 위반 항목
  timestamp: string;              // ISO 8601
}

interface FixedItem {
  violation: RuleViolation;
  action: SyncAction;
  resultPath: string;
  success: boolean;
}
```

---

## 3. 서버 전체 코드 설계

### TOOL_DEFINITIONS 배열

`ListToolsRequestSchema` 핸들러에서 그대로 반환되는 도구 정의 배열 전체다.

```typescript
const TOOL_DEFINITIONS = [
  {
    name: 'fractal-scan',
    description:
      '프로젝트 디렉토리를 스캔하여 프랙탈 구조 트리(FractalTree)를 분석하고 ScanReport를 반환한다. ' +
      '각 디렉토리 노드를 fractal/organ/pure-function/hybrid로 분류하며, ' +
      'includeModuleInfo=true 설정 시 각 모듈의 진입점(index.ts, main.ts) 정보를 포함한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '스캔할 프로젝트 루트 디렉토리의 절대 경로',
        },
        depth: {
          type: 'number',
          description: '스캔할 최대 디렉토리 깊이. 기본값: 10',
          minimum: 1,
          maximum: 20,
        },
        includeModuleInfo: {
          type: 'boolean',
          description: '모듈 진입점 분석 결과 포함 여부. 기본값: false',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'drift-detect',
    description:
      '현재 프로젝트 구조와 holon 규칙 사이의 이격(drift)을 감지한다. ' +
      '각 이격 항목에는 기대값, 실제값, severity(critical/high/medium/low), ' +
      '보정 액션 제안(SyncAction)이 포함된다. ' +
      'generatePlan=true 시 이격 해소를 위한 SyncPlan을 함께 생성한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '이격을 검사할 프로젝트 루트 디렉토리의 절대 경로',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: '이 severity 이상의 이격만 반환. 생략 시 모든 severity 반환',
        },
        generatePlan: {
          type: 'boolean',
          description: '이격 해소 SyncPlan 생성 여부. 기본값: false',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'lca-resolve',
    description:
      '두 모듈의 Lowest Common Ancestor(LCA)를 프랙탈 트리에서 계산한다. ' +
      '새로운 공유 의존성을 어느 레이어에 배치해야 하는지 결정할 때 사용한다. ' +
      '각 모듈에서 LCA까지의 거리와 권장 배치 경로(suggestedPlacement)를 반환한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '프로젝트 루트 디렉토리의 절대 경로',
        },
        moduleA: {
          type: 'string',
          description: '첫 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: src/features/auth)',
        },
        moduleB: {
          type: 'string',
          description: '두 번째 모듈의 프로젝트 루트 기준 상대 경로 (예: src/features/payment)',
        },
      },
      required: ['path', 'moduleA', 'moduleB'],
    },
  },
  {
    name: 'rule-query',
    description:
      '현재 프로젝트에 적용되는 holon 규칙을 조회하거나, 특정 경로의 규칙 준수 여부를 확인한다. ' +
      "action='list'는 전체 규칙 목록, " +
      "action='get'은 특정 규칙 상세 정보, " +
      "action='check'는 경로의 규칙 평가 결과를 반환한다.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'check'],
          description: "수행할 동작: 'list' | 'get' | 'check'",
        },
        path: {
          type: 'string',
          description: '프로젝트 루트 디렉토리의 절대 경로',
        },
        ruleId: {
          type: 'string',
          description: "action='get'일 때 조회할 규칙 ID",
        },
        category: {
          type: 'string',
          enum: ['fractal', 'organ', 'pure-function', 'hybrid', 'structure', 'dependency'],
          description: "action='list'일 때 카테고리 필터",
        },
        targetPath: {
          type: 'string',
          description: "action='check'일 때 검사 대상 경로 (프로젝트 루트 기준 상대 경로)",
        },
      },
      required: ['action', 'path'],
    },
  },
  {
    name: 'structure-validate',
    description:
      '프로젝트 전체 또는 특정 규칙 집합에 대해 프랙탈 구조 유효성을 종합 검증한다. ' +
      '위반 항목 목록과 통과/실패/경고 수를 반환한다. ' +
      'fix=true 설정 시 safe 등급의 위반 항목을 자동으로 수정하고 잔여 위반 항목을 재보고한다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '검증할 프로젝트 루트 디렉토리의 절대 경로',
        },
        rules: {
          type: 'array',
          items: { type: 'string' },
          description: '검사할 규칙 ID 목록. 생략 시 모든 활성 규칙 검사',
        },
        fix: {
          type: 'boolean',
          description: 'safe 등급 위반 항목 자동 수정 여부. 기본값: false',
        },
      },
      required: ['path'],
    },
  },
];
```

### createServer 함수

```typescript
export function createServer(): Server {
  const server = new Server(
    { name: 'holon', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      let result: unknown;
      switch (name) {
        case 'fractal-scan':
          result = await handleFractalScan(args);
          break;
        case 'drift-detect':
          result = await handleDriftDetect(args);
          break;
        case 'lca-resolve':
          result = await handleLcaResolve(args);
          break;
        case 'rule-query':
          result = await handleRuleQuery(args);
          break;
        case 'structure-validate':
          result = await handleStructureValidate(args);
          break;
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result, mapReplacer, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
```

---

## 4. 빌드 설정 (`build-plugin.mjs` 참고)

MCP 서버는 esbuild로 단일 CJS 번들로 번들링된다. `server-entry.ts`를 진입점으로 하여 `libs/server.cjs`를 생성한다.

```javascript
// build-plugin.mjs — MCP 서버 번들 설정 부분
await esbuild.build({
  entryPoints: ['src/mcp/server-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'libs/server.cjs',
  banner: { js: '#!/usr/bin/env node' },
  external: [],  // 완전 번들 (node_modules 포함)
});
```

`.mcp.json` 설정:

```json
{
  "mcpServers": {
    "holon": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/libs/server.cjs"],
      "env": {}
    }
  }
}
```
