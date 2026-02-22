# 06. 내부 동작 메커니즘 상세

> Hook 파이프라인, AST 분석 엔진, 의사결정 트리, MCP 도구 라우팅, 압축 메커니즘의 심층 해설.

---

## Hook 파이프라인 상세

### 전체 이벤트 흐름

```
사용자 프롬프트 입력
        │
        ▼
┌─ UserPromptSubmit ──────────────────────────────────┐
│  context-injector.mjs (timeout: 5s)                  │
│  → FCA-AI 규칙 리마인더 ~200자 주입                    │
│  → 항상 continue: true (차단 없음)                     │
└──────────────────────────────────────────────────────┘
        │
        ▼ (에이전트가 Write/Edit 도구 호출 시)
        │
┌─ PreToolUse (matcher: Write|Edit) ──────────────────┐
│  1. pre-tool-validator.mjs (timeout: 3s)             │
│     ├─ CLAUDE.md Write → validateClaudeMd()          │
│     │   ├─ 100줄 초과 → continue: false (BLOCKED)    │
│     │   └─ 3-tier 누락 → continue: true + 경고       │
│     ├─ SPEC.md Write → validateSpecMd()              │
│     │   └─ append-only → continue: false (BLOCKED)   │
│     └─ 기타 → continue: true (통과)                   │
│                                                       │
│  2. structure-guard.mjs (timeout: 3s)                 │
│     ├─ Write + CLAUDE.md + Organ 경로                 │
│     │   └─ continue: false (BLOCKED)                  │
│     └─ 기타 → continue: true (통과)                   │
└──────────────────────────────────────────────────────┘
        │ (통과 시)
        ▼
┌─ Tool 실행 (파일 Write/Edit) ───────────────────────┐
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ PostToolUse ────────────────────────────────────────┐
│  (disabled — change-tracker removed from hooks.json)  │
│  No active PostToolUse hooks.                         │
└──────────────────────────────────────────────────────┘
        │
        ▼ (서브에이전트 생성 시)
        │
┌─ SubagentStart (matcher: *) ────────────────────────┐
│  agent-enforcer.mjs (timeout: 3s)                    │
│  → agent_type 확인                                    │
│  → ROLE_RESTRICTIONS[type] 존재 시                    │
│     additionalContext에 역할 제한 메시지 주입           │
│  → 항상 continue: true (차단 없음, 지시만 주입)        │
└──────────────────────────────────────────────────────┘
```

### Hook 입출력 프로토콜

**입력** (stdin JSON):
```json
{
  "cwd": "/path/to/project",
  "session_id": "abc-123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/CLAUDE.md",
    "content": "..."
  }
}
```

**출력** (stdout JSON):

통과:
```json
{ "continue": true }
```

경고 포함 통과:
```json
{
  "continue": true,
  "hookSpecificOutput": {
    "additionalContext": "CLAUDE.md is missing 3-tier boundary sections: Ask first"
  }
}
```

차단:
```json
{
  "continue": false,
  "hookSpecificOutput": {
    "additionalContext": "BLOCKED: CLAUDE.md exceeds 100-line limit (142 lines). Compress or deduplicate content."
  }
}
```

### Hook 엔트리 실행 패턴

모든 엔트리 스크립트(`scripts/*.mjs`)는 동일한 패턴:

```
Node.js 프로세스 시작
    │
    ▼
stdin에서 전체 데이터 수집 (Buffer[] chunks)
    │
    ▼
JSON.parse → typed input 객체
    │
    ▼
핸들러 함수 호출 (순수 함수)
    │
    ▼
JSON.stringify → stdout 출력
    │
    ▼
프로세스 종료
```

esbuild 번들이므로 외부 의존성 없이 단일 파일로 실행됨.
단, `typescript` 패키지는 MCP 서버에서만 사용되며 Hook 스크립트에는 포함되지 않음.

---

## AST 분석 엔진

