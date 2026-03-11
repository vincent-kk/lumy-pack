export const SyncpointErrorCode = {
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  BACKUP_FAILED: 'BACKUP_FAILED',
  RESTORE_FAILED: 'RESTORE_FAILED',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  PROVISION_FAILED: 'PROVISION_FAILED',
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  LINK_FAILED: 'LINK_FAILED',
  UNLINK_FAILED: 'UNLINK_FAILED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type SyncpointErrorCode =
  (typeof SyncpointErrorCode)[keyof typeof SyncpointErrorCode];

/**
 * Classify an error into a SyncpointErrorCode based on the error message.
 */
export function classifyError(err: unknown): SyncpointErrorCode {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('Config file not found') ||
    msg.includes('Run "syncpoint init"')
  ) {
    return SyncpointErrorCode.CONFIG_NOT_FOUND;
  }
  if (msg.includes('Invalid config')) {
    return SyncpointErrorCode.CONFIG_INVALID;
  }
  if (
    msg.includes('Template not found') ||
    msg.includes('template not found')
  ) {
    return SyncpointErrorCode.TEMPLATE_NOT_FOUND;
  }
  if (msg.includes('Template file not found')) {
    return SyncpointErrorCode.TEMPLATE_NOT_FOUND;
  }
  if (msg.includes('not a symlink') || msg.includes('"syncpoint link"')) {
    return SyncpointErrorCode.UNLINK_FAILED;
  }
  if (
    msg.includes('destination is not set') ||
    msg.includes('cross-device') ||
    msg.includes('EXDEV')
  ) {
    return SyncpointErrorCode.LINK_FAILED;
  }
  return SyncpointErrorCode.UNKNOWN;
}
