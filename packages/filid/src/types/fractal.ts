/**
 * FCA-AI Fractal/Organ node type definitions
 */

/** Node classification type */
export type NodeType = 'fractal' | 'organ' | 'pure-function';

/** Fractal node — a domain boundary with independent business logic */
export interface FractalNode {
  /** Absolute directory path */
  path: string;
  /** Node name (directory name) */
  name: string;
  /** Node classification */
  type: NodeType;
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
}

/** Fractal tree — the complete hierarchy */
export interface FractalTree {
  /** Root node path */
  root: string;
  /** Path → node mapping */
  nodes: Map<string, FractalNode>;
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
