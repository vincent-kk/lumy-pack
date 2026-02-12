export type {
  SyncpointConfig,
  BackupMetadata,
  FileEntry,
  TemplateConfig,
  TemplateStep,
  BackupResult,
  RestoreResult,
  RestorePlan,
  RestoreAction,
  StepResult,
  BackupOptions,
  RestoreOptions,
  ProvisionOptions,
  BackupInfo,
  StatusInfo,
} from './utils/types.js';

export { loadConfig, saveConfig, initDefaultConfig } from './core/config.js';
export { createBackup, scanTargets } from './core/backup.js';
export {
  restoreBackup,
  getBackupList,
  getRestorePlan,
} from './core/restore.js';
export { runProvision, loadTemplate, listTemplates } from './core/provision.js';
