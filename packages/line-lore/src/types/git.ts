import type { PlatformType } from './platform.js';
import type { TraceMode } from './trace.js';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitExecOptions {
  cwd?: string;
  timeout?: number;
  allowExitCodes?: number[];
  /** Mutable array for collecting diagnostic warnings throughout the pipeline */
  warnings?: string[];
}

export interface BlameExecOptions extends GitExecOptions {
  /** Blame semantics used by trace mode selection */
  mode?: TraceMode;
}

export interface RemoteInfo {
  owner: string;
  repo: string;
  host: string;
  platform: PlatformType | 'unknown';
}

export interface CloneStatus {
  partialClone: boolean;
  shallow: boolean;
}

export interface HealthReport {
  commitGraph: boolean;
  bloomFilter: boolean;
  gitVersion: string;
  hints: string[];
  partialClone: boolean;
  shallow: boolean;
}
