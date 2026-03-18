export type PlatformType =
  | 'github'
  | 'github-enterprise'
  | 'gitlab'
  | 'gitlab-self-hosted';

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
  scopes?: string[];
  hostname?: string;
}

export interface PRInfo {
  /** PR number (e.g., 123) */
  number: number;
  /** PR title */
  title: string;
  /** PR author username */
  author: string;
  /** Full URL to the PR */
  url: string;
  /** Merge commit hash */
  mergeCommit: string;
  /** Base branch the PR was merged into */
  baseBranch: string;
  /** Timestamp when the PR was merged (ISO 8601) */
  mergedAt?: string;
}

export interface IssueInfo {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: string[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface PlatformAdapter {
  readonly platform: PlatformType;
  checkAuth(): Promise<AuthStatus>;
  getPRForCommit(sha: string): Promise<PRInfo | null>;
  getPRCommits(prNumber: number): Promise<string[]>;
  getLinkedIssues(prNumber: number): Promise<IssueInfo[]>;
  getLinkedPRs(issueNumber: number): Promise<PRInfo[]>;
  getRateLimit(): Promise<RateLimitInfo>;
}
