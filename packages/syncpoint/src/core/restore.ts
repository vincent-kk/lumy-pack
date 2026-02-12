import { copyFile, lstat, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BACKUPS_DIR, METADATA_FILENAME, getSubDir } from '../constants.js';
import { formatDatetime } from '../utils/format.js';
import { logger } from '../utils/logger.js';
import { ensureDir, fileExists, resolveTargetPath } from '../utils/paths.js';
import type {
  BackupInfo,
  RestoreAction,
  RestoreOptions,
  RestorePlan,
  RestoreResult,
  SyncpointConfig,
} from '../utils/types.js';
import { computeFileHash, parseMetadata } from './metadata.js';
import {
  createArchive,
  extractArchive,
  readFileFromArchive,
} from './storage.js';

/**
 * List all backup archives in the backup directory, sorted by date desc.
 */
export async function getBackupList(
  config?: SyncpointConfig,
): Promise<BackupInfo[]> {
  const backupDir = config?.backup.destination
    ? resolveTargetPath(config.backup.destination)
    : getSubDir(BACKUPS_DIR);

  const exists = await fileExists(backupDir);
  if (!exists) return [];

  const entries = await readdir(backupDir, { withFileTypes: true });
  const backups: BackupInfo[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tar.gz')) continue;

    const fullPath = join(backupDir, entry.name);
    const fileStat = await stat(fullPath);

    // Try to read metadata for extra info
    let hostname: string | undefined;
    let fileCount: number | undefined;
    try {
      const metaBuf = await readFileFromArchive(fullPath, METADATA_FILENAME);
      if (metaBuf) {
        const meta = parseMetadata(metaBuf);
        hostname = meta.hostname;
        fileCount = meta.summary.fileCount;
      }
    } catch {
      logger.info(`Could not read metadata from: ${entry.name}`);
    }

    backups.push({
      filename: entry.name,
      path: fullPath,
      size: fileStat.size,
      createdAt: fileStat.mtime,
      hostname,
      fileCount,
    });
  }

  // Sort by date descending (newest first)
  backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return backups;
}

/**
 * Build a restore plan by reading metadata and comparing with current files.
 */
export async function getRestorePlan(
  archivePath: string,
): Promise<RestorePlan> {
  const metaBuf = await readFileFromArchive(archivePath, METADATA_FILENAME);
  if (!metaBuf) {
    throw new Error(
      `No metadata found in archive: ${archivePath}\nThis may not be a valid syncpoint backup.`,
    );
  }

  const metadata = parseMetadata(metaBuf);
  const actions: RestoreAction[] = [];

  for (const file of metadata.files) {
    const absPath = resolveTargetPath(file.path);
    const exists = await fileExists(absPath);

    if (!exists) {
      actions.push({
        path: file.path,
        action: 'create',
        backupSize: file.size,
        reason: 'File does not exist on this machine',
      });
      continue;
    }

    // Compare hashes
    const currentHash = await computeFileHash(absPath);
    const currentStat = await stat(absPath);

    if (currentHash === file.hash) {
      actions.push({
        path: file.path,
        action: 'skip',
        currentSize: currentStat.size,
        backupSize: file.size,
        reason: 'File is identical (same hash)',
      });
    } else {
      actions.push({
        path: file.path,
        action: 'overwrite',
        currentSize: currentStat.size,
        backupSize: file.size,
        reason: 'File has been modified',
      });
    }
  }

  return { metadata, actions };
}

/**
 * Create a safety backup of the given file paths before restoring.
 * Returns the path to the safety backup archive.
 */
export async function createSafetyBackup(filePaths: string[]): Promise<string> {
  const now = new Date();
  const filename = `_pre-restore_${formatDatetime(now)}.tar.gz`;
  const backupDir = getSubDir(BACKUPS_DIR);
  await ensureDir(backupDir);
  const archivePath = join(backupDir, filename);

  const files: Array<{ name: string; sourcePath: string }> = [];

  for (const fp of filePaths) {
    const absPath = resolveTargetPath(fp);
    const exists = await fileExists(absPath);
    if (!exists) continue;

    const archiveName = fp.startsWith('~/') ? fp.slice(2) : fp;
    files.push({ name: archiveName, sourcePath: absPath });
  }

  if (files.length === 0) {
    logger.info('No existing files to safety-backup.');
    return archivePath;
  }

  await createArchive(files, archivePath);
  logger.info(`Safety backup created: ${archivePath}`);

  return archivePath;
}

/**
 * Restore files from a backup archive.
 *
 * Flow:
 *   1. Read metadata
 *   2. Build restore plan
 *   3. Create safety backup of files that will be overwritten
 *   4. Extract and copy files to their target locations
 */
export async function restoreBackup(
  archivePath: string,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  const plan = await getRestorePlan(archivePath);
  const restoredFiles: string[] = [];
  const skippedFiles: string[] = [];

  // Determine which files will be overwritten
  const overwritePaths = plan.actions
    .filter((a) => a.action === 'overwrite')
    .map((a) => a.path);

  // Create safety backup if there are files to overwrite
  let safetyBackupPath: string | undefined;
  if (overwritePaths.length > 0 && !options.dryRun) {
    safetyBackupPath = await createSafetyBackup(overwritePaths);
  }

  if (options.dryRun) {
    return {
      restoredFiles: plan.actions
        .filter((a) => a.action !== 'skip')
        .map((a) => a.path),
      skippedFiles: plan.actions
        .filter((a) => a.action === 'skip')
        .map((a) => a.path),
      safetyBackupPath,
    };
  }

  // Extract archive to temp, then copy files to their destinations
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  const tmpDir = await mkdtemp(join(tmpdir(), 'syncpoint-restore-'));

  try {
    await extractArchive(archivePath, tmpDir);

    for (const action of plan.actions) {
      if (action.action === 'skip') {
        skippedFiles.push(action.path);
        continue;
      }

      const archiveName = action.path.startsWith('~/')
        ? action.path.slice(2)
        : action.path;
      const extractedPath = join(tmpDir, archiveName);
      const destPath = resolveTargetPath(action.path);

      const extractedExists = await fileExists(extractedPath);
      if (!extractedExists) {
        logger.warn(`File not found in archive: ${archiveName}`);
        skippedFiles.push(action.path);
        continue;
      }

      // Ensure destination directory exists
      await ensureDir(dirname(destPath));

      // Check if destination is a symlink (prevent symlink attacks)
      try {
        const destStat = await lstat(destPath);
        if (destStat.isSymbolicLink()) {
          logger.warn(`Skipping symlink target: ${action.path}`);
          skippedFiles.push(action.path);
          continue;
        }
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }

      await copyFile(extractedPath, destPath);
      restoredFiles.push(action.path);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  return { restoredFiles, skippedFiles, safetyBackupPath };
}
