import { describe, it, expect } from 'vitest';

import { LineLoreError, LineLoreErrorCode } from '../../errors.js';
import { parseRemoteUrl, detectPlatform } from '../../git/remote.js';

describe('parseRemoteUrl', () => {
  it('parses HTTPS GitHub URL', () => {
    const result = parseRemoteUrl('https://github.com/owner/repo.git');
    expect(result).toEqual({
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
      platform: 'github',
    });
  });

  it('parses SSH GitHub URL', () => {
    const result = parseRemoteUrl('git@github.com:owner/repo.git');
    expect(result).toEqual({
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
      platform: 'github',
    });
  });

  it('parses GitLab URL', () => {
    const result = parseRemoteUrl('https://gitlab.com/owner/repo.git');
    expect(result).toEqual({
      host: 'gitlab.com',
      owner: 'owner',
      repo: 'repo',
      platform: 'gitlab',
    });
  });

  it('detects enterprise host as unknown', () => {
    const result = parseRemoteUrl('https://git.corp.com/team/project.git');
    expect(result).toEqual({
      host: 'git.corp.com',
      owner: 'team',
      repo: 'project',
      platform: 'unknown',
    });
  });

  it('throws INVALID_REMOTE_URL for invalid URLs', () => {
    try {
      parseRemoteUrl('not-a-url');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LineLoreError);
      expect((err as LineLoreError).code).toBe(
        LineLoreErrorCode.INVALID_REMOTE_URL,
      );
    }
  });

  it('parses SSH with ssh:// prefix', () => {
    const result = parseRemoteUrl('ssh://git@github.com/owner/repo.git');
    expect(result).toEqual({
      host: 'github.com',
      owner: 'owner',
      repo: 'repo',
      platform: 'github',
    });
  });

  it('strips .git suffix from repo name', () => {
    const withGit = parseRemoteUrl('https://github.com/owner/repo.git');
    const withoutGit = parseRemoteUrl('https://github.com/owner/repo');
    expect(withGit.repo).toBe('repo');
    expect(withoutGit.repo).toBe('repo');
  });
});

describe('detectPlatform', () => {
  it('returns github for github.com', () => {
    expect(detectPlatform('github.com')).toBe('github');
  });

  it('returns gitlab for gitlab.com', () => {
    expect(detectPlatform('gitlab.com')).toBe('gitlab');
  });

  it('returns unknown for other hosts', () => {
    expect(detectPlatform('bitbucket.org')).toBe('unknown');
  });
});
