# filid v2 — 프랙탈 구조 관리 기술 청사진

## 1. 아키텍처 개요

### 1.1 시스템 레이어

```
┌─────────────────────────────────────────────────────────┐
│                     Plugin Layer                        │
│  .claude-plugin/plugin.json  |  .mcp.json               │
│  hooks/hooks.json            |  agents/*.md             │
│  skills/*/SKILL.md                                       │
│                                                          │
│  [기존 filid]  FCA-AI 규칙 강제 에이전트/스킬             │
│  [신규 v2]     프랙탈 구조 관리 에이전트/스킬 통합         │
├─────────────────────────────────────────────────────────┤
│                      MCP Layer                          │
│  [기존] fractal-navigate                                 │
│  [신규] fractal-scan  drift-detect  lca-resolve          │
│         rule-query    structure-validate                 │
│  (libs/server.cjs — esbuild CJS 번들)                   │
├─────────────────────────────────────────────────────────┤
│                      Hook Layer                         │
│  [기존] pre-tool-use  post-tool-use  session-start       │
│         user-prompt-submit  stop                        │
│  [신규] context-injector (UserPromptSubmit 확장)         │
│         structure-guard  (PreToolUse: Write|Edit)        │
│         change-tracker   (PostToolUse: Write|Edit)       │
│  (scripts/*.mjs — esbuild ESM 번들)                     │
├─────────────────────────────────────────────────────────┤
│                      Core Layer                         │
│  [기존] fractal-tree  organ-classifier  dependency-graph │
│  [신규] rule-engine       category-classifier            │
│         fractal-scanner   index-analyzer   module-main-analyzer│
│         fractal-validator lca-calculator   drift-detector      │
│         project-analyzer                                 │
├─────────────────────────────────────────────────────────┤
│                      Type Layer                         │
│  fractal.ts  rules.ts  scan.ts                          │
│  drift.ts    hooks.ts  report.ts                        │
└─────────────────────────────────────────────────────────┘
```

각 레이어는 하위 레이어에만 의존한다. Plugin Layer는 빌드 산출물(libs/, scripts/)을 참조하고, MCP/Hook Layer는 Core Layer를 사용하며, Core Layer는 Type Layer에만 의존한다.

신규 v2 모듈은 기존 filid Core Layer의 `fractal-tree`, `organ-classifier`, `dependency-graph` 위에 구축된다.

---

### 1.2 동작 모드 아키텍처

#### Auto Guide 모드

```
사용자 프롬프트 입력
        │
        ▼
UserPromptSubmit hook
        │
        ▼
context-injector.mjs (scripts/)
        │  stdin: { cwd, session_id, hook_event_name: "UserPromptSubmit", prompt }
        ▼
injectContext(input: UserPromptSubmitInput)
        │  organ-classifier로 구조 기반 분류 수행
        │  rule-engine으로 활성화된 규칙 목록 조회
        ▼
HookOutput { continue: true, hookSpecificOutput: { additionalContext: "..." } }
        │
        ▼
Claude Code가 에이전트 컨텍스트에 규칙 요약 주입
```

에이전트가 코드를 작성할 때 자동으로 프랙탈 구조 규칙 요약이 컨텍스트에 포함된다. 규칙 내용은 `organ-classifier`의 구조 기반 분류 결과에 따라 달라진다.

---

#### Restructure 모드

```
/filid:restructure 스킬 호출
        │
        ▼
fractal-architect 에이전트 (opus, read-only)
        │
        ├─ fractal-scan MCP 도구 호출
        │       │  fractal-scanner → FractalTree 빌드
        │       │  index-analyzer → barrel export 분석
        │       │  module-main-analyzer → public API 추출
        │       └→ ScanReport 반환
        │
        ├─ structure-validate MCP 도구 호출
        │       │  fractal-validator → 규칙 위반 목록
        │       │  category-classifier → 재분류 제안
        │       └→ ValidationReport 반환
        │
        ▼
재구성 계획 (AnalysisReport) 출력
        │  사용자 승인 요청
        ▼
restructurer 에이전트 (sonnet, write)
        │  승인된 계획 실행
        │  파일/디렉토리 이동, index.ts 갱신
        ▼
완료 보고
```

