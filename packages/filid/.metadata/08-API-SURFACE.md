# 08. 전체 공개 API 표면

> `src/index.ts`에서 export하는 모든 함수, 클래스, 타입과 MCP 도구 스키마의 종합 레퍼런스.

---

## Export 요약

| 카테고리 | 함수/클래스 | 타입 | 합계 |
|----------|-------------|------|------|
| Core | 10 | 7 | 17 |
| Metrics | 4 | 7 | 11 |
| Compression | 3 | 1 | 4 |
| AST | 5 | 8 | 13 |
| Hooks | 5 | 7 | 12 |
| MCP | 6 | 0 | 6 |
| **합계** | **33** | **30** | **63** |

---

## Core 모듈

### document-validator

```typescript
function validateClaudeMd(content: string): ClaudeMdValidation
```
CLAUDE.md 내용을 검증한다. 100줄 제한 + 3-tier 경계 섹션 검사.

```typescript
function validateSpecMd(content: string, oldContent?: string): SpecMdValidation
```
SPEC.md 내용을 검증한다. `oldContent` 제공 시 append-only 감지.

### organ-classifier

```typescript
function classifyNode(input: ClassifyInput): NodeType
```
디렉토리를 fractal / organ / pure-function으로 분류한다.

```typescript
function isOrganDirectory(dirName: string): boolean
```
디렉토리명이 Organ 패턴에 매칭되는지 검사한다.

```typescript
const ORGAN_DIR_NAMES: readonly string[]
```
9개 Organ 디렉토리명 상수 배열.

### fractal-tree

```typescript
function buildFractalTree(entries: NodeEntry[]): FractalTree
```
`NodeEntry` 배열로부터 프랙탈 트리를 구축한다. 경로 기반 부모-자식 관계 자동 추론.

```typescript
function findNode(tree: FractalTree, path: string): FractalNode | undefined
```
경로로 노드를 탐색한다.

```typescript
function getAncestors(tree: FractalTree, path: string): FractalNode[]
```
주어진 경로의 조상 노드를 리프 → 루트 순서로 반환한다.

```typescript
function getDescendants(tree: FractalTree, path: string): FractalNode[]
```
주어진 경로의 모든 프랙탈/순수함수 자손을 반환한다 (organ 제외).

### dependency-graph

```typescript
function buildDAG(edges: DependencyEdge[]): DependencyDAG
```
엣지 배열로부터 DAG를 구축한다.

```typescript
function topologicalSort(dag: DependencyDAG): string[] | null
```
Kahn 알고리즘 기반 위상 정렬. 사이클 존재 시 `null` 반환.

```typescript
function detectCycles(dag: DependencyDAG): string[][]
```
DFS 기반 사이클 감지. 사이클 경로 배열 반환.

```typescript
function getDirectDependencies(dag: DependencyDAG, node: string): string[]
```
노드의 직접 의존성 (나가는 엣지) 반환. 중복 제거.

### change-queue

```typescript
class ChangeQueue {
  enqueue(record: ChangeRecord): void
  drain(): ChangeRecord[]
  peek(): ChangeRecord[]
  getChangesByPath(): Map<string, ChangeRecord[]>
  getAffectedFractals(): string[]
  clear(): void
  size(): number
  isEmpty(): boolean
}
```
PR 시점 배치 동기화를 위한 변경 큐. 누적된 파일 변경 기록을 관리한다.

---

## Metrics 모듈

### test-counter

```typescript
function countTestCases(file: RawTestFile): TestCaseCount
```
테스트 파일의 `it`/`test`/`it.each`/`test.each` 케이스를 카운트한다.
`describe` 중첩 깊이에 따라 basic/complex 분류.

### three-plus-twelve

```typescript
function check312Rule(files: TestCaseCount[]): ThreePlusTwelveResult
```
spec 파일들의 3+12 규칙 위반을 검사한다. `test` 파일은 무시.

### decision-tree

