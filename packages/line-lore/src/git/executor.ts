import { execa } from 'execa';

import { LineLoreError, LineLoreErrorCode } from '../errors.js';
import type { GitExecOptions, GitExecResult } from '../types/index.js';

async function execCommand(
  command: string,
  args: string[],
  options?: GitExecOptions,
  errorCode?: LineLoreErrorCode,
): Promise<GitExecResult> {
  const { cwd, timeout, allowExitCodes = [] } = options ?? {};
  const failCode = errorCode ?? LineLoreErrorCode.GIT_COMMAND_FAILED;

  try {
    const result = await execa(command, args, {
      cwd,
      timeout,
      reject: false,
    });

    const exitCode = result.exitCode ?? 0;

    if (exitCode !== 0 && !allowExitCodes.includes(exitCode)) {
      throw new LineLoreError(
        failCode,
        `${command} ${args[0]} failed with exit code ${exitCode}: ${result.stderr}`,
        { command, args, exitCode, stderr: result.stderr, cwd },
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
      error instanceof Error &&
      'isTerminated' in error &&
      (error as Record<string, unknown>).timedOut === true;

    if (isTimeout) {
      throw new LineLoreError(
        LineLoreErrorCode.GIT_TIMEOUT,
        `${command} ${args[0]} timed out after ${timeout}ms`,
        { command, args, timeout, cwd },
      );
    }

    throw new LineLoreError(
      failCode,
      `${command} ${args[0]} failed: ${error instanceof Error ? error.message : String(error)}`,
      { command, args, cwd },
    );
  }
}

export async function gitExec(
  args: string[],
  options?: GitExecOptions,
): Promise<GitExecResult> {
  return execCommand(
    'git',
    args,
    options,
    LineLoreErrorCode.GIT_COMMAND_FAILED,
  );
}

export async function shellExec(
  command: string,
  args: string[],
  options?: GitExecOptions,
): Promise<GitExecResult> {
  return execCommand(
    command,
    args,
    options,
    LineLoreErrorCode.API_REQUEST_FAILED,
  );
}