---

#### Sync 모드

```
/filid:sync 스킬 호출
        │
        ▼
drift-detect MCP 도구 호출
        │
        ├─ fractal-scanner → 현재 구조 트리
        ├─ rule-engine → 규칙 기대값 계산
        ├─ drift-detector → 이격 항목 목록 (DriftResult)
        │       │  기대 카테고리 vs 실제 카테고리
        │       │  기대 index.ts 패턴 vs 실제
        │       │  LCA 위반 의존 관계
        │       └→ DriftItem[] (severity: error/warning/info)
        ▼
drift-analyzer 에이전트 (sonnet, read-only)
        │  DriftResult 분석
        │  SyncPlan 생성 (SyncAction[])
        ▼
사용자에게 SyncPlan 제시
        │  승인 후
        ▼
lca-resolve, structure-validate로 보정 액션 검증
        │
        ▼
보정 실행 및 완료 보고
```

---

## 2. 핵심 타입 정의

### 2.1 fractal.ts

기존 filid의 타입을 확장하는 형태로 정의한다. 기존 filid에서 사용하는 `NodeType`은 `CategoryType`의 alias로 유지한다.

```typescript
/**
 * 프랙탈 구조 노드 타입 정의
 *
 * FCA-AI 아키텍처에서 각 디렉토리는 4가지 카테고리 중 하나로 분류된다.
 */

/**
 * 노드 카테고리 타입
 *
 * - fractal: 독립적인 도메인 경계를 가진 프랙탈 노드. 자체 CLAUDE.md를 가질 수 있다.
 * - organ: 프랙탈 노드 내의 기능적 하위 디렉토리. CLAUDE.md를 가질 수 없다.
 * - pure-function: 상태 없는 순수 함수 모음. 단일 책임 원칙을 엄격히 따른다.
 * - hybrid: fractal이면서 동시에 organ 역할을 하는 전환 단계 노드.
 */
export type CategoryType = 'fractal' | 'organ' | 'pure-function' | 'hybrid';

/** 기존 filid NodeType과의 호환성 alias */
export type NodeType = CategoryType;

/**
 * 프랙탈 트리의 단일 노드
 */
export interface FractalNode {
  /** 절대 디렉토리 경로 */
  path: string;
  /** 노드 이름 (디렉토리명) */
  name: string;
  /** 카테고리 분류 */
  category: CategoryType;
  /** 부모 프랙탈 경로 (루트이면 null) */
  parent: string | null;
  /** 자식 프랙탈 경로 배열 */
  children: string[];
  /** organ 디렉토리 경로 배열 */
  organs: string[];
  /** index.ts(barrel export) 존재 여부 */
  hasIndex: boolean;
  /** CLAUDE.md 존재 여부 */
  hasClaudeMd: boolean;
  /** SPEC.md 존재 여부 */
  hasSpecMd: boolean;
  /** package.json 존재 여부 (패키지 경계) */
  hasPackageJson: boolean;
  /** 노드 깊이 (루트 = 0) */
  depth: number;
}

/**
 * 프로젝트 전체 프랙탈 트리
 */
export interface FractalTree {
  /** 루트 노드 경로 */
  root: string;
  /** 경로 → 노드 맵 */
  nodes: Map<string, FractalNode>;
  /** 트리 생성 시각 (ISO 8601) */
  scannedAt: string;
  /** 스캔에 소요된 시간 (ms) */
  scanDurationMs: number;
}

/**
 * 모듈 진입점 정보
 */
export interface ModuleInfo {
  /** 모듈 루트 경로 */
  path: string;
  /** 진입점 파일 경로 (index.ts 등) */
  entryPoint: string | null;
  /** 공개 export 심볼 목록 */
  exports: string[];
  /** 재export(re-export) 여부 */
  isBarrel: boolean;
  /** 직접 구현 포함 여부 */
  hasImplementation: boolean;
}

/**
 * 의존 관계 엣지
 */
export interface DependencyEdge {
  /** 소스 모듈 경로 */
  from: string;
  /** 대상 모듈 경로 */
  to: string;
  /** 의존 유형 */
  type: 'import' | 'export' | 'call' | 'inheritance' | 're-export';
  /** import 구문 원문 */
  importSpecifier?: string;
}

/**
 * 방향성 비순환 그래프 (의존 관계)
 */
export interface DependencyDAG {
  /** 노드(모듈 경로) 집합 */
  nodes: Set<string>;
  /** 엣지 배열 */
  edges: DependencyEdge[];
  /** 인접 리스트 (from → to[]) */
  adjacency: Map<string, string[]>;
  /** 역방향 인접 리스트 (to → from[]) */
  reverseAdjacency: Map<string, string[]>;
}
```