```typescript
function decide(input: DecisionInput): DecisionResult
```
FCA-AI 의사결정 트리. `testCount` → `LCOM4` → `CC` 순서로 평가하여
`ok` / `split` / `compress` / `parameterize` 액션 반환.

### promotion-tracker

```typescript
function checkPromotionEligibility(
  input: PromotionInput,
  stabilityThreshold?: number
): PromotionCandidate
```
test.ts → spec.ts 승격 자격을 검사한다. 기본 안정 기간 90일.

---

## Compression 모듈

### reversible-compactor

```typescript
function compactReversible(input: CompactInput): CompactResult
```
파일 내용을 3줄 레퍼런스(`[REF]`, `[EXPORTS]`, `[LINES]`)로 압축한다.
원본 파일은 디스크에 유지되므로 완전 복원 가능.

```typescript
function restoreFromCompacted(compacted: string): RestoredReference
```
압축된 레퍼런스 문자열을 파싱하여 `filePath`와 `exports` 추출.

### lossy-summarizer

```typescript
function summarizeLossy(entries: ToolCallEntry[]): LossySummaryResult
```
도구 호출 이력을 집계 통계로 압축한다. 개별 엔트리는 복원 불가능.
`toolCounts`, `uniqueFiles`, `timeRange` 반환.

---

## AST 분석 모듈

### parser

```typescript
function parseSource(source: string, filePath?: string): ts.SourceFile
```
소스 코드 문자열을 TypeScript AST `SourceFile`로 파싱한다.
`filePath` 확장자에 따라 JS/TS `ScriptKind` 자동 결정.

```typescript
function parseFile(filePath: string): ts.SourceFile
```
디스크에서 파일을 읽어 AST로 파싱한다.

### dependency-extractor

```typescript
function extractDependencies(source: string, filePath?: string): DependencyInfo
```
소스 코드에서 import/export/call 3종 의존성을 추출한다.
- `imports`: 모듈 경로, specifier 목록, type-only 여부, 줄 번호
- `exports`: 이름, type-only, default 여부, 줄 번호
- `calls`: callee 표현식 (`path.dirname` 형식), 줄 번호

### lcom4

```typescript
function extractClassInfo(source: string, className: string): ClassInfo | null
```
클래스의 필드와 메서드, 메서드별 필드 접근 정보를 추출한다.

```typescript
function calculateLCOM4(source: string, className: string): LCOM4Result
```
LCOM4를 계산한다. 메서드 간 공유 필드 기반 무방향 그래프 → BFS → connected components 개수.

### cyclomatic-complexity

```typescript
function calculateCC(source: string, filePath?: string): CyclomaticComplexityResult
```
모든 함수의 Cyclomatic Complexity를 계산한다.
결정 포인트: `if`, `for`, `for-in`, `for-of`, `while`, `do-while`, `case`, `?:`, `&&`, `||`.

### tree-diff

```typescript
function computeTreeDiff(oldSource: string, newSource: string, filePath?: string): TreeDiffResult
```
두 소스 버전의 의미론적 diff를 계산한다.
최상위 선언(function, class, variable, interface, type) 대상.
공백 정규화로 포맷팅 변경은 무시.

---

## Hooks 모듈

### pre-tool-validator

```typescript
function validatePreToolUse(input: PreToolUseInput, oldSpecContent?: string): HookOutput
```
`PreToolUse` 이벤트 핸들러. Write 도구로 CLAUDE.md/SPEC.md 수정 시 검증.
CLAUDE.md: 100줄 초과 → 차단, 3-tier 누락 → 경고.
SPEC.md: append-only 감지 → 차단.

### organ-guard

```typescript
function guardOrganWrite(input: PreToolUseInput): HookOutput
```
Organ 디렉토리 내 CLAUDE.md 생성을 차단한다.
경로의 모든 부모 세그먼트를 `ORGAN_DIR_NAMES`와 비교.

