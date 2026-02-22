# Holon — 기술 청사진

## 1. 아키텍처 개요

### 1.1 시스템 레이어

```
┌─────────────────────────────────────────────────────────┐
│                     Plugin Layer                        │
│  .claude-plugin/plugin.json  |  .mcp.json               │
│  hooks/hooks.json            |  agents/*.md             │
│  skills/*/SKILL.md                                       │
├─────────────────────────────────────────────────────────┤
│                      MCP Layer                          │
│  fractal-scan  drift-detect  lca-resolve                │
│  rule-query    structure-validate                        │
│  (libs/server.cjs — esbuild CJS 번들)                   │
├─────────────────────────────────────────────────────────┤
│                      Hook Layer                         │
│  context-injector (UserPromptSubmit)                    │
│  structure-guard  (PreToolUse: Write|Edit)              │
│  change-tracker   (PostToolUse: Write|Edit)             │
│  (scripts/*.mjs — esbuild ESM 번들)                     │
├─────────────────────────────────────────────────────────┤
│                      Core Layer                         │
│  rule-engine       config-loader    category-classifier │
│  fractal-scanner   index-analyzer   module-main-analyzer│
│  fractal-validator lca-calculator   drift-detector      │
│  project-analyzer                                       │
├─────────────────────────────────────────────────────────┤
│                      Type Layer                         │
│  fractal.ts  rules.ts  config.ts                        │
│  drift.ts    hooks.ts  report.ts                        │
└─────────────────────────────────────────────────────────┘
```

각 레이어는 하위 레이어에만 의존한다. Plugin Layer는 빌드 산출물(libs/, scripts/)을 참조하고, MCP/Hook Layer는 Core Layer를 사용하며, Core Layer는 Type Layer에만 의존한다.

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
        │  config-loader로 .holonrc.yml 로드
        │  rule-engine으로 활성화된 규칙 목록 조회
        ▼
HookOutput { continue: true, hookSpecificOutput: { additionalContext: "..." } }
        │
        ▼
Claude Code가 에이전트 컨텍스트에 규칙 요약 주입
```

에이전트가 코드를 작성할 때 자동으로 프랙탈 구조 규칙 요약이 컨텍스트에 포함된다. 규칙 내용은 `config-loader`가 로드한 `.holonrc.yml`의 설정에 따라 달라진다.

---

#### Restructure 모드

```
/holon:restructure 스킬 호출
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
/holon:sync 스킬 호출
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
  /** holon 설정 */
  config: import('./config.js').HolonConfig;
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

### 2.3 config.ts

