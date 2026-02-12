import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';

import { VERSION } from '../version.js';
import { validateMetadata } from '../schemas/metadata.schema.js';
import { contractTilde } from '../utils/paths.js';
import { getHostname, getSystemInfo } from '../utils/system.js';
import type {
  BackupMetadata,
  FileEntry,
  SyncpointConfig,
} from '../utils/types.js';

const METADATA_VERSION = '1.0.0';

/**
 * Create a full metadata object for a backup.
 */
export function createMetadata(
  files: FileEntry[],
  config: SyncpointConfig,
): BackupMetadata {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return {
    version: METADATA_VERSION,
    toolVersion: VERSION,
    createdAt: new Date().toISOString(),
    hostname: getHostname(),
    system: getSystemInfo(),
    config: {
      filename: config.backup.filename,
      destination: config.backup.destination,
    },
    files,
    summary: {
      fileCount: files.length,
      totalSize,
    },
  };
}

/**
 * Parse and validate metadata from a buffer or string.
 */
export function parseMetadata(data: Buffer | string): BackupMetadata {
  const str = typeof data === 'string' ? data : data.toString('utf-8');
  const parsed = JSON.parse(str) as unknown;

  const result = validateMetadata(parsed);
  if (!result.valid) {
    throw new Error(`Invalid metadata:\n${(result.errors ?? []).join('\n')}`);
  }

  return parsed as BackupMetadata;
}

/**
 * Compute the SHA-256 hash of a file.
 * Returns "sha256:<hex>"
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Collect file information: size, hash, type detection.
 * @param absolutePath  The real filesystem path
 * @param logicalPath   The display path (e.g. ~/.zshrc)
 */
export async function collectFileInfo(
  absolutePath: string,
  logicalPath: string,
): Promise<FileEntry> {
  const lstats = await lstat(absolutePath);

  let type: string | undefined;
  if (lstats.isSymbolicLink()) {
    type = 'symlink';
  } else if (lstats.isDirectory()) {
    type = 'directory';
  }

  // For symlinks, use lstat size; for regular files compute hash
  let hash: string;
  if (lstats.isSymbolicLink()) {
    // Hash the link target path rather than the content
    hash = `sha256:${createHash('sha256').update(absolutePath).digest('hex')}`;
  } else {
    hash = await computeFileHash(absolutePath);
  }

  return {
    path: contractTilde(logicalPath),
    absolutePath,
    size: lstats.size,
    hash,
    type,
  };
}