---

### 2.2 rules.ts

```typescript
/**
 * 프랙탈 구조 규칙 타입 정의
 */

/**
 * 규칙 심각도
 *
 * - error: 즉시 수정 필요. structure-guard hook이 쓰기를 차단한다.
 * - warning: 개선 권장. 경고를 출력하지만 차단하지는 않는다.
 * - info: 참고 정보. 보고서에만 포함된다.
 */
export type RuleSeverity = 'error' | 'warning' | 'info';

/**
 * 규칙 적용 범위
 */
export type RuleScope =
  | 'file'       // 단일 파일
  | 'directory'  // 단일 디렉토리
  | 'module'     // 프랙탈 모듈 (디렉토리 + 하위)
  | 'project';   // 프로젝트 전체

/**
 * 규칙 카테고리
 */
export type RuleCategory =
  | 'naming'       // 이름 규칙 (파일명, 디렉토리명)
  | 'structure'    // 디렉토리 구조 규칙
  | 'dependency'   // 의존 관계 규칙
  | 'index'        // index.ts barrel export 규칙
  | 'documentation'; // 문서 규칙 (CLAUDE.md, SPEC.md)

/**
 * 단일 규칙 정의
 */
export interface Rule {
  /** 규칙 고유 식별자 (예: "no-organ-claude-md") */
  id: string;
  /** 사람이 읽을 수 있는 규칙 이름 */
  name: string;
  /** 규칙 설명 */
  description: string;
  /** 심각도 */
  severity: RuleSeverity;
  /** 적용 범위 */
  scope: RuleScope;
  /** 규칙 카테고리 */
  category: RuleCategory;
  /** 규칙 활성화 여부 */
  enabled: boolean;
  /** 커스텀 규칙 여부 (기본 제공 규칙은 false) */
  custom: boolean;
  /**
   * 규칙 평가 함수.
   * context에는 대상 경로, FractalTree, 설정 등이 포함된다.
   */
  evaluate: (context: RuleEvaluationContext) => RuleEvaluationResult;
}

/**
 * 규칙 평가에 필요한 컨텍스트
 */
export interface RuleEvaluationContext {
  /** 평가 대상 경로 */
  targetPath: string;
  /** 프로젝트 루트 경로 */
  projectRoot: string;
  /** 프랙탈 트리 (스캔 결과) */
  tree: import('./fractal.js').FractalTree;
  /** 스캔 옵션 (프로그래밍적 전달용, 선택) */
  options?: import('./scan.js').ScanOptions;
}

/**
 * 규칙 평가 결과
 */
export interface RuleEvaluationResult {
  /** 규칙 식별자 */
  ruleId: string;
  /** 통과 여부 */
  passed: boolean;
  /** 위반 메시지 (통과 시 null) */
  message: string | null;
  /** 자동 수정 제안 (선택) */
  suggestion?: string;
}

/**
 * 규칙 집합
 */
export interface RuleSet {
  /** 규칙 집합 이름 */
  name: string;
  /** 포함된 규칙 배열 */
  rules: Rule[];
  /** 규칙 집합 버전 */
  version: string;
}

/**
 * 단일 규칙 위반 항목
 */
export interface RuleViolation {
  /** 위반된 규칙 식별자 */
  ruleId: string;
  /** 위반된 규칙 이름 */
  ruleName: string;
  /** 심각도 */
  severity: RuleSeverity;
  /** 위반이 발생한 경로 */
  path: string;
  /** 위반 설명 메시지 */
  message: string;
  /** 자동 수정 제안 (선택) */
  suggestion?: string;
  /** 위반 감지 시각 (ISO 8601) */
  detectedAt: string;
}
```

