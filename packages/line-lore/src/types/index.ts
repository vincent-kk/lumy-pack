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