```typescript
/**
 * Holon 설정 시스템 타입 정의
 */

/**
 * 설정 출처
 */
export type ConfigSource =
  | 'default'   // 기본 내장 설정
  | 'project'   // 프로젝트 루트 .holonrc.yml
  | 'user'      // 사용자 홈 ~/.holonrc.yml
  | 'cli';      // CLI 옵션 (--config 플래그)

/**
 * 설정 병합 전략
 *
 * - override: 상위 설정이 하위 설정을 완전히 덮어씀
 * - merge: 배열은 합치고, 스칼라는 덮어씀
 * - append: 배열에 추가만 허용, 기존 항목 유지
 */
export type MergeStrategy = 'override' | 'merge' | 'append';

/**
 * 규칙 활성화 설정 (개별 규칙 override)
 */
export interface RuleOverride {
  /** 규칙 식별자 */
  id: string;
  /** 활성화 여부 (false면 비활성화) */
  enabled?: boolean;
  /** 심각도 override */
  severity?: import('./rules.js').RuleSeverity;
}

/**
 * 커스텀 카테고리 설정
 */
export interface CategoryConfig {
  /**
   * 추가 organ 디렉토리명 목록.
   * 기본값: ['components', 'utils', 'types', 'hooks', 'helpers',
   *           'lib', 'styles', 'assets', 'constants', 'services',
   *           'adapters', 'repositories']
   */
  organNames?: string[];
  /**
   * 스캔에서 제외할 glob 패턴 목록.
   * 기본값: ['node_modules', '.git', 'dist', 'build', 'coverage']
   */
  ignorePatterns?: string[];
  /**
   * fractal로 강제 분류할 경로 목록 (glob 지원)
   */
  forceFractal?: string[];
  /**
   * organ으로 강제 분류할 경로 목록 (glob 지원)
   */
  forceOrgan?: string[];
}

/**
 * 스캔 설정
 */
export interface ScanConfig {
  /**
   * 스캔 포함 glob 패턴.
   * 기본값: ['**']
   */
  include?: string[];
  /**
   * 스캔 제외 glob 패턴.
   * 기본값: ['node_modules/**', '.git/**', 'dist/**', '*.test.ts']
   */
  exclude?: string[];
  /** 최대 스캔 깊이. 기본값: 10 */
  maxDepth?: number;
  /** 심볼릭 링크 추적 여부. 기본값: false */
  followSymlinks?: boolean;
}

/**
 * 출력 설정
 */
export interface OutputConfig {
  /**
   * 출력 형식.
   * - text: 사람이 읽기 쉬운 텍스트
   * - json: 구조화된 JSON
   * - markdown: 마크다운 형식
   */
  format?: 'text' | 'json' | 'markdown';
  /**
   * 출력 상세 수준.
   * - quiet: 오류만
   * - normal: 오류 + 경고
   * - verbose: 모두 (info 포함)
   */
  verbosity?: 'quiet' | 'normal' | 'verbose';
  /** 색상 출력 여부. 기본값: true */
  color?: boolean;
  /** 아이콘(유니코드 이모지) 사용 여부. 기본값: false */
  icons?: boolean;
}

/**
 * Auto Guide 모드 설정
 */
export interface AutoGuideConfig {
  /** Auto Guide 활성화 여부. 기본값: true */
  enabled?: boolean;
  /**
   * 컨텍스트 주입 상세 수준.
   * - minimal: 한 줄 요약
   * - standard: 카테고리 분류 + 주요 규칙
   * - full: 모든 활성 규칙 전체 내용
   */
  contextLevel?: 'minimal' | 'standard' | 'full';
}

/**
 * 병합된 최종 Holon 설정
 */
export interface HolonConfig {
  /** 설정 스키마 버전 */
  version: string;
  /** 규칙 override 목록 */
  rules?: RuleOverride[];
  /** 카테고리 설정 */
  categories?: CategoryConfig;
  /** 스캔 설정 */
  scan?: ScanConfig;
  /** 출력 설정 */
  output?: OutputConfig;
  /** Auto Guide 모드 설정 */
  autoGuide?: AutoGuideConfig;
}

/**
 * .holonrc.yml 파일의 파싱 전 원시 스키마 (zod 검증 전)
 */
export interface HolonrcSchema extends HolonConfig {
  // HolonConfig와 동일. zod로 검증 후 HolonConfig로 확정된다.
}

/**
 * 설정 로드 결과 (출처 정보 포함)
 */
export interface ConfigLoadResult {
  /** 병합된 최종 설정 */
  config: HolonConfig;
  /** 각 출처별 설정 기여도 */
  sources: Array<{
    source: ConfigSource;
    path: string | null;
    applied: boolean;
  }>;
}
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

```typescript
/**
 * Claude Code Hook 입출력 타입 정의
 *
 * filid의 hooks.ts 패턴을 그대로 재사용한다.
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
| `organ` | 프랙탈 노드 내의 기능적 하위 디렉토리. 이름이 표준 organ 목록에 포함 | 파일, 순수 함수 | CLAUDE.md, 자식 fractal |
| `pure-function` | 상태 없는 순수 함수만 포함. 단일 책임. 이름이 `utils`, `helpers`, `lib`이거나 명시적으로 지정됨 | 함수 파일, 타입 파일 | 클래스, 상태, 부작용 |
| `hybrid` | fractal → organ 전환 중이거나 organ이지만 일부 자식 fractal을 가짐. 임시 상태로 분류 | fractal + organ 혼합 | 장기 유지 (해소 필요) |

**표준 organ 이름 목록 (기본값):**
```
components, utils, types, hooks, helpers, lib, styles, assets,
constants, services, adapters, repositories, store, context,
providers, middleware, interceptors, validators, formatters
```

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

## 4. 설정 시스템

### 4.1 .holonrc.yml 스키마

```yaml
# .holonrc.yml — Holon 플러그인 설정
# 스키마 버전
version: "1.0"

# 규칙 설정
rules:
  # 개별 규칙 비활성화
  - id: "no-plural-fractal"
    enabled: false

  # 심각도 조정
  - id: "fractal-max-depth"
    severity: "error"  # 기본값 warning → error로 격상

  # 커스텀 규칙 (사용자 정의)
  # custom 규칙은 별도 파일에서 로드 (향후 지원 예정)

# 카테고리 설정
categories:
  # 추가 organ 디렉토리명 (기본 목록에 추가)
  organNames:
    - "queries"
    - "mutations"
    - "fragments"
    - "schemas"

  # 스캔에서 제외할 패턴
  ignorePatterns:
    - "**/__generated__/**"
    - "**/*.stories.tsx"
    - "**/fixtures/**"

  # 특정 경로를 fractal로 강제 분류 (glob 지원)
  forceFractal:
    - "src/features/*"
    - "packages/*"

  # 특정 경로를 organ으로 강제 분류 (glob 지원)
  forceOrgan:
    - "src/shared/ui"

