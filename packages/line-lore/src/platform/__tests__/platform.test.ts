import { describe, expect, it } from 'vitest';

import { GitHubAdapter } from '../github/github-adapter.js';
import { GitHubEnterpriseAdapter } from '../github/github-enterprise-adapter.js';
import { GitLabAdapter } from '../gitlab/gitlab-adapter.js';
import { GitLabSelfHostedAdapter } from '../gitlab/gitlab-self-hosted-adapter.js';
import { createAdapter } from '../platform.js';
import { RequestScheduler } from '../scheduler/request-scheduler.js';

describe('createAdapter', () => {
  it('creates GitHubAdapter for github platform', () => {
    const adapter = createAdapter({
      platform: 'github',
      host: 'github.com',
      owner: 'org',
      repo: 'repo',
    });
    expect(adapter).toBeInstanceOf(GitHubAdapter);
    expect(adapter.platform).toBe('github');
  });

  it('creates GitHubEnterpriseAdapter for github-enterprise', () => {
    const adapter = createAdapter({
      platform: 'github-enterprise',
      host: 'git.corp.com',
      owner: 'org',
      repo: 'repo',
    });
    expect(adapter).toBeInstanceOf(GitHubEnterpriseAdapter);
    expect(adapter.platform).toBe('github-enterprise');
  });

  it('creates GitLabAdapter for gitlab platform', () => {
    const adapter = createAdapter({
      platform: 'gitlab',
      host: 'gitlab.com',
      owner: 'org',
      repo: 'repo',
    });
    expect(adapter).toBeInstanceOf(GitLabAdapter);
    expect(adapter.platform).toBe('gitlab');
  });

  it('creates GitLabSelfHostedAdapter for gitlab-self-hosted', () => {
    const adapter = createAdapter({
      platform: 'gitlab-self-hosted',
      host: 'gitlab.corp.com',
      owner: 'org',
      repo: 'repo',
    });
    expect(adapter).toBeInstanceOf(GitLabSelfHostedAdapter);
    expect(adapter.platform).toBe('gitlab-self-hosted');
  });

  it('defaults to GitHubEnterpriseAdapter for unknown platform', () => {
    const adapter = createAdapter({
      platform: 'unknown',
      host: 'custom.git.com',
      owner: 'org',
      repo: 'repo',
    });
    expect(adapter).toBeInstanceOf(GitHubEnterpriseAdapter);
  });
});

describe('RequestScheduler', () => {
  it('reports not rate limited initially', () => {
    const scheduler = new RequestScheduler();
    expect(scheduler.isRateLimited()).toBe(false);
  });

  it('reports rate limited when remaining < threshold', () => {
    const scheduler = new RequestScheduler({ rateLimitThreshold: 10 });
    scheduler.updateRateLimit({
      limit: 5000,
      remaining: 5,
      resetAt: new Date().toISOString(),
    });
    expect(scheduler.isRateLimited()).toBe(true);
  });

  it('stores and retrieves etags', () => {
    const scheduler = new RequestScheduler();
    scheduler.setEtag('/api/test', 'W/"abc123"', '{"data": true}');
    expect(scheduler.getEtag('/api/test')).toBe('W/"abc123"');
    expect(scheduler.getCachedResponse('/api/test')).toBe('{"data": true}');
  });

  it('returns null for unknown etags', () => {
    const scheduler = new RequestScheduler();
    expect(scheduler.getEtag('/unknown')).toBeNull();
  });
});