---

### 2.3 scan.ts

```typescript
/**
 * 스캔 설정 타입 정의
 *
 * 제로 설정(zero-config): 외부 설정 파일 없이 내장 기본값을 사용한다.
 * 필요 시 프로그래밍적으로 옵션을 전달할 수 있다.
 */

/**
 * 스캔 옵션 (프로그래밍적 전달용)
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

/** 기본 스캔 옵션 */
export const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  include: ['**'],
  exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  maxDepth: 10,
  followSymlinks: false,
};
```

---

### 2.4 drift.ts

```typescript
/**
 * 이격(Drift) 감지 및 보정 타입 정의
 *
 * Drift는 규칙이 기대하는 구조와 현재 실제 구조 사이의 차이를 의미한다.
 */

/**
 * 이격 심각도
 */
export type DriftSeverity = 'error' | 'warning' | 'info';

/**
 * 이격 항목 타입
 */
export type DriftItemType =
  | 'wrong-category'        // 카테고리 분류 불일치
  | 'missing-index'         // index.ts barrel export 누락
  | 'invalid-index'         // index.ts 패턴 위반
  | 'lca-violation'         // LCA 원칙 위반 의존 관계
  | 'missing-claude-md'     // 프랙탈 노드에 CLAUDE.md 누락
  | 'unexpected-claude-md'  // organ에 CLAUDE.md 존재 (위반)
  | 'naming-violation'      // 이름 규칙 위반
  | 'depth-violation'       // 최대 깊이 초과
  | 'orphan-module';        // 부모 프랙탈이 없는 고아 모듈

/**
 * 단일 이격 항목
 */
export interface DriftItem {
  /** 이격 유형 */
  type: DriftItemType;
  /** 이격이 발생한 경로 */
  path: string;
  /** 심각도 */
  severity: DriftSeverity;
  /** 이격 설명 메시지 */
  message: string;
  /** 기대값 */
  expected: string;
  /** 실제값 */
  actual: string;
  /** 관련 규칙 ID */
  ruleId?: string;
}

/**
 * 전체 이격 감지 결과
 */
export interface DriftResult {
  /** 프로젝트 루트 경로 */
  projectRoot: string;
  /** 이격 항목 배열 */
  items: DriftItem[];
  /** 이격 항목 수 요약 */
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  /** 감지 수행 시각 (ISO 8601) */
  detectedAt: string;
  /** 감지에 소요된 시간 (ms) */
  durationMs: number;
}

/**
 * 보정 액션 유형
 */
export type SyncActionType =
  | 'move-file'         // 파일 이동
  | 'move-directory'    // 디렉토리 이동
  | 'rename'            // 이름 변경
  | 'create-index'      // index.ts 생성
  | 'update-index'      // index.ts 갱신
  | 'create-claude-md'  // CLAUDE.md 생성
  | 'delete-claude-md'  // CLAUDE.md 삭제
  | 'create-directory'; // 디렉토리 생성

/**
 * 단일 보정 액션
 */
export interface SyncAction {
  /** 액션 유형 */
  type: SyncActionType;
  /** 대상 경로 (현재) */
  sourcePath: string;
  /** 대상 경로 (변경 후). 이동/이름변경이 아니면 sourcePath와 동일 */
  targetPath: string;
  /** 액션 설명 */
  description: string;
  /** 이 액션이 해결하는 DriftItem 인덱스 */
  resolvesItemIndex: number;
  /** 다른 액션 실행 후에야 실행 가능한지 여부 */
  dependsOnActions?: number[];
}

/**
 * 보정 계획 전체
 */
export interface SyncPlan {
  /** 계획 식별자 (UUID) */
  id: string;
  /** 기반이 된 DriftResult */
  driftResult: DriftResult;
  /** 보정 액션 배열 (실행 순서대로) */
  actions: SyncAction[];
  /** 계획 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 추정 소요 시간 설명 */
  estimatedEffort: string;
  /**
   * 계획 상태
   * - pending: 사용자 승인 대기
   * - approved: 실행 승인됨
   * - executing: 실행 중
   * - completed: 완료
   * - failed: 실패
   * - cancelled: 취소됨
   */
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
}
```