### TypeScript Compiler API 기반 파서

```
소스 코드 문자열
    │
    ▼
ts.createSourceFile(filePath, source, ScriptTarget.Latest, true, scriptKind)
    │
    ├─ filePath.endsWith('.js' | '.mjs') → ScriptKind.JS
    └─ 기타 → ScriptKind.TS
    │
    ▼
ts.SourceFile (AST 루트 노드)
    │
    ├── statements[] ─── 최상위 선언들
    │     ├── ImportDeclaration
    │     ├── ExportDeclaration
    │     ├── FunctionDeclaration
    │     ├── ClassDeclaration
    │     ├── VariableStatement
    │     ├── InterfaceDeclaration
    │     └── TypeAliasDeclaration
    │
    └── setParentNodes: true ─── 부모 노드 참조 활성화
```

### 의존성 추출 파이프라인

```
ts.SourceFile
    │
    ▼  ts.forEachChild(node, visit) 재귀
    │
    ├── ImportDeclaration
    │     ├─ moduleSpecifier.text → source
    │     ├─ importClause.name → default import
    │     ├─ namedBindings (NamedImports) → named imports
    │     └─ namedBindings (NamespaceImport) → * as ns
    │
    ├── ExportDeclaration
    │     └─ exportClause (NamedExports) → 각 element
    │
    ├── hasExportModifier(node)
    │     ├─ FunctionDeclaration → name
    │     ├─ ClassDeclaration → name
    │     ├─ VariableStatement → declarationList.declarations[].name
    │     ├─ TypeAliasDeclaration → name
    │     └─ InterfaceDeclaration → name
    │
    └── CallExpression
          └─ getCalleeText(expression)
                ├─ Identifier → text ("readFile")
                └─ PropertyAccessExpression → 재귀 ("path.dirname")
```

### LCOM4 계산 과정

```
1. 클래스 탐색
   ts.forEachChild(sourceFile, node => ClassDeclaration?)
       │
       ▼
2. 필드 수집
   members.filter(PropertyDeclaration) → fields[]
       │
       ▼
3. 메서드 수집 + 필드 접근 추적
   members.filter(MethodDeclaration) → 각 메서드에 대해:
       body 내 모든 PropertyAccessExpression 탐색
       expression === ThisKeyword → name.text → accessedFields[]
       │
       ▼
4. 무방향 그래프 구축
   모든 메서드 쌍(i, j)에 대해:
       methods[i].accessedFields ∩ methods[j].accessedFields ≠ ∅
       → 엣지 추가 (양방향)
       │
       ▼
5. Connected Components (BFS)
   visited = Set<string>
   각 미방문 메서드에서 BFS 시작
       queue → neighbors → component[]
       │
       ▼
6. LCOM4 = components.length
   1: 높은 응집도 | >=2: split 필요 | 0: 메서드 없음
```

### Cyclomatic Complexity 계산

```
함수/메서드 body 노드
    │
    ▼
cc = 1 (base complexity)
    │
    ▼  AST 노드 순회 (재귀)
    │
    ├── IfStatement → cc++
    ├── ForStatement → cc++
    ├── ForInStatement → cc++
    ├── ForOfStatement → cc++
    ├── WhileStatement → cc++
    ├── DoStatement → cc++
    ├── ConditionalExpression (?:) → cc++
    ├── CaseClause (non-default) → cc++
    └── BinaryExpression
          ├── && (AmpersandAmpersandToken) → cc++
          └── || (BarBarToken) → cc++
    │
    ▼
결과: cc 값 (1 = 선형, 높을수록 복잡)
```

### Semantic Tree Diff 과정

