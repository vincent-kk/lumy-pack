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
import {
  detectPatternType,
  parseRegexPattern,
  createExcludeMatcher,
} from "../utils/pattern.js";
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
 *
 * Supports three pattern types:
 * - Regex: /pattern/ format (e.g., /\.conf$/)
 * - Glob: *.ext, **\/pattern (e.g., ~/.config/*.yml)
 * - Literal: Direct file paths (e.g., ~/.zshrc)
 *
 * Exclude patterns are applied consistently across all target types.
 */
export async function scanTargets(
  config: SyncpointConfig,
): Promise<{ found: FileEntry[]; missing: string[] }> {
  const found: FileEntry[] = [];
  const missing: string[] = [];

  // Create exclude matcher once for efficiency
  const isExcluded = createExcludeMatcher(config.backup.exclude);

  for (const target of config.backup.targets) {
    const expanded = expandTilde(target);
    const patternType = detectPatternType(expanded);

    if (patternType === "regex") {
      // Regex pattern: scan home directory and filter by regex
      try {
        const regex = parseRegexPattern(expanded);
        const homeDir = expandTilde("~/");

        // Ensure homeDir ends with / for proper glob pattern
        const homeDirNormalized = homeDir.endsWith("/") ? homeDir : `${homeDir}/`;

        const allFiles = await fg(`${homeDirNormalized}**`, {
          dot: true,
          absolute: true,
          onlyFiles: true,
          deep: 5, // Limit depth for performance
        });

        for (const match of allFiles) {
          if (regex.test(match) && !isExcluded(match)) {
            const entry = await collectFileInfo(match, match);
            found.push(entry);
          }
        }
      } catch (error) {
        logger.warn(
          `Invalid regex pattern "${target}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (patternType === "glob") {
      // Glob pattern: use fast-glob with glob-only excludes
      const globExcludes = config.backup.exclude.filter(
        (p) => detectPatternType(p) === "glob",
      );

      const matches = await fg(expanded, {
        dot: true,
        absolute: true,
        ignore: globExcludes,
        onlyFiles: true,
      });

      // Apply non-glob excludes (regex, literal) as post-filter
      for (const match of matches) {
        if (!isExcluded(match)) {
          const entry = await collectFileInfo(match, match);
          found.push(entry);
        }
      }
    } else {
      // Literal path: direct file check with exclude filter
      const absPath = resolveTargetPath(target);
      const exists = await fileExists(absPath);

      if (!exists) {
        missing.push(target);
        continue;
      }

      // Apply exclude patterns to literal paths
      if (isExcluded(absPath)) {
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
