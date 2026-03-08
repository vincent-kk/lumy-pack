import type { CliResponse } from './cli-response.js';

/**
 * Write a successful JSON response to stdout.
 */
export function respond<T>(
  command: string,
  data: T,
  startTime: number,
  version: string,
): void {
  const response: CliResponse<T> = {
    ok: true,
    command,
    data,
    meta: {
      version,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

/**
 * Write an error JSON response to stdout and set exit code to 1.
 */
export function respondError(
  command: string,
  code: string,
  message: string,
  startTime: number,
  version: string,
  details?: unknown,
): void {
  const response: CliResponse<never> = {
    ok: false,
    command,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    meta: {
      version,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
  process.stdout.write(JSON.stringify(response) + '\n');
  process.exitCode = 1;
}
