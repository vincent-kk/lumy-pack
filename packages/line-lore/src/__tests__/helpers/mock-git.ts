import { vi } from 'vitest';

import type { GitExecResult } from '../../types/index.js';

export function createMockGitExec() {
  const mockFn = vi.fn<(...args: unknown[]) => Promise<GitExecResult>>();

  return {
    gitExec: mockFn,
    mockResolvedGitOutput(stdout: string, stderr = '') {
      mockFn.mockResolvedValueOnce({ stdout, stderr, exitCode: 0 });
    },
    mockGitFailure(error: Error) {
      mockFn.mockRejectedValueOnce(error);
    },
    reset() {
      mockFn.mockReset();
    },
  };
}
