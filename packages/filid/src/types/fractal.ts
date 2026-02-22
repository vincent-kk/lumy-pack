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

/** Fractal node — a domain boundary with independent business logic */
export interface FractalNode {
  /** Absolute directory path */
  path: string;
  /** Node name (directory name) */
  name: string;
  /** Node classification */
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
  /** Source module path */
  from: string;
  /** Target module path */
  to: string;
  /** Dependency type */
  type: 'import' | 'export' | 'call' | 'inheritance';
}

/** Directed Acyclic Graph (DAG) */
export interface DependencyDAG {
  /** Set of node (module path) identifiers */
  nodes: Set<string>;
  /** Edge array */
  edges: DependencyEdge[];
  /** Adjacency list (from → to[]) */
  adjacency: Map<string, string[]>;
}

/** 디렉토리 항목 정보. 스캔 과정에서 내부적으로 사용한다. */
export interface DirEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

/** 개별 모듈의 정적 분석 정보. */
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
 * AST의 ExportInfo와 구분하기 위해 ModuleExportInfo로 명명.
 */
export interface ModuleExportInfo {
  name: string;
  kind: 'named' | 'default' | 'type' | 're-export';
  source?: string;
}

/** index.ts의 barrel 패턴 분석 결과. */
export interface BarrelPattern {
  isPureBarrel: boolean;
  reExportCount: number;
  declarationCount: number;
  missingExports: string[];
}

/** 모듈의 공개 API 명세. module-main-analyzer가 생성한다. */
export interface PublicApi {
  exports: ModuleExportInfo[];
  types: string[];
  functions: string[];
  classes: string[];
}
