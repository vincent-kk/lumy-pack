export const LineLoreErrorCode = {
  NOT_GIT_REPO: 'NOT_GIT_REPO',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_LINE: 'INVALID_LINE',
  GIT_BLAME_FAILED: 'GIT_BLAME_FAILED',
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
} as const;

export type LineLoreErrorCode =
  (typeof LineLoreErrorCode)[keyof typeof LineLoreErrorCode];
