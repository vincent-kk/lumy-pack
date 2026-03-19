import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '@/errors.js';

import { gitExec, shellExec } from '../executor.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

async function getExecaMock() {
  const { execa } = await import('execa');
  return execa as ReturnType<typeof vi.fn>;
}

describe('gitExec', () => {
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockExeca = await getExecaMock();
    mockExeca.mockReset();
  });

  it('returns stdout/stderr/exitCode on success', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: 'v2.40.0',
      stderr: '',
      exitCode: 0,
    });

    const result = await gitExec(['version']);

    expect(result).toEqual({
      stdout: 'v2.40.0',
      stderr: '',
      exitCode: 0,
    });
    expect(mockExeca).toHaveBeenCalledWith('git', ['version'], {
      cwd: undefined,
      timeout: undefined,
      reject: false,
    });
  });

  it('throws GIT_COMMAND_FAILED on non-zero exit code', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: 'fatal: not a git repository',
      exitCode: 128,
    });

    try {
      await gitExec(['status']);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(
        LineLoreErrorCode.GIT_COMMAND_FAILED,
      );
    }
  });

  it('throws GIT_TIMEOUT when command times out', async () => {
    const timeoutError = new Error('timed out');
    Object.assign(timeoutError, { isTerminated: true, timedOut: true });
    mockExeca.mockRejectedValueOnce(timeoutError);

    try {
      await gitExec(['log'], { timeout: 5000 });
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.GIT_TIMEOUT);
    }
  });

  it('passes custom cwd to execa', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await gitExec(['status'], { cwd: '/tmp/test-repo' });

    expect(mockExeca).toHaveBeenCalledWith('git', ['status'], {
      cwd: '/tmp/test-repo',
      timeout: undefined,
      reject: false,
    });
  });

  it('allows specified exit codes via allowExitCodes', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    const result = await gitExec(['diff', '--quiet'], {
      allowExitCodes: [1],
    });

    expect(result.exitCode).toBe(1);
  });
});

describe('shellExec', () => {
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockExeca = await getExecaMock();
    mockExeca.mockReset();
  });

  it('executes the specified command instead of git', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: 'logged in',
      stderr: '',
      exitCode: 0,
    });

    const result = await shellExec('gh', ['auth', 'status']);

    expect(result.stdout).toBe('logged in');
    expect(mockExeca).toHaveBeenCalledWith('gh', ['auth', 'status'], {
      cwd: undefined,
      timeout: undefined,
      reject: false,
    });
  });

  it('throws API_REQUEST_FAILED on non-zero exit code', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: 'not authenticated',
      exitCode: 1,
    });

    try {
      await shellExec('gh', ['auth', 'status']);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(
        LineLoreErrorCode.API_REQUEST_FAILED,
      );
    }
  });

  it('uses the command name in error messages', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: 'failed',
      exitCode: 1,
    });

    try {
      await shellExec('glab', ['api', 'test']);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as LineLoreError).message).toContain('glab api');
    }
  });

  it('supports allowExitCodes like gitExec', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    const result = await shellExec('gh', ['auth', 'status'], {
      allowExitCodes: [1],
    });

    expect(result.exitCode).toBe(1);
  });
});
