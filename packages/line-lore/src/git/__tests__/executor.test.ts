import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '@/errors.js';

import { gitExec, gitPipe, shellExec } from '../executor.js';

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

  it('throws NOT_GIT_REPO on exit code 128 with "not a git repository"', async () => {
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
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.NOT_GIT_REPO);
    }
  });

  it('throws GIT_COMMAND_FAILED on non-zero exit code', async () => {
    mockExeca.mockResolvedValueOnce({
      stdout: '',
      stderr: 'fatal: bad revision',
      exitCode: 128,
    });

    try {
      await gitExec(['log', 'bad-ref']);
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

describe('gitPipe', () => {
  let mockExeca: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockExeca = await getExecaMock();
    mockExeca.mockReset();
  });

  function mockPipeResult(result: {
    stdout: string;
    stderr: string;
    exitCode: number;
  }) {
    const mockPipe = vi.fn().mockResolvedValueOnce(result);
    mockExeca.mockReturnValueOnce({ pipe: mockPipe });
    return mockPipe;
  }

  it('returns stdout/stderr/exitCode on success', async () => {
    mockPipeResult({
      stdout: 'patchid abc123',
      stderr: '',
      exitCode: 0,
    });

    const result = await gitPipe(
      ['diff', 'abc^..abc'],
      ['patch-id', '--stable'],
    );

    expect(result).toEqual({
      stdout: 'patchid abc123',
      stderr: '',
      exitCode: 0,
    });
  });

  it('passes cwd and timeout to both producer and consumer', async () => {
    const mockPipe = mockPipeResult({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await gitPipe(['log', '-p'], ['patch-id'], {
      cwd: '/tmp/repo',
      timeout: 30_000,
    });

    expect(mockExeca).toHaveBeenCalledWith('git', ['log', '-p'], {
      cwd: '/tmp/repo',
      timeout: 30_000,
      reject: false,
    });
    expect(mockPipe).toHaveBeenCalledWith('git', ['patch-id'], {
      cwd: '/tmp/repo',
      timeout: 30_000,
      reject: false,
    });
  });

  it('throws GIT_COMMAND_FAILED on non-zero exit code', async () => {
    mockPipeResult({
      stdout: '',
      stderr: 'fatal: bad revision',
      exitCode: 128,
    });

    try {
      await gitPipe(['diff', 'bad^..bad'], ['patch-id']);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(
        LineLoreErrorCode.GIT_COMMAND_FAILED,
      );
      expect((err as LineLoreError).message).toContain('exit code 128');
    }
  });

  it('throws GIT_TIMEOUT when pipe times out', async () => {
    const timeoutError = new Error('timed out');
    Object.assign(timeoutError, { isTerminated: true, timedOut: true });
    const mockPipe = vi.fn().mockRejectedValueOnce(timeoutError);
    mockExeca.mockReturnValueOnce({ pipe: mockPipe });

    try {
      await gitPipe(['log', '-p'], ['patch-id'], { timeout: 5000 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(LineLoreErrorCode.GIT_TIMEOUT);
    }
  });

  it('throws GIT_COMMAND_FAILED on unexpected error', async () => {
    const mockPipe = vi.fn().mockRejectedValueOnce(new Error('EPIPE'));
    mockExeca.mockReturnValueOnce({ pipe: mockPipe });

    try {
      await gitPipe(['log'], ['patch-id']);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(
        LineLoreErrorCode.GIT_COMMAND_FAILED,
      );
      expect((err as LineLoreError).message).toContain('EPIPE');
    }
  });
});
