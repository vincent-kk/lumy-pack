/**
 * CLAUDE.md / SPEC.md document schema type definitions
 */

/** CLAUDE.md 3-tier boundary system */
export interface ThreeTierBoundary {
  /** Rules that must always be followed */
  alwaysDo: string[];
  /** Rules that require confirmation first */
  askFirst: string[];
  /** Rules that must never be violated */
  neverDo: string[];
}

/** CLAUDE.md document structure */
export interface ClaudeMdSchema {
  /** Fractal name */
  name: string;
  /** 1-2 line purpose description */
  purpose: string;
  /** Executable commands */
  commands: Record<string, string>;
  /** Key file/directory structure */
  structure: Record<string, string>;
  /** 3-tier boundary rules */
  boundaries: ThreeTierBoundary;
  /** Sibling fractal CLAUDE.md references */
  dependencies: string[];
  /** Total line count */
  lineCount: number;
}

/** SPEC.md document structure */
export interface SpecMdSchema {
  /** Module specification title */
  title: string;
  /** Functional requirements */
  requirements: string[];
  /** API interface definitions */
  apiContracts: string[];
  /** Last updated timestamp */
  lastUpdated: string;
  /** Compression metadata */
  compressionMeta?: CompressionMeta;
}

/** Compression metadata */
export interface CompressionMeta {
  /** Compression method */
  method: 'reversible' | 'lossy';
  /** Original line count */
  originalLines: number;
  /** Compressed line count */
  compressedLines: number;
  /** Compression timestamp */
  timestamp: string;
  /** Whether original can be recovered */
  recoverable: boolean;
}

/** CLAUDE.md validation result */
export interface ClaudeMdValidation {
  /** Whether valid */
  valid: boolean;
  /** List of violations */
  violations: DocumentViolation[];
}

/** SPEC.md validation result */
export interface SpecMdValidation {
  /** Whether valid */
  valid: boolean;
  /** List of violations */
  violations: DocumentViolation[];
}

/** Document rule violation */
export interface DocumentViolation {
  /** Violated rule */
  rule:
    | 'line-limit'
    | 'deduplication'
    | 'append-only'
    | 'missing-boundaries'
    | 'missing-section';
  /** Violation description */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning';
}
