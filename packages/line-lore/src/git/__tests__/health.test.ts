import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '@/errors.js';

import { gitExec } from '../executor.js';
import { checkCloneStatus, checkGitHealth } from '../health.js';

vi.mock('../executor.js', () => ({
  gitExec: vi.fn(),
}));

const mockGitExec = gitExec as ReturnType<typeof vi.fn>;

describe('checkGitHealth', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  it('reports commit-graph active when verify succeeds', async () => {
    mockGitExec
      .mockResolvedValueOnce({
        stdout: 'git version 2.40.0',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      // checkCloneStatus: shallow
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      // checkCloneStatus: partialClone
      .mockRejectedValueOnce(new Error('exit 1'));

    const report = await checkGitHealth();

    expect(report.commitGraph).toBe(true);
    expect(report.gitVersion).toBe('2.40.0');
  });

  it('reports commit-graph false with hint when verify fails', async () => {
    mockGitExec
      .mockResolvedValueOnce({
        stdout: 'git version 2.40.0',
        stderr: '',
        exitCode: 0,
      })
      .mockRejectedValueOnce(
        new LineLoreError(LineLoreErrorCode.GIT_COMMAND_FAILED, 'failed'),
      )
      // checkCloneStatus: shallow
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      // checkCloneStatus: partialClone
      .mockRejectedValueOnce(new Error('exit 1'));

    const report = await checkGitHealth();

    expect(report.commitGraph).toBe(false);
    expect(report.hints).toContainEqual(
      expect.stringContaining('git commit-graph write'),
    );
  });

  it('reports bloom filter available for git >= 2.27', async () => {
    mockGitExec
      .mockResolvedValueOnce({
        stdout: 'git version 2.40.0',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      // checkCloneStatus: shallow
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      // checkCloneStatus: partialClone
      .mockRejectedValueOnce(new Error('exit 1'));

    const report = await checkGitHealth();

    expect(report.bloomFilter).toBe(true);
  });

  it('reports bloom filter unavailable for old git', async () => {
    mockGitExec
      .mockResolvedValueOnce({
        stdout: 'git version 2.20.0',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      // checkCloneStatus: shallow
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      // checkCloneStatus: partialClone
      .mockRejectedValueOnce(new Error('exit 1'));

    const report = await checkGitHealth();

    expect(report.bloomFilter).toBe(false);
    expect(report.hints).toContainEqual(
      expect.stringContaining('Upgrade git to 2.27.0+'),
    );
  });

  it('never throws even when all checks fail', async () => {
    mockGitExec
      .mockRejectedValueOnce(new Error('git not found'))
      .mockRejectedValueOnce(new Error('no commit-graph'))
      // checkCloneStatus: shallow
      .mockRejectedValueOnce(new Error('git not found'))
      // checkCloneStatus: partialClone
      .mockRejectedValueOnce(new Error('git not found'));

    const report = await checkGitHealth();

    expect(report.gitVersion).toBe('0.0.0');
    expect(report.commitGraph).toBe(false);
    expect(report.bloomFilter).toBe(false);
    expect(report.hints.length).toBeGreaterThan(0);
  });

  it('includes clone status in health report', async () => {
    mockGitExec
      // git version
      .mockResolvedValueOnce({
        stdout: 'git version 2.43.0\n',
        stderr: '',
        exitCode: 0,
      })
      // commit-graph verify
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      // checkCloneStatus: shallow
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      // checkCloneStatus: partialClone
      .mockRejectedValueOnce(new Error('exit 1'));

    const report = await checkGitHealth();

    expect(report.partialClone).toBe(false);
    expect(report.shallow).toBe(false);
  });
});

describe('checkCloneStatus', () => {
  beforeEach(() => {
    mockGitExec.mockReset();
  });

  it('detects shallow repository', async () => {
    mockGitExec
      .mockResolvedValueOnce({ stdout: 'true\n', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(new Error('exit 1'));

    const status = await checkCloneStatus();

    expect(status.shallow).toBe(true);
  });

  it('returns shallow=false when not shallow', async () => {
    mockGitExec
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      .mockRejectedValueOnce(new Error('exit 1'));

    const status = await checkCloneStatus();

    expect(status.shallow).toBe(false);
    expect(status.partialClone).toBe(false);
  });

  it('detects partial clone', async () => {
    mockGitExec
      .mockResolvedValueOnce({ stdout: 'false\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: 'blob:none\n',
        stderr: '',
        exitCode: 0,
      });

    const status = await checkCloneStatus();

    expect(status.partialClone).toBe(true);
  });

  it('returns defaults on git errors', async () => {
    mockGitExec.mockRejectedValue(new Error('git not found'));

    const status = await checkCloneStatus();

    expect(status).toEqual({ partialClone: false, shallow: false });
  });
});
