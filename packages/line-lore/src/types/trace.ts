import type { BlameResult } from './blame.js';
import type { PRInfo } from './platform.js';

/**
 * Combined result of tracing a line back to its PR.
 */
export interface TraceResult {
  /** Blame information for the target line */
  blame: BlameResult;
  /** PR information if found, null if commit is not from a PR */
  pr: PRInfo | null;
}

/**
 * Options for the trace operation.
 */
export interface TraceOptions {
  /** Path to the file to trace */
  file: string;
  /** Starting line number (1-indexed) */
  line: number;
  /** Ending line number for range queries (inclusive) */
  endLine?: number;
  /** Git remote name to use for PR lookups (default: 'origin') */
  remote?: string;
  /** Output in JSON format */
  json?: boolean;
  /** Enable deep trace (squash PR recursive exploration) */
  deep?: boolean;
  /** Issue graph traversal depth (0=PR only, 1=issues, 2+=multi-hop) */
  graphDepth?: number;
  /** Disable AST diff analysis */
  noAst?: boolean;
  /** Disable cache */
  noCache?: boolean;
  /** Output format */
  output?: 'human' | 'json' | 'llm';
  /** Suppress output (return PR number only) */
  quiet?: boolean;
}
