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
 * Options for the trace operation (library API).
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
  /** Enable deep trace (squash PR recursive exploration, expands patch-id scan) */
  deep?: boolean;
  /** Disable AST diff analysis */
  noAst?: boolean;
  /** Disable cache for this invocation */
  noCache?: boolean;
}
