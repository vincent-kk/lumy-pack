import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import fg from "fast-glob";

import {
  BACKUPS_DIR,
  LARGE_FILE_THRESHOLD,
  METADATA_FILENAME,
  SCRIPTS_DIR,
  SENSITIVE_PATTERNS,
  getSubDir,
} from "../constants.js";
import { expandTilde, resolveTargetPath, ensureDir, fileExists } from "../utils/paths.js";
import { generateFilename } from "../utils/format.js";
import { logger } from "../utils/logger.js";
import { collectFileInfo, createMetadata } from "./metadata.js";
import { createArchive } from "./storage.js";
import type {
  BackupOptions,
  BackupResult,
  FileEntry,
  SyncpointConfig,
} from "../utils/types.js";

/**
 * Check if a filename matches any sensitive patterns.
 */
function isSensitiveFile(filePath: string): boolean {
  const name = basename(filePath);
  return SENSITIVE_PATTERNS.some((pattern) => {
    if (pattern.startsWith("*")) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern || filePath.includes(pattern);
  });
}

/**
 * Scan config targets, resolve globs, filter excludes.
 * Returns found FileEntry[] and missing path strings.
 */
export async function scanTargets(
  config: SyncpointConfig,
): Promise<{ found: FileEntry[]; missing: string[] }> {
  const found: FileEntry[] = [];
  const missing: string[] = [];

  for (const target of config.backup.targets) {
    const expanded = expandTilde(target);

    // Check if this is a glob pattern
    if (expanded.includes("*") || expanded.includes("?") || expanded.includes("{")) {
      const matches = await fg(expanded, {
        dot: true,
        absolute: true,
        ignore: config.backup.exclude,
        onlyFiles: true,
      });
      for (const match of matches) {
        const entry = await collectFileInfo(match, match);
        found.push(entry);
      }
    } else {
      const absPath = resolveTargetPath(target);
      const exists = await fileExists(absPath);
      if (!exists) {
        missing.push(target);
        continue;
      }

      const entry = await collectFileInfo(absPath, absPath);

      // Warn about large files
      if (entry.size > LARGE_FILE_THRESHOLD) {
        logger.warn(
          `Large file (>${Math.round(LARGE_FILE_THRESHOLD / 1024 / 1024)}MB): ${target}`,
        );
      }

      // Warn about sensitive files
      if (isSensitiveFile(absPath)) {
        logger.warn(`Sensitive file detected: ${target}`);
      }

      found.push(entry);
    }
  }

  return { found, missing };
}

/**
 * Collect script files from ~/.syncpoint/scripts/ if configured.
 */
async function collectScripts(): Promise<FileEntry[]> {
  const scriptsDir = getSubDir(SCRIPTS_DIR);
  const exists = await fileExists(scriptsDir);
  if (!exists) return [];

  const entries: FileEntry[] = [];
  try {
    const files = await readdir(scriptsDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".sh")) {
        const absPath = join(scriptsDir, file.name);
        const entry = await collectFileInfo(absPath, absPath);
        entries.push(entry);
      }
    }
  } catch {
    logger.info("Skipping unreadable scripts directory");
  }

  return entries;
}

/**
 * Create a backup archive.
 *
 * Flow:
 *   1. Resolve config targets (globs, tilde expansion)
 *   2. Filter excludes
 *   3. Collect file info (stat + hash)
 *   4. Include scripts/ if configured
 *   5. Generate metadata
 *   6. Create tar.gz archive to destination
 */
export async function createBackup(
  config: SyncpointConfig,
  options: BackupOptions = {},
): Promise<BackupResult> {
  // 1-3. Scan targets
  const { found, missing } = await scanTargets(config);

  for (const m of missing) {
    logger.warn(`File not found, skipping: ${m}`);
  }

  // 4. Include scripts if configured
  let allFiles = [...found];
  if (config.scripts.includeInBackup) {
    const scripts = await collectScripts();
    allFiles = [...allFiles, ...scripts];
  }

  if (allFiles.length === 0) {
    throw new Error("No files found to backup.");
  }

  // 5. Create metadata
  const metadata = createMetadata(allFiles, config);

  // 6. Determine output path
  const filename = generateFilename(config.backup.filename, {
    tag: options.tag,
  });
  const archiveFilename = `${filename}.tar.gz`;

  const destDir = config.backup.destination
    ? resolveTargetPath(config.backup.destination)
    : getSubDir(BACKUPS_DIR);

  await ensureDir(destDir);
  const archivePath = join(destDir, archiveFilename);

  if (options.dryRun) {
    return { archivePath, metadata };
  }

  // Build archive file list
  const archiveFiles: Array<{
    name: string;
    content?: Buffer | string;
    sourcePath?: string;
  }> = [];

  // Add metadata
  archiveFiles.push({
    name: METADATA_FILENAME,
    content: JSON.stringify(metadata, null, 2),
  });

  // Add all target files, using their logical path as archive name
  for (const file of allFiles) {
    archiveFiles.push({
      name: file.path.startsWith("~/") ? file.path.slice(2) : file.path,
      sourcePath: file.absolutePath,
    });
  }

  await createArchive(archiveFiles, archivePath);

  logger.success(`Backup created: ${archivePath}`);

  return { archivePath, metadata };
}