---

### 2.5 hooks.ts

기존 filid의 hooks 타입을 그대로 사용한다. v2 Hook 스크립트(context-injector, structure-guard, change-tracker)는 기존 filid의 Hook 타입 패턴을 재사용하므로 별도 파일이 필요하지 않을 수 있다.

```typescript
/**
 * Claude Code Hook 입출력 타입 정의
 *
 * 기존 filid hooks 타입을 그대로 사용한다.
 * Hook 스크립트는 stdin에서 JSON을 읽고 stdout에 JSON을 쓴다.
 */

/**
 * Hook 기본 입력 (stdin JSON 공통 필드)
 */
export interface HookBaseInput {
  /** 현재 작업 디렉토리 */
  cwd: string;
  /** 세션 식별자 */
  session_id: string;
  /** Hook 이벤트 이름 */
  hook_event_name: string;
}

/**
 * PreToolUse hook 입력
 * Write, Edit 도구 호출 전에 실행된다.
 */
export interface PreToolUseInput extends HookBaseInput {
  hook_event_name: 'PreToolUse';
  /** 호출될 도구 이름 */
  tool_name: string;
  /** 도구 입력 파라미터 */
  tool_input: {
    file_path?: string;
    path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    [key: string]: unknown;
  };
}

/**
 * PostToolUse hook 입력
 * Write, Edit 도구 호출 후에 실행된다.
 */
export interface PostToolUseInput extends HookBaseInput {
  hook_event_name: 'PostToolUse';
  /** 호출된 도구 이름 */
  tool_name: string;
  /** 도구 입력 파라미터 */
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
 * UserPromptSubmit hook 입력
 * 사용자가 프롬프트를 제출할 때 실행된다.
 */
export interface UserPromptSubmitInput extends HookBaseInput {
  hook_event_name: 'UserPromptSubmit';
  /** 사용자 프롬프트 내용 */
  prompt?: string;
}

/**
 * Hook 출력 (stdout JSON)
 *
 * - `continue: false`는 PreToolUse에서만 유효하다. 도구 호출을 차단한다.
 * - `additionalContext`는 UserPromptSubmit에서만 유효하다.
 */
export interface HookOutput {
  /** 계속 진행 여부. false이면 도구 호출을 차단 (PreToolUse 전용) */
  continue: boolean;
  /** 차단 이유 메시지 (continue: false인 경우) */
  reason?: string;
  /** Hook 특화 출력 */
  hookSpecificOutput?: {
    /** 에이전트 컨텍스트에 주입할 추가 텍스트 (UserPromptSubmit 전용) */
    additionalContext?: string;
  };
}

/** 모든 Hook 입력 타입의 유니온 */
export type HookInput = PreToolUseInput | PostToolUseInput | UserPromptSubmitInput;
```

---

### 2.6 report.ts

