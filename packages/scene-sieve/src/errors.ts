export const SieveErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PIPELINE_ERROR: 'PIPELINE_ERROR',
  WORKER_ERROR: 'WORKER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type SieveErrorCode = (typeof SieveErrorCode)[keyof typeof SieveErrorCode];
