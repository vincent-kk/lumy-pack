export const SieveErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PIPELINE_ERROR: 'PIPELINE_ERROR',
  WORKER_ERROR: 'WORKER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type SieveErrorCode =
  (typeof SieveErrorCode)[keyof typeof SieveErrorCode];

/**
 * Classify pipeline errors for structured CLI responses.
 * @param error - Failure with a diagnostic message and optional filesystem code.
 * @returns The existing error code matching the failure.
 */
export function classifyError(error: Error): SieveErrorCode {
  const msg = error.message.toLowerCase();
  if (msg.includes('must be')) {
    return SieveErrorCode.INVALID_INPUT;
  } else if (
    (error as NodeJS.ErrnoException).code === 'ENOENT' ||
    msg.includes('not found')
  ) {
    return SieveErrorCode.FILE_NOT_FOUND;
  } else if (
    msg.includes('no video stream') ||
    msg.includes('invalid format')
  ) {
    return SieveErrorCode.INVALID_FORMAT;
  } else if (msg.includes('worker')) {
    return SieveErrorCode.WORKER_ERROR;
  } else {
    return SieveErrorCode.PIPELINE_ERROR;
  }
}