### change-tracker _(disabled)_

```typescript
function trackChange(input: PostToolUseInput, queue: ChangeQueue): HookOutput
```
Write/Edit 후 파일 경로를 ChangeQueue에 기록한다.
Write → `created`, Edit → `modified`.

> **Note**: hooks.json에서 제거됨. 코드는 유지되지만 런타임에 실행되지 않음.

### agent-enforcer

```typescript
function enforceAgentRole(input: SubagentStartInput): HookOutput
```
서브에이전트 시작 시 역할별 도구 제한을 주입한다.
4개 역할: architect(RO), qa-reviewer(RO), implementer(SPEC scope), context-manager(docs only).

### context-injector

```typescript
function injectContext(input: UserPromptSubmitInput): HookOutput
```
매 사용자 프롬프트에 FCA-AI 규칙 리마인더를 주입한다. 차단하지 않음.

---

## MCP 도구

### createServer / startServer

```typescript
function createServer(): Server
```
FCA-AI MCP 서버를 생성하고 4개 도구를 등록한다.

```typescript
async function startServer(): Promise<void>
```
stdio 트랜스포트로 MCP 서버를 시작한다.

### MCP 도구 핸들러

```typescript
function handleAstAnalyze(input: AstAnalyzeInput): Record<string, unknown>
function handleFractalNavigate(input: FractalNavigateInput): FractalNavigateOutput
function handleDocCompress(input: DocCompressInput): DocCompressOutput
function handleTestMetrics(input: TestMetricsInput): TestMetricsOutput
```

---

## MCP 도구 스키마

### ast-analyze

```json
{
  "name": "ast-analyze",
  "required": ["source", "analysisType"],
  "properties": {
    "source":       "string — 분석할 소스 코드",
    "filePath":     "string — 가상 파일 경로",
    "analysisType": "enum: dependency-graph | lcom4 | cyclomatic-complexity | tree-diff | full",
    "className":    "string — lcom4 분석 시 필수",
    "oldSource":    "string — tree-diff 시 이전 소스"
  }
}
```

### fractal-navigate

```json
{
  "name": "fractal-navigate",
  "required": ["action", "path", "entries"],
  "properties": {
    "action":  "enum: classify | sibling-list | tree",
    "path":    "string — 대상 경로",
    "entries": "array — { name, path, type, hasClaudeMd, hasSpecMd }[]"
  }
}
```

### doc-compress

```json
{
  "name": "doc-compress",
  "required": ["mode"],
  "properties": {
    "mode":            "enum: reversible | lossy | auto",
    "filePath":        "string — reversible 모드용",
    "content":         "string — reversible 모드용",
    "exports":         "string[] — reversible 모드용",
    "toolCallEntries": "array — lossy 모드용 { tool, path, timestamp }[]"
  }
}
```

### test-metrics

```json
{
  "name": "test-metrics",
  "required": ["action"],
  "properties": {
    "action":        "enum: count | check-312 | decide",
    "files":         "array — count/check-312용 { filePath, content }[]",
    "decisionInput": "object — decide용 { testCount, lcom4, cyclomaticComplexity }"
  }
}
```

---

## 타입 정의

### Fractal 타입 (`types/fractal.ts`)

```typescript
type NodeType = 'fractal' | 'organ' | 'pure-function'

interface FractalNode {
  path: string; name: string; type: NodeType;
  parent: string | null; children: string[]; organs: string[];
  hasClaudeMd: boolean; hasSpecMd: boolean;
}

interface FractalTree { root: string; nodes: Map<string, FractalNode> }
interface DependencyEdge { from: string; to: string; type: 'import' | 'export' | 'call' | 'inheritance' }
interface DependencyDAG { nodes: Set<string>; edges: DependencyEdge[]; adjacency: Map<string, string[]> }
```

### Document 타입 (`types/documents.ts`)

