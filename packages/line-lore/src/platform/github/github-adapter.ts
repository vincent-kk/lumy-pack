import { shellExec } from '../../git/executor.js';
import type {
  AuthStatus,
  IssueInfo,
  PRInfo,
  PlatformAdapter,
  RateLimitInfo,
} from '../../types/index.js';
import { RequestScheduler } from '../scheduler/index.js';

export class GitHubAdapter implements PlatformAdapter {
  readonly platform: PlatformAdapter['platform'] = 'github';
  private readonly scheduler: RequestScheduler;
  private readonly hostname: string;

  constructor(options?: { hostname?: string; scheduler?: RequestScheduler }) {
    this.hostname = options?.hostname ?? 'github.com';
    this.scheduler = options?.scheduler ?? new RequestScheduler();
  }

  async checkAuth(): Promise<AuthStatus> {
    try {
      const result = await shellExec(
        'gh',
        ['auth', 'status', '--hostname', this.hostname],
        {
          allowExitCodes: [1],
        },
      );

      // gh auth status returns user info on stdout/stderr
      const output = result.stdout + result.stderr;
      const usernameMatch = /Logged in to .+ as (\S+)/.exec(output);

      return {
        authenticated: result.exitCode === 0,
        username: usernameMatch?.[1],
        hostname: this.hostname,
      };
    } catch {
      return { authenticated: false, hostname: this.hostname };
    }
  }

  async getPRForCommit(sha: string): Promise<PRInfo | null> {
    if (this.scheduler.isRateLimited()) return null;

    try {
      const result = await shellExec('gh', [
        'api',
        `repos/{owner}/{repo}/commits/${sha}/pulls`,
        '--hostname',
        this.hostname,
        '--jq',
        '.[0] | {number, title, user: .user.login, html_url, merge_commit_sha, base: .base.ref, merged_at}',
      ]);

      const data = JSON.parse(result.stdout);
      if (!data?.number) return null;

      return {
        number: data.number,
        title: data.title ?? '',
        author: data.user ?? '',
        url: data.html_url ?? '',
        mergeCommit: data.merge_commit_sha ?? sha,
        baseBranch: data.base ?? 'main',
        mergedAt: data.merged_at,
      };
    } catch {
      return null;
    }
  }

  async getPRCommits(prNumber: number): Promise<string[]> {
    try {
      const result = await shellExec('gh', [
        'api',
        `repos/{owner}/{repo}/pulls/${prNumber}/commits`,
        '--hostname',
        this.hostname,
        '--jq',
        '.[].sha',
      ]);

      return result.stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async getLinkedIssues(prNumber: number): Promise<IssueInfo[]> {
    try {
      const result = await shellExec('gh', [
        'api',
        'graphql',
        '--hostname',
        this.hostname,
        '-f',
        `query=query { repository(owner: "{owner}", name: "{repo}") { pullRequest(number: ${prNumber}) { closingIssuesReferences(first: 10) { nodes { number title url state labels(first: 5) { nodes { name } } } } } } }`,
        '--jq',
        '.data.repository.pullRequest.closingIssuesReferences.nodes',
      ]);

      const nodes = JSON.parse(result.stdout);
      if (!Array.isArray(nodes)) return [];

      return nodes.map((node: Record<string, unknown>) => ({
        number: node.number as number,
        title: (node.title as string) ?? '',
        url: (node.url as string) ?? '',
        state: ((node.state as string) ?? 'open').toLowerCase() as
          | 'open'
          | 'closed',
        labels: (
          (node.labels as { nodes: Array<{ name: string }> })?.nodes ?? []
        ).map((l) => l.name),
      }));
    } catch {
      return [];
    }
  }

  async getLinkedPRs(issueNumber: number): Promise<PRInfo[]> {
    try {
      const result = await shellExec('gh', [
        'api',
        `repos/{owner}/{repo}/issues/${issueNumber}/timeline`,
        '--hostname',
        this.hostname,
        '--jq',
        '[.[] | select(.source.issue.pull_request) | .source.issue] | map({number, title, user: .user.login, html_url, merge_commit_sha: .pull_request.merge_commit_sha, base: "main", merged_at: .pull_request.merged_at})',
      ]);

      const prs = JSON.parse(result.stdout);
      if (!Array.isArray(prs)) return [];

      return prs.map((pr: Record<string, unknown>) => ({
        number: pr.number as number,
        title: (pr.title as string) ?? '',
        author: (pr.user as string) ?? '',
        url: (pr.html_url as string) ?? '',
        mergeCommit: (pr.merge_commit_sha as string) ?? '',
        baseBranch: (pr.base as string) ?? 'main',
        mergedAt: pr.merged_at as string | undefined,
      }));
    } catch {
      return [];
    }
  }

  async getRateLimit(): Promise<RateLimitInfo> {
    try {
      const result = await shellExec('gh', [
        'api',
        'rate_limit',
        '--hostname',
        this.hostname,
        '--jq',
        '.rate | {limit, remaining, reset}',
      ]);

      const data = JSON.parse(result.stdout);
      const info: RateLimitInfo = {
        limit: data.limit ?? 5000,
        remaining: data.remaining ?? 5000,
        resetAt: new Date((data.reset ?? 0) * 1000).toISOString(),
      };

      this.scheduler.updateRateLimit(info);
      return info;
    } catch {
      return { limit: 0, remaining: 0, resetAt: new Date().toISOString() };
    }
  }
}
