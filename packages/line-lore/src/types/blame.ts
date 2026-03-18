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
