import { shellExec } from '../../git/executor.js';
import type {
  AuthStatus,
  IssueInfo,
  PRInfo,
  PlatformAdapter,
  RateLimitInfo,
} from '../../types/index.js';
import { RequestScheduler } from '../scheduler/index.js';

export class GitLabAdapter implements PlatformAdapter {
  readonly platform: PlatformAdapter['platform'] = 'gitlab';
  private readonly scheduler: RequestScheduler;
  private readonly hostname: string;

  constructor(options?: { hostname?: string; scheduler?: RequestScheduler }) {
    this.hostname = options?.hostname ?? 'gitlab.com';
    this.scheduler = options?.scheduler ?? new RequestScheduler();
  }

  async checkAuth(): Promise<AuthStatus> {
    // Fast path: check GITLAB_TOKEN env var (no subprocess needed)
    if (process.env.GITLAB_TOKEN) {
      return { authenticated: true, hostname: this.hostname };
    }

    try {
      const result = await shellExec(
        'glab',
        ['auth', 'status', '--hostname', this.hostname],
        { allowExitCodes: [1] },
      );

      return {
        authenticated: result.exitCode === 0,
        hostname: this.hostname,
      };
    } catch {
      return { authenticated: false, hostname: this.hostname };
    }
  }

  async getPRForCommit(sha: string): Promise<PRInfo | null> {
    if (this.scheduler.isRateLimited()) return null;

    try {
      const result = await shellExec('glab', [
        'api',
        `projects/:id/repository/commits/${sha}/merge_requests`,
        '--hostname',
        this.hostname,
      ]);

      const mrs = JSON.parse(result.stdout);
      if (!Array.isArray(mrs) || mrs.length === 0) return null;

      const mr = mrs[0] as Record<string, unknown>;
      return {
        number: mr.iid as number,
        title: (mr.title as string) ?? '',
        author:
          ((mr.author as Record<string, unknown>)?.username as string) ?? '',
        url: (mr.web_url as string) ?? '',
        mergeCommit: (mr.merge_commit_sha as string) ?? sha,
        baseBranch: (mr.target_branch as string) ?? 'main',
        mergedAt: mr.merged_at as string | undefined,
      };
    } catch {
      return null;
    }
  }

  async getPRCommits(prNumber: number): Promise<string[]> {
    try {
      const result = await shellExec('glab', [
        'api',
        `projects/:id/merge_requests/${prNumber}/commits`,
        '--hostname',
        this.hostname,
      ]);

      const commits = JSON.parse(result.stdout);
      if (!Array.isArray(commits)) return [];
      return commits.map((c: Record<string, unknown>) => c.id as string);
    } catch {
      return [];
    }
  }

  async getLinkedIssues(prNumber: number): Promise<IssueInfo[]> {
    try {
      const result = await shellExec('glab', [
        'api',
        `projects/:id/merge_requests/${prNumber}/closes_issues`,
        '--hostname',
        this.hostname,
      ]);

      const issues = JSON.parse(result.stdout);
      if (!Array.isArray(issues)) return [];

      return issues.map((issue: Record<string, unknown>) => ({
        number: issue.iid as number,
        title: (issue.title as string) ?? '',
        url: (issue.web_url as string) ?? '',
        state:
          ((issue.state as string) ?? 'opened') === 'closed'
            ? ('closed' as const)
            : ('open' as const),
        labels: (issue.labels as string[]) ?? [],
      }));
    } catch {
      return [];
    }
  }

  async getLinkedPRs(issueNumber: number): Promise<PRInfo[]> {
    try {
      const result = await shellExec('glab', [
        'api',
        `projects/:id/issues/${issueNumber}/related_merge_requests`,
        '--hostname',
        this.hostname,
      ]);

      const mrs = JSON.parse(result.stdout);
      if (!Array.isArray(mrs)) return [];

      return mrs.map((mr: Record<string, unknown>) => ({
        number: mr.iid as number,
        title: (mr.title as string) ?? '',
        author:
          ((mr.author as Record<string, unknown>)?.username as string) ?? '',
        url: (mr.web_url as string) ?? '',
        mergeCommit: (mr.merge_commit_sha as string) ?? '',
        baseBranch: (mr.target_branch as string) ?? 'main',
        mergedAt: mr.merged_at as string | undefined,
      }));
    } catch {
      return [];
    }
  }

  async getRateLimit(): Promise<RateLimitInfo> {
    return { limit: 0, remaining: 0, resetAt: new Date().toISOString() };
  }
}
