// ── Config ──

export interface SyncpointConfig {
  backup: {
    targets: string[];
    exclude: string[];
    filename: string;
    destination?: string;
    includeSensitiveFiles?: boolean;
  };
  scripts: {
    includeInBackup: boolean;
  };
}

// ── Metadata (stored inside archive as _metadata.json) ──

export interface BackupMetadata {
  version: string;
  toolVersion: string;
  createdAt: string;
  hostname: string;
  system: {
    platform: string;
    release: string;
    arch: string;
  };
  config: {
    filename: string;
    destination?: string;
  };
  files: FileEntry[];
  summary: {
    fileCount: number;
    totalSize: number;
  };
}

export interface FileEntry {
  path: string;
  absolutePath: string;
  size: number;
  hash: string;
  type?: string;
}

// ── Template (provisioning) ──

export interface TemplateConfig {
  name: string;
  description?: string;
  backup?: string;
  sudo?: boolean;
  steps: TemplateStep[];
}

export interface TemplateStep {
  name: string;
  description?: string;
  command: string;
  skip_if?: string;
  continue_on_error?: boolean;
}

// ── Results ──

export interface BackupResult {
  archivePath: string;
  metadata: BackupMetadata;
}

export interface RestoreResult {
  restoredFiles: string[];
  skippedFiles: string[];
  safetyBackupPath?: string;
}

export interface RestorePlan {
  metadata: BackupMetadata;
  actions: RestoreAction[];
}

export interface RestoreAction {
  path: string;
  action: 'overwrite' | 'skip' | 'create';
  currentSize?: number;
  backupSize?: number;
  reason: string;
}

export interface ProvisionResult {
  steps: StepResult[];
  totalDuration: number;
}

export interface StepResult {
  name: string;
  status: 'success' | 'skipped' | 'failed' | 'running' | 'pending';
  duration?: number;
  error?: string;
  output?: string;
}

// ── Options ──

export interface BackupOptions {
  dryRun?: boolean;
  tag?: string;
  verbose?: boolean;
}

export interface RestoreOptions {
  dryRun?: boolean;
}

export interface ProvisionOptions {
  dryRun?: boolean;
  skipRestore?: boolean;
  file?: string;
}

// ── Info / Status ──

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
  hostname?: string;
  fileCount?: number;
}

export interface StatusInfo {
  backups: { count: number; totalSize: number };
  templates: { count: number; totalSize: number };
  scripts: { count: number; totalSize: number };
  logs: { count: number; totalSize: number };
  lastBackup?: Date;
  oldestBackup?: Date;
}

export interface CleanupPolicy {
  type: 'keep-recent' | 'older-than' | 'select';
  count?: number;
  days?: number;
  indices?: number[];
}

// ── Legacy (kept for CLI compat) ──

export interface InitOptions {
  template: string;
  directory?: string;
  dryRun: boolean;
}

export interface CliOptions {
  verbose?: boolean;
}
