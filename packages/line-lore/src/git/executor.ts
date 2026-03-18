import { execa } from 'execa';

import { LineLoreError, LineLoreErrorCode } from '../errors.js';
import type { GitExecOptions, GitExecResult } from '../types/index.js';

export async function gitExec(
  args: string[],
  options?: GitExecOptions,
): Promise<GitExecResult> {
  const { cwd, timeout, allowExitCodes = [] } = options ?? {};

  try {
    const result = await execa('git', args, {
      cwd,
      timeout,
      reject: false,
    });

    const exitCode = result.exitCode ?? 0;

    if (exitCode !== 0 && !allowExitCodes.includes(exitCode)) {
      throw new LineLoreError(
        LineLoreErrorCode.GIT_COMMAND_FAILED,
        `git ${args[0]} failed with exit code ${exitCode}: ${result.stderr}`,
        { args, exitCode, stderr: result.stderr, cwd },
      );
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode,
    };
  } catch (error) {
    if (error instanceof LineLoreError) throw error;

    const isTimeout =
      error instanceof Error && 'isTerminated' in error && (error as Record<string, unknown>).timedOut === true;

    if (isTimeout) {
      throw new LineLoreError(
        LineLoreErrorCode.GIT_TIMEOUT,
        `git ${args[0]} timed out after ${timeout}ms`,
        { args, timeout, cwd },
      );
    }

    throw new LineLoreError(
      LineLoreErrorCode.GIT_COMMAND_FAILED,
      `git ${args[0]} failed: ${error instanceof Error ? error.message : String(error)}`,
      { args, cwd },
    );
  }
}