```typescript
/**
 * 분석 보고서 타입 정의
 *
 * 각 MCP 도구의 반환값은 해당 Report 타입을 따른다.
 */

/**
 * 스캔 보고서 (fractal-scan 도구 반환값)
 */
export interface ScanReport {
  /** 프로젝트 루트 경로 */
  projectRoot: string;
  /** 스캔된 프랙탈 트리 */
  tree: import('./fractal.js').FractalTree;
  /** 노드 수 요약 */
  summary: {
    totalNodes: number;
    fractalCount: number;
    organCount: number;
    pureFunctionCount: number;
    hybridCount: number;
    maxDepth: number;
  };
  /** 스캔 수행 시각 (ISO 8601) */
  scannedAt: string;
}

/**
 * 구조 검증 보고서 (structure-validate 도구 반환값)
 */
export interface ValidationReport {
  /** 프로젝트 루트 경로 */
  projectRoot: string;
  /** 규칙 위반 목록 */
  violations: import('./rules.js').RuleViolation[];
  /** 검증 결과 요약 */
  summary: {
    totalChecked: number;
    passed: number;
    failed: number;
    skipped: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  /** 검증 수행 시각 (ISO 8601) */
  validatedAt: string;
}

/**
 * 이격 감지 보고서 (drift-detect 도구 반환값)
 */
export interface DriftReport {
  /** 프로젝트 루트 경로 */
  projectRoot: string;
  /** 이격 감지 결과 */
  drift: import('./drift.js').DriftResult;
  /** 생성된 보정 계획 */
  syncPlan: import('./drift.js').SyncPlan;
  /** 보고서 생성 시각 (ISO 8601) */
  generatedAt: string;
}

/**
 * 종합 분석 보고서 (project-analyzer 출력)
 */
export interface AnalysisReport {
  /** 프로젝트 루트 경로 */
  projectRoot: string;
  /** 스캔 결과 */
  scan: ScanReport;
  /** 검증 결과 */
  validation: ValidationReport;
  /** 이격 감지 결과 */
  drift: DriftReport;
  /** 전체 건강도 점수 (0–100) */
  healthScore: number;
  /**
   * 건강도 등급
   * - A: 90–100 (우수)
   * - B: 70–89 (양호)
   * - C: 50–69 (개선 필요)
   * - D: 30–49 (주의)
   * - F: 0–29 (심각)
   */
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** 분석 수행 시각 (ISO 8601) */
  analyzedAt: string;
  /** 전체 분석 소요 시간 (ms) */
  totalDurationMs: number;
}
```

---

## 3. 프랙탈 구조 규칙 명세

### 3.1 카테고리 분류 규칙

| 카테고리 | 분류 기준 | 허용 | 금지 |
|----------|-----------|------|------|
| `fractal` | 독립적인 도메인 경계. package.json이 있거나 CLAUDE.md가 있거나 하위에 복수의 자식 프랙탈이 있음 | CLAUDE.md, SPEC.md, 자식 fractal, organ | - |
| `organ` | 프랙탈 노드 내의 기능적 하위 디렉토리. 프랙탈 자식이 없고 리프 파일만 포함하는 디렉토리 | 파일, 순수 함수 | CLAUDE.md, 자식 fractal |
| `pure-function` | 상태 없는 순수 함수만 포함. 단일 책임. 이름이 `utils`, `helpers`, `lib`이거나 명시적으로 지정됨 | 함수 파일, 타입 파일 | 클래스, 상태, 부작용 |
| `hybrid` | fractal → organ 전환 중이거나 organ이지만 일부 자식 fractal을 가짐. 임시 상태로 분류 | fractal + organ 혼합 | 장기 유지 (해소 필요) |

**구조 기반 분류 규칙 (제로 설정):**
```
분류 우선순위 (높은 것부터):
1. CLAUDE.md 존재 → fractal
2. SPEC.md 존재 → fractal
3. 프랙탈 자식 없음 + 리프 파일만 포함 → organ
4. 부작용 없는 순수 함수만 포함 → pure-function
5. 기본값 → fractal
6. 모호한 케이스 → context-injector를 통해 LLM이 판단
```

**설계 결정:** 이름 기반 organ 목록(components, utils 등)을 제거하고
디렉토리 구조 분석으로 자동 분류한다. Claude Code 플러그인 환경에서
LLM이 실제 코드를 읽고 컨텍스트를 이해하므로, 엣지 케이스를
설정 파일이 아닌 AI 판단에 위임한다.

---

### 3.2 모듈 구성 규칙

**index.ts barrel export 규칙:**

| 규칙 ID | 내용 | 심각도 |
|---------|------|--------|
| `fractal-must-have-index` | fractal 노드는 index.ts를 가져야 한다 | warning |
| `index-must-be-barrel` | index.ts는 barrel export(`export * from`, `export { ... } from`)만 포함해야 한다 | error |
| `index-no-direct-impl` | index.ts 내에 직접 구현 코드가 없어야 한다 | error |
| `index-export-all-public` | public API로 의도된 심볼은 모두 index.ts에서 export 해야 한다 | info |

**모듈 진입점 규칙:**