# 스캔 설정
scan:
  # 스캔 포함 패턴
  include:
    - "src/**"
    - "packages/**"

  # 스캔 제외 패턴 (ignorePatterns와 병합됨)
  exclude:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/.next/**"

  # 최대 탐색 깊이 (기본값: 10)
  maxDepth: 8

  # 심볼릭 링크 추적 (기본값: false)
  followSymlinks: false

# 출력 설정
output:
  # 출력 형식: text | json | markdown
  format: "text"

  # 상세 수준: quiet | normal | verbose
  verbosity: "normal"

  # 색상 출력 (기본값: true)
  color: true

  # 아이콘 사용 (기본값: false)
  icons: false

# Auto Guide 모드 설정
autoGuide:
  # Auto Guide 활성화 (기본값: true)
  enabled: true

  # 컨텍스트 주입 수준: minimal | standard | full
  contextLevel: "standard"
```

---

### 4.2 설정 병합 순서

설정은 낮은 우선순위 → 높은 우선순위 순서로 병합된다:

```
1. 기본값 (default)
   └─ packages/holon/src/core/config-loader.ts 내 DEFAULT_CONFIG 상수

2. 프로젝트 설정 (project)
   └─ {cwd}/.holonrc.yml (프로젝트 루트에서 위로 탐색)

3. 사용자 설정 (user)
   └─ ~/.holonrc.yml (홈 디렉토리)

4. CLI 옵션 (cli)
   └─ --config <path>, --verbosity, --format 등
```

**병합 규칙:**
- 스칼라 값(`format`, `verbosity`, `maxDepth` 등): 상위 설정이 덮어씀
- 배열 값(`organNames`, `ignorePatterns`, `rules` 등): 상위 설정이 추가됨 (중복 제거)
- `forceFractal`, `forceOrgan`: 모든 레벨의 배열을 합집합

---

### 4.3 zod 검증 스키마

```typescript
import { z } from 'zod';

const RuleSeveritySchema = z.enum(['error', 'warning', 'info']);

const RuleOverrideSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  severity: RuleSeveritySchema.optional(),
});

const CategoryConfigSchema = z.object({
  organNames: z.array(z.string()).optional(),
  ignorePatterns: z.array(z.string()).optional(),
  forceFractal: z.array(z.string()).optional(),
  forceOrgan: z.array(z.string()).optional(),
});

const ScanConfigSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  maxDepth: z.number().int().min(1).max(20).optional(),
  followSymlinks: z.boolean().optional(),
});

const OutputConfigSchema = z.object({
  format: z.enum(['text', 'json', 'markdown']).optional(),
  verbosity: z.enum(['quiet', 'normal', 'verbose']).optional(),
  color: z.boolean().optional(),
  icons: z.boolean().optional(),
});

const AutoGuideConfigSchema = z.object({
  enabled: z.boolean().optional(),
  contextLevel: z.enum(['minimal', 'standard', 'full']).optional(),
});

export const HolonrcSchema = z.object({
  version: z.string().default('1.0'),
  rules: z.array(RuleOverrideSchema).optional(),
  categories: CategoryConfigSchema.optional(),
  scan: ScanConfigSchema.optional(),
  output: OutputConfigSchema.optional(),
  autoGuide: AutoGuideConfigSchema.optional(),
});

export type HolonrcInput = z.input<typeof HolonrcSchema>;
export type HolonrcOutput = z.output<typeof HolonrcSchema>;
```

---

## 5. 모듈 의존 관계

```
src/types/
  fractal.ts ──────────────────────────────────────────────┐
  rules.ts   ──────────────────────────────────────────┐   │
  config.ts  ──────────────────────────────────┐       │   │
  drift.ts   ──────────────────────────────────│───┐   │   │
  hooks.ts   (독립)                             │   │   │   │
  report.ts  ──────────────────────────────────┘   │   │   │
                                                   │   │   │
src/core/                                          │   │   │
                                                   │   │   │
  config-loader ◄── (config.ts)                   │   │   │
       │                                           │   │   │
       ▼                                           │   │   │
  rule-engine ◄── (rules.ts, config.ts)            │   │   │
       │                                           │   │   │
       │         category-classifier ◄── (fractal.ts, config.ts)
       │                │                          │   │   │
       │                ▼                          │   │   │
       └──────► fractal-scanner ◄── (fractal.ts, config.ts)
                        │
              ┌─────────┼─────────────┐
              ▼         ▼             ▼
       index-analyzer  module-main-  fractal-validator ◄── (rule-engine)
              │        analyzer       │
              │            │         │
              └────────────┴─────────┘
                           │
                    lca-calculator ◄── (fractal.ts)
                           │
                    drift-detector ◄── (drift.ts, fractal-validator, lca-calculator)
                           │
                    project-analyzer ◄── (report.ts, 모든 모듈 통합)
                           │
                           ▼
                    MCP Layer (tools/)
                    Hook Layer (hooks/)
```

**레벨 요약:**

| 레벨 | 모듈 | 의존 |
|------|------|------|
| 0 | `config-loader`, `category-classifier` | types만 |
| 1 | `rule-engine`, `fractal-scanner` | Level 0 |
| 2 | `index-analyzer`, `module-main-analyzer`, `fractal-validator` | Level 1 |
| 3 | `lca-calculator` | Level 2 (fractal-scanner) |
| 4 | `drift-detector` | Level 2-3 (validator, lca) |
| 5 | `project-analyzer` | Level 0-4 (전체 통합) |
| 6 | MCP tools, Hook handlers | Level 5 (project-analyzer 또는 개별 모듈) |
