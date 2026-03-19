import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubAdapter } from '../github/github-adapter.js';
import { GitHubEnterpriseAdapter } from '../github/github-enterprise-adapter.js';
import { GitLabAdapter } from '../gitlab/gitlab-adapter.js';
import { GitLabSelfHostedAdapter } from '../gitlab/gitlab-self-hosted-adapter.js';

vi.mock('../../git/executor.js', () => ({
  shellExec: vi.fn(),
}));

async function getShellExecMock() {
  const { shellExec } = await import('../../git/executor.js');
  return shellExec as ReturnType<typeof vi.fn>;
}

describe('GitHubAdapter uses shellExec with gh command', () => {
  let mockShellExec: ReturnType<typeof vi.fn>;
  let adapter: GitHubAdapter;

  beforeEach(async () => {
    mockShellExec = await getShellExecMock();
    mockShellExec.mockReset();
    adapter = new GitHubAdapter({ hostname: 'github.com' });
  });

  it('checkAuth calls shellExec with gh auth token', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: 'gho_xxxxxxxxxxxx',
      stderr: '',
      exitCode: 0,
    });

    const result = await adapter.checkAuth();

    expect(result.authenticated).toBe(true);
    expect(mockShellExec).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['auth', 'token']),
      expect.any(Object),
    );
    // Verify first arg is 'gh', NOT 'git'
    expect(mockShellExec.mock.calls[0][0]).toBe('gh');
  });

  it('getPRForCommit calls shellExec with gh', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: JSON.stringify({ number: 42, title: 'test PR' }),
      stderr: '',
      exitCode: 0,
    });

    await adapter.getPRForCommit('abc123');

    expect(mockShellExec.mock.calls[0][0]).toBe('gh');
    expect(mockShellExec.mock.calls[0][1]).toContain('api');
  });
});

describe('GitHubEnterpriseAdapter uses shellExec with gh command', () => {
  let mockShellExec: ReturnType<typeof vi.fn>;
  let adapter: GitHubEnterpriseAdapter;

  beforeEach(async () => {
    mockShellExec = await getShellExecMock();
    mockShellExec.mockReset();
    adapter = new GitHubEnterpriseAdapter('git.corp.com');
  });

  it('checkAuth passes enterprise hostname to gh', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: 'gho_enterprise_token',
      stderr: '',
      exitCode: 0,
    });

    const result = await adapter.checkAuth();

    expect(result.authenticated).toBe(true);
    expect(mockShellExec).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['--hostname', 'git.corp.com']),
      expect.any(Object),
    );
  });
});

describe('GitLabAdapter uses shellExec with glab command', () => {
  let mockShellExec: ReturnType<typeof vi.fn>;
  let adapter: GitLabAdapter;

  beforeEach(async () => {
    mockShellExec = await getShellExecMock();
    mockShellExec.mockReset();
    adapter = new GitLabAdapter({ hostname: 'gitlab.com' });
  });

  it('checkAuth calls shellExec with glab', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: 'Logged in to gitlab.com as testuser',
      stderr: '',
      exitCode: 0,
    });

    const result = await adapter.checkAuth();

    expect(result.authenticated).toBe(true);
    expect(mockShellExec.mock.calls[0][0]).toBe('glab');
  });

  it('getPRForCommit calls shellExec with glab', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: JSON.stringify([
        { iid: 10, title: 'MR', web_url: 'https://gitlab.com/mr/10' },
      ]),
      stderr: '',
      exitCode: 0,
    });

    await adapter.getPRForCommit('def456');

    expect(mockShellExec.mock.calls[0][0]).toBe('glab');
    expect(mockShellExec.mock.calls[0][1]).toContain('api');
  });
});

describe('GitLabSelfHostedAdapter uses shellExec with glab command', () => {
  let mockShellExec: ReturnType<typeof vi.fn>;
  let adapter: GitLabSelfHostedAdapter;

  beforeEach(async () => {
    mockShellExec = await getShellExecMock();
    mockShellExec.mockReset();
    adapter = new GitLabSelfHostedAdapter('gitlab.corp.com');
  });

  it('checkAuth passes self-hosted hostname to glab', async () => {
    mockShellExec.mockResolvedValueOnce({
      stdout: 'Logged in to gitlab.corp.com as corpuser',
      stderr: '',
      exitCode: 0,
    });

    const result = await adapter.checkAuth();

    expect(result.authenticated).toBe(true);
    expect(mockShellExec).toHaveBeenCalledWith(
      'glab',
      expect.arrayContaining(['--hostname', 'gitlab.corp.com']),
      expect.any(Object),
    );
  });
});