| 규칙 ID | 내용 | 심각도 |
|---------|------|--------|
| `no-deep-import` | 다른 fractal의 내부 경로를 직접 import하면 안 된다 (`import from 'other/internal/path'`) | error |
| `import-from-index` | 다른 fractal에서 import 할 때는 반드시 index.ts를 통해야 한다 | warning |
| `organ-no-cross-import` | organ은 같은 fractal의 다른 organ을 직접 import하면 안 된다 | warning |

---

### 3.3 LCA(Lowest Common Ancestor) 원칙

두 모듈 A와 B가 공통으로 의존하는 코드 C가 있을 때, C는 A와 B의 **최소 공통 조상(LCA) fractal** 노드에 위치해야 한다.

**알고리즘:**
```
1. 의존 관계 그래프에서 공유 의존 코드 C를 찾는다.
2. C를 사용하는 모든 모듈의 경로를 수집한다.
3. 프랙탈 트리에서 해당 모듈들의 LCA 노드를 계산한다.
4. C의 현재 위치와 LCA 노드를 비교한다.
5. C가 LCA 노드의 하위에 없으면 LCA 위반으로 보고한다.
```

**LCA 계산 방법 (트리 탐색):**
```
lca(nodeA, nodeB):
  pathA = 루트까지의 경로 배열
  pathB = 루트까지의 경로 배열
  공통 접두사의 마지막 노드 = LCA
```

**위반 예시:**
```
# fractal 트리
root/
  feature-a/   (fractal)
    utils/     (organ)  ← utils/format.ts 여기 있음
  feature-b/   (fractal)
    uses utils/format.ts  ← 위반! LCA는 root이므로
                            format.ts는 root/shared/ 에 있어야 함
```

---

### 3.4 기본 내장 규칙 목록

**naming 카테고리:**
| 규칙 ID | 설명 | 심각도 |
|---------|------|--------|
| `kebab-case-directory` | 디렉토리명은 kebab-case여야 한다 | warning |
| `no-plural-fractal` | fractal 노드 이름은 복수형을 피해야 한다 (`users` → `user`) | info |

**structure 카테고리:**
| 규칙 ID | 설명 | 심각도 |
|---------|------|--------|
| `organ-no-claude-md` | organ 디렉토리에 CLAUDE.md가 있으면 안 된다 | error |
| `fractal-max-depth` | fractal 중첩 깊이는 설정값(기본 5)을 초과하면 안 된다 | warning |
| `no-empty-fractal` | fractal 노드는 최소 1개 이상의 파일을 포함해야 한다 | warning |
| `hybrid-must-resolve` | hybrid 카테고리는 장기적으로 유지될 수 없다 (30일 초과 시 경고) | info |

**dependency 카테고리:**
| 규칙 ID | 설명 | 심각도 |
|---------|------|--------|
| `lca-placement` | 공유 코드는 LCA fractal 노드에 위치해야 한다 | warning |
| `no-circular-fractal` | fractal 간 순환 의존은 금지된다 | error |
| `no-upward-import` | 자식 fractal이 부모 fractal의 organ을 직접 import하면 안 된다 | warning |

**index 카테고리:**
| 규칙 ID | 설명 | 심각도 |
|---------|------|--------|
| `fractal-must-have-index` | fractal 노드는 index.ts barrel export를 가져야 한다 | warning |
| `index-must-be-barrel` | index.ts는 barrel export 전용이어야 한다 | error |

**documentation 카테고리:**
| 규칙 ID | 설명 | 심각도 |
|---------|------|--------|
| `root-fractal-needs-claude-md` | 루트 fractal 노드는 CLAUDE.md를 가져야 한다 | info |

---

## 4. 제로 설정 아키텍처

### 4.1 설계 원칙

filid v2는 **제로 설정(zero-config)** 아키텍처를 채택한다. 외부 설정 파일(`.fractalrc.yml`, `.filidrc.yml`)을 사용하지 않는다.

**근거:**
- filid는 Claude Code 플러그인이다. 사용자에게 설정 파일은 진입 허들이 된다.
- 디렉토리 구조 자체가 충분한 분류 정보를 제공한다.
- 모호한 케이스는 LLM이 실제 코드를 읽고 판단할 수 있다.
- 프로젝트마다 organ 목록이 달라서, 이름 기반 고정 목록은 범용적이지 않다.