```
oldSource, newSource
    │
    ▼
extractDeclarations(source):
    최상위 선언만 추출:
    - FunctionDeclaration → kind: 'function'
    - ClassDeclaration → kind: 'class'
    - VariableStatement → kind: 'variable'
    - InterfaceDeclaration → kind: 'interface'
    - TypeAliasDeclaration → kind: 'type'

    각 선언에 대해:
    - name: 식별자 이름
    - normalized: getText().replace(/\s+/g, '') ← 공백 완전 제거
    - line: 줄 번호
    │
    ▼
oldMap = Map<name, DeclSignature>
newMap = Map<name, DeclSignature>
    │
    ▼
비교:
    oldMap에 있고 newMap에 없음 → 'removed'
    oldMap과 newMap 모두 존재, normalized 다름 → 'modified'
    newMap에 있고 oldMap에 없음 → 'added'
    │
    ▼
포맷팅 전용 변경:
    changes.length === 0 && oldSource.trim() !== newSource.trim()
    → formattingOnlyChanges = 1
```

---

## 의사결정 트리 엔진

### 4단계 파이프라인 상세

```
입력: { testCount: number, lcom4: number, cyclomaticComplexity: number }

┌──────────────────────────────────────────────────────┐
│ Phase 1: 임계값 검사                                   │
│                                                       │
│   testCount <= 15 (TEST_THRESHOLD)?                   │
│   YES → return { action: 'ok', ... }                  │
│   NO  → Phase 2로                                     │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│ Phase 2: 응집도 검사                                   │
│                                                       │
│   lcom4 >= 2 (LCOM4_SPLIT_THRESHOLD)?                │
│   YES → return { action: 'split', ... }               │
│          "SRP 위반, 하위 프랙탈로 추출"                  │
│   NO  → Phase 3로                                     │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│ Phase 3: 복잡도 검사                                   │
│                                                       │
│   cyclomaticComplexity > 15 (CC_THRESHOLD)?           │
│   YES → return { action: 'compress', ... }            │
│          "메서드 추출, 전략 패턴, 조건 평탄화"            │
│   NO  → Phase 4로                                     │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│ Phase 4: 매개변수화                                    │
│                                                       │
│   return { action: 'parameterize', ... }              │
│   "중복 에지케이스를 데이터 기반 테스트로 병합"            │
└──────────────────────────────────────────────────────┘
```

### 각 액션의 의미

| 액션 | 의미 | 코드 영향 | 테스트 영향 |
|------|------|-----------|------------|
| `ok` | 조치 불필요 | 없음 | 없음 |
| `split` | 모듈 분할 | 하위 프랙탈 디렉토리 생성, CLAUDE.md/SPEC.md 분리 | 각 하위 프랙탈에 spec.ts 분배 |
| `compress` | 코드 압축 | 메서드 추출, 전략 패턴, 조건 평탄화 | 기존 테스트 유지 |
| `parameterize` | 테스트 병합 | 없음 | 중복 테스트를 `test.each`/`it.each`로 병합 |

---

## MCP 도구 라우팅

### 서버 구조

```
server-entry.ts
    │ startServer()
    ▼
server.ts
    │ createServer()
    ▼
Server (MCP SDK)
    ├── ListToolsRequestSchema → TOOL_DEFINITIONS (4개 도구 스키마)
    └── CallToolRequestSchema → switch(name)
            ├── 'ast-analyze' → handleAstAnalyze(args)
            ├── 'fractal-navigate' → handleFractalNavigate(args)
            ├── 'doc-compress' → handleDocCompress(args)
            └── 'test-metrics' → handleTestMetrics(args)
```

### 도구별 내부 라우팅

**ast-analyze**:
```
analysisType switch:
├── 'dependency-graph' → extractDependencies()
├── 'lcom4' → calculateLCOM4() (className 필수)
├── 'cyclomatic-complexity' → calculateCC()
├── 'tree-diff' → computeTreeDiff()
└── 'full' → extractDependencies() + calculateCC() + (optional)calculateLCOM4()
```

**fractal-navigate**:
```
action switch:
├── 'classify' → classifyNode() (경로에서 디렉토리명 추출)
├── 'sibling-list' → buildFractalTree() → findNode(parent) → 형제 필터
└── 'tree' → buildFractalTree() (전체 트리 반환)
```

