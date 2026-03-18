/**
 * Result of parsing `git blame --porcelain` output for a specific line.
 */
export interface BlameResult {
  /** Full 40-character commit hash */
  commitHash: string;
  /** Author name */
  author: string;
  /** Author email */
  authorEmail: string;
  /** Commit timestamp (ISO 8601) */
  date: string;
  /** The actual content of the blamed line */
  lineContent: string;
  /** Original filename if the line was moved/renamed */
  originalFile?: string;
  /** Original line number before any moves/renames */
  originalLine?: number;
}

/**
 * Information about a Pull Request associated with a commit.
 */
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

/**
 * Combined result of tracing a line back to its PR.
 */
export interface TraceResult {
  /** Blame information for the target line */
  blame: BlameResult;
  /** PR information if found, null if commit is not from a PR */
  pr: PRInfo | null;
}

/**
 * Options for the trace operation.
 */
export interface TraceOptions {
  /** Path to the file to trace */
  file: string;
  /** Starting line number (1-indexed) */
  line: number;
  /** Ending line number for range queries (inclusive) */
  endLine?: number;
  /** Git remote name to use for PR lookups (default: 'origin') */
  remote?: string;
  /** Output in JSON format */
  json?: boolean;
  /** Enable deep trace (squash PR recursive exploration) */
  deep?: boolean;
  /** Issue graph traversal depth (0=PR only, 1=issues, 2+=multi-hop) */
  graphDepth?: number;
  /** Disable AST diff analysis */
  noAst?: boolean;
  /** Disable cache */
  noCache?: boolean;
  /** Output format */
  output?: 'human' | 'json' | 'llm';
  /** Suppress output (return PR number only) */
  quiet?: boolean;
}

/**
 * Basic commit information from git log.
 */
export interface CommitInfo {
  /** Full 40-character commit hash */
  hash: string;
  /** Short (7-character) commit hash */
  shortHash: string;
  /** Commit subject line */
  subject: string;
  /** Commit author name */
  author: string;
  /** Commit timestamp (ISO 8601) */
  date: string;
}

// --- Pipeline types ---

export type TraceNodeType =
  | 'original_commit'
  | 'cosmetic_commit'
  | 'merge_commit'
  | 'rebased_commit'
  | 'pull_request'
  | 'issue';

export type TrackingMethod =
  | 'blame'
  | 'blame-CMw'
  | 'ast-signature'
  | 'ancestry-path'
  | 'patch-id'
  | 'api'
  | 'message-parse'
  | 'issue-link';

export type Confidence = 'exact' | 'structural' | 'heuristic';

export interface TraceNode {
  type: TraceNodeType;
  sha?: string;
  trackingMethod: TrackingMethod;
  confidence: Confidence;
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  patchId?: string;
  note?: string;
  mergedAt?: string;
  issueNumber?: number;
  issueUrl?: string;
  issueTitle?: string;
  issueState?: 'open' | 'closed';
  issueLabels?: string[];
}

// --- Platform types ---

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

// --- Operating level ---

export type OperatingLevel = 0 | 1 | 2;

export interface FeatureFlags {
  astDiff: boolean;
  deepTrace: boolean;
  commitGraph: boolean;
  issueGraph: boolean;
  graphql: boolean;
}

// --- Output types ---

export interface NormalizedResponse<T> {
  tool: 'line-lore';
  command: string;
  version: string;
  timestamp: string;
  status: 'success' | 'partial' | 'error';
  operatingLevel: OperatingLevel;
  data?: T;
  error?: {
    code: string;
    message: string;
    stage?: number;
    recoverable: boolean;
    suggestion?: string;
  };
  partialData?: Partial<T>;
  warnings?: string[];
  hints?: {
    canRetryWithFlags?: string[];
    relatedCommands?: string[];
    cacheHit?: boolean;
  };
}

// --- Git infrastructure types ---

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitExecOptions {
  cwd?: string;
  timeout?: number;
  allowExitCodes?: number[];
}

export interface RemoteInfo {
  owner: string;
  repo: string;
  host: string;
  platform: PlatformType | 'unknown';
}

export interface HealthReport {
  commitGraph: boolean;
  bloomFilter: boolean;
  gitVersion: string;
  hints: string[];
}

// --- Cache types ---

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
}

// --- Utility types ---

export interface LineRange {
  start: number;
  end: number;
}

// --- Graph types ---

export interface GraphOptions {
  type: 'pr' | 'issue';
  number: number;
  depth?: number;
  json?: boolean;
}

export interface GraphResult {
  nodes: TraceNode[];
  edges: Array<{ from: string; to: string; relation: string }>;
}