### 4.2 3단계 분류 체계

```
1단계: 프로그래밍적 규칙 (Deterministic)
  ├─ CLAUDE.md 존재 → fractal
  ├─ SPEC.md 존재 → fractal
  ├─ 프랙탈 자식 없음 + 리프 파일만 → organ
  ├─ 부작용 없음 → pure-function
  └─ 기본값 → fractal

2단계: 컨텍스트 주입 (Structural Info)
  └─ context-injector가 현재 디렉토리의 구조 정보를 LLM 컨텍스트에 주입

3단계: LLM 판단 (Contextual Decision)
  └─ 모호한 경계 케이스에서 AI가 실제 코드를 읽고 분류 결정
```

### 4.3 제거된 구성 요소

| 구성 요소 | 상태 | 대체 방법 |
|-----------|------|-----------|
| `.fractalrc.yml` | 제거 | 구조 기반 자동 분류 |
| `config-loader.ts` | 제거 | organ-classifier 구조 분석 |
| `FractalConfig` 타입 | 제거 | `ScanOptions` (프로그래밍적 옵션만) |
| `CategoryConfig.organNames` | 제거 | 구조 분석 (리프 디렉토리 = organ) |
| `yaml` 의존성 | 제거 | 불필요 |
| `zod` 의존성 | 제거 | 불필요 |
| 3단계 설정 병합 | 제거 | 단일 내장 기본값 |

---

## 5. 모듈 의존 관계

기존 filid 모듈과 신규 v2 모듈의 통합 의존 관계 그래프:

```
src/types/
  fractal.ts ──────────────────────────────────────────────┐
  rules.ts   ──────────────────────────────────────────┐   │
  scan.ts    (독립, 내장 기본값만)                      │   │
  drift.ts   ──────────────────────────────────────┐   │   │
  hooks.ts   (독립)                                 │   │   │
  report.ts  ──────────────────────────────────────┘   │   │
                                                       │   │
src/core/                                              │   │
  [기존 filid 모듈]                                    │   │
  fractal-tree ◄── (fractal.ts)                       │   │
  organ-classifier ◄── (fractal.ts)                   │   │
  dependency-graph ◄── (fractal.ts)                   │   │
       │                                               │   │
  [신규 v2 모듈]                                       │   │
  rule-engine ◄── (rules.ts)                          │   │
       │                                               │   │
       │         category-classifier ◄── (fractal.ts) │   │
       │                │                              │   │
       │                ▼                              │   │
       └──────► fractal-scanner ◄── (fractal.ts)
                        │           ▲ (기존 fractal-tree 재사용)
              ┌─────────┼─────────────┐
              ▼         ▼             ▼
       index-analyzer  module-main-  fractal-validator ◄── (rule-engine)
              │        analyzer       │
              │            │         │
              └────────────┴─────────┘
                           │
                    lca-calculator ◄── (fractal.ts)
                           │           ▲ (기존 dependency-graph 활용)
                    drift-detector ◄── (drift.ts, fractal-validator, lca-calculator)
                           │
                    project-analyzer ◄── (report.ts, 모든 모듈 통합)
                           │
                           ▼
                    기존 filid MCP/Hook + 신규 v2 MCP/Hook
                    MCP Layer (tools/): fractal-navigate + fractal-scan 등
                    Hook Layer (hooks/): 기존 5개 hook + context-injector 등
```

**레벨 요약:**

| 레벨 | 모듈 | 의존 |
|------|------|------|
| 0 | `category-classifier` | types만 |
| 1 | `rule-engine`, `fractal-scanner` | Level 0 (기존 `fractal-tree` 활용) |
| 2 | `index-analyzer`, `module-main-analyzer`, `fractal-validator` | Level 1 |
| 3 | `lca-calculator` | Level 2 (fractal-scanner, 기존 `dependency-graph` 활용) |
| 4 | `drift-detector` | Level 2-3 (validator, lca) |
| 5 | `project-analyzer` | Level 0-4 (전체 통합) |
| 6 | 기존 filid MCP/Hook + 신규 v2 MCP/Hook | Level 5 (project-analyzer 또는 개별 모듈) |
