import type { PlatformType } from './platform.js';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitExecOptions {
  cwd?: string;
  timeout?: number;
  allowExitCodes?: number[];
}

export interface RemoteInfo {
  owner: string;
  repo: string;
  host: string;
  platform: PlatformType | 'unknown';
}

export interface HealthReport {
  commitGraph: boolean;
  bloomFilter: boolean;
  gitVersion: string;
  hints: string[];
}