**doc-compress**:
```
mode switch:
├── 'reversible' → compactReversible() (filePath + content 필수)
├── 'lossy' → summarizeLossy() (toolCallEntries)
└── 'auto' → inferMode() → content있으면 reversible, entries있으면 lossy
```

**test-metrics**:
```
action switch:
├── 'count' → files.map(countTestCases())
├── 'check-312' → countTestCases() + check312Rule()
└── 'decide' → decide(decisionInput)
```

### JSON 직렬화 처리

`Map` 객체는 `JSON.stringify`의 기본 직렬화에서 `{}`로 변환되므로,
`mapReplacer` 함수를 사용:

```typescript
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}
```

`CyclomaticComplexityResult.perFunction` (Map) 등이 올바르게 직렬화됨.

---

## 압축 메커니즘

### 가역적 압축 (Reversible)

```
입력:
  filePath: "/src/core/fractal-tree.ts"
  content: "... (129줄 소스 코드) ..."
  metadata: { exports: ["buildFractalTree", "findNode", ...], lineCount: 129 }

처리:
  1. originalLines = content.split('\n').filter(l => l.length > 0).length
  2. exportsStr = exports.join(', ')
  3. compacted = 3줄 레퍼런스 생성

출력:
  "[REF] /src/core/fractal-tree.ts"
  "[EXPORTS] buildFractalTree, findNode, getAncestors, getDescendants"
  "[LINES] 129"

복원:
  restoreFromCompacted(compacted) →
  { filePath: "/src/core/fractal-tree.ts", exports: ["buildFractalTree", ...] }
  실제 파일 내용은 디스크에서 재로드.
```

**특징**:
- 원본 파일은 디스크에 보존 → 완전 복원 가능
- 129줄 → 3줄 = 97.7% 크기 감소
- 컨텍스트 창에서 모듈 존재를 인지하면서 토큰 절약

### 손실 압축 (Lossy)

```
입력:
  entries: [
    { tool: "Write", path: "/src/a.ts", timestamp: "2024-01-01T10:00:00Z" },
    { tool: "Edit",  path: "/src/a.ts", timestamp: "2024-01-01T10:05:00Z" },
    { tool: "Write", path: "/src/b.ts", timestamp: "2024-01-01T10:10:00Z" },
    { tool: "Read",  path: "/src/c.ts", timestamp: "2024-01-01T10:15:00Z" },
  ]

처리:
  1. toolCounts = { Write: 2, Edit: 1, Read: 1 }
  2. uniqueFiles = ["/src/a.ts", "/src/b.ts", "/src/c.ts"]
  3. timeRange = { earliest: "..T10:00:00Z", latest: "..T10:15:00Z" }

출력:
  summary: {
    totalEntries: 4,
    toolCounts: { Write: 2, Edit: 1, Read: 1 },
    uniqueFiles: ["/src/a.ts", "/src/b.ts", "/src/c.ts"],
    timeRange: { earliest: "...", latest: "..." }
  }
```

**특징**:
- 개별 도구 호출 이력은 복원 불가
- 집계 통계만 보존 → 패턴 파악은 가능
- 긴 세션의 이력이 무한히 커지는 것을 방지

### auto 모드 추론

```
input.content !== undefined && input.filePath → 'reversible'
input.toolCallEntries && length > 0           → 'lossy'
기본값                                         → 'reversible'
```

---

## 관련 문서

- [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) — 4계층 구조 개요
- [02-BLUEPRINT.md](./02-BLUEPRINT.md) — 모듈별 알고리즘 요약
- [03-LIFECYCLE.md](./03-LIFECYCLE.md) — 스킬 기반 워크플로우에서의 동작
- [07-RULES-REFERENCE.md](./07-RULES-REFERENCE.md) — 상수 및 임계값
