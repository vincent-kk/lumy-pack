import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';

import * as tar from 'tar';

/**
 * Create a tar.gz archive from a list of file descriptors.
 * For in-memory content (like _metadata.json), writes temp files first.
 */
export async function createArchive(
  files: Array<{
    name: string;
    content?: Buffer | string;
    sourcePath?: string;
  }>,
  outputPath: string,
): Promise<void> {
  // Create a temp directory to stage files
  const tmpDir = await mkdtemp(join(tmpdir(), 'syncpoint-'));

  try {
    const fileNames: string[] = [];

    for (const file of files) {
      const targetPath = join(tmpDir, file.name);
      // Ensure parent directories exist
      const parentDir = join(
        tmpDir,
        file.name.split('/').slice(0, -1).join('/'),
      );
      if (parentDir !== tmpDir) {
        await mkdir(parentDir, { recursive: true });
      }

      if (file.content !== undefined) {
        await writeFile(targetPath, file.content);
      } else if (file.sourcePath) {
        const data = await readFile(file.sourcePath);
        await writeFile(targetPath, data);
      }

      fileNames.push(file.name);
    }

    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: tmpDir,
      },
      fileNames,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Extract a tar.gz archive to a destination directory.
 */
export async function extractArchive(
  archivePath: string,
  destDir: string,
): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await tar.extract({
    file: archivePath,
    cwd: destDir,
    preservePaths: false,
    filter: (path, entry) => {
      const normalizedPath = normalize(path);
      if (normalizedPath.includes('..')) return false;
      if (normalizedPath.startsWith('/')) return false;
      if (
        'type' in entry &&
        (entry.type === 'SymbolicLink' || entry.type === 'Link')
      )
        return false;
      return true;
    },
  });
}

/**
 * Read a single file from a tar.gz archive.
 * Returns the file content as a Buffer, or null if not found.
 */
export async function readFileFromArchive(
  archivePath: string,
  filename: string,
): Promise<Buffer | null> {
  if (filename.includes('..') || filename.startsWith('/')) {
    throw new Error(`Invalid filename: ${filename}`);
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'syncpoint-read-'));

  try {
    await tar.extract({
      file: archivePath,
      cwd: tmpDir,
      filter: (path) => {
        // Normalize — tar entries may have ./ prefix
        const normalized = path.replace(/^\.\//, '');
        return normalized === filename;
      },
    });

    const extractedPath = join(tmpDir, filename);
    try {
      return await readFile(extractedPath);
    } catch {
      return null;
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * List all entries in a tar.gz archive.
 */
export async function listArchiveEntries(
  archivePath: string,
): Promise<string[]> {
  const entries: string[] = [];

  await tar.list({
    file: archivePath,
    onReadEntry: (entry) => {
      entries.push(entry.path);
    },
  });

  return entries;
}