```typescript
interface ThreeTierBoundary { alwaysDo: string[]; askFirst: string[]; neverDo: string[] }
interface ClaudeMdSchema { name: string; purpose: string; commands: Record<string, string>; structure: Record<string, string>; boundaries: ThreeTierBoundary; dependencies: string[]; lineCount: number }
interface SpecMdSchema { title: string; requirements: string[]; apiContracts: string[]; lastUpdated: string; compressionMeta?: CompressionMeta }
interface CompressionMeta { method: 'reversible' | 'lossy'; originalLines: number; compressedLines: number; timestamp: string; recoverable: boolean }
interface ClaudeMdValidation { valid: boolean; violations: DocumentViolation[] }
interface SpecMdValidation { valid: boolean; violations: DocumentViolation[] }
interface DocumentViolation { rule: 'line-limit' | 'deduplication' | 'append-only' | 'missing-boundaries' | 'missing-section'; message: string; severity: 'error' | 'warning' }
```

### Metrics 타입 (`types/metrics.ts`)

```typescript
interface LCOM4Result { value: number; components: string[][]; methodCount: number; fieldCount: number }
interface CyclomaticComplexityResult { value: number; perFunction: Map<string, number>; fileTotal: number }
interface TestCaseCount { filePath: string; fileType: 'spec' | 'test'; total: number; basic: number; complex: number }
interface ThreePlusTwelveResult { violated: boolean; files: TestCaseCount[]; violatingFiles: string[] }
type DecisionAction = 'split' | 'compress' | 'parameterize' | 'ok'
interface DecisionResult { action: DecisionAction; reason: string; metrics: { testCount: number; lcom4: number; cyclomaticComplexity: number } }
interface PromotionCandidate { testFilePath: string; specFilePath: string; stableDays: number; lastFailure: string | null; eligible: boolean; caseCount: number }
```

### Hook 타입 (`types/hooks.ts`)

```typescript
interface HookBaseInput { cwd: string; session_id: string; hook_event_name: string }
interface PreToolUseInput extends HookBaseInput { tool_name: string; tool_input: { file_path?: string; path?: string; content?: string; old_string?: string; new_string?: string; [key: string]: unknown } }
interface PostToolUseInput extends HookBaseInput { tool_name: string; tool_input: { file_path?: string; path?: string; [key: string]: unknown }; tool_response: { [key: string]: unknown } }
interface SubagentStartInput extends HookBaseInput { agent_type: string; agent_id: string }
interface UserPromptSubmitInput extends HookBaseInput { prompt?: string }
interface HookOutput { continue: boolean; hookSpecificOutput?: { additionalContext?: string } }
type HookInput = PreToolUseInput | PostToolUseInput | SubagentStartInput | UserPromptSubmitInput
```

### AST 타입 (`types/ast.ts`)

```typescript
interface ImportInfo { source: string; specifiers: string[]; isTypeOnly: boolean; line: number }
interface ExportInfo { name: string; isTypeOnly: boolean; isDefault: boolean; line: number }
interface CallInfo { callee: string; line: number }
interface DependencyInfo { filePath: string; imports: ImportInfo[]; exports: ExportInfo[]; calls: CallInfo[] }
interface MethodInfo { name: string; accessedFields: string[] }
interface ClassInfo { name: string; methods: MethodInfo[]; fields: string[] }
interface TreeDiffChange { type: 'added' | 'removed' | 'modified'; kind: string; name: string; oldLine?: number; newLine?: number }
interface TreeDiffResult { changes: TreeDiffChange[]; hasSemanticChanges: boolean; formattingOnlyChanges: number }
```

---

## 관련 문서

- [07-RULES-REFERENCE.md](./07-RULES-REFERENCE.md) — 상수 및 임계값 레퍼런스
- [02-BLUEPRINT.md](./02-BLUEPRINT.md) — 모듈별 기술 청사진
- [06-HOW-IT-WORKS.md](./06-HOW-IT-WORKS.md) — 내부 동작 메커니즘
