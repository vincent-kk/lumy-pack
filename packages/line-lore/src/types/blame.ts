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
  /** Final line number in the current file */
  finalLine: number;
  /** Original filename if the line was moved/renamed */
  originalFile?: string;
  /** Original line number before any moves/renames */
  originalLine?: number;
}

/**
 * Result of running dual blame (origin + change) in parallel.
 * Used by origin mode to cross-validate blame results.
 */
export interface DualBlameResult {
  /** Primary blame results for the requested mode */
  blame: BlameResult[];
  /** Change-mode blame for cross-validation (populated only in origin mode) */
  changeBlame: BlameResult[];
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
