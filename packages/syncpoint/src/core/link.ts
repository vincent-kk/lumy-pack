import {
  cp,
  lstat,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { getAppDir } from '../constants.js';
import { expandTilde } from '../utils/paths.js';
import type {
  LinkOptions,
  LinkResult,
  UnlinkOptions,
  UnlinkResult,
} from '../utils/types.js';

/**
 * Move ~/.syncpoint to {destination}/.syncpoint/ and create a symlink.
 * If ~/.syncpoint is already a symlink, unlink and restore before re-linking.
 */
export async function linkSyncpoint(
  destination: string,
  _options: LinkOptions = {},
): Promise<LinkResult> {
  const appDir = getAppDir(); // e.g. ~/.syncpoint (absolute path)
  const expandedDest = expandTilde(destination);
  const targetDir = join(expandedDest, '.syncpoint');

  let wasAlreadyLinked = false;

  // Check current state of appDir
  let lstats;
  try {
    lstats = await lstat(appDir);
  } catch {
    // appDir doesn't exist — nothing to link
    throw new Error(`${appDir} does not exist. Run "syncpoint init" first.`);
  }

  if (lstats.isSymbolicLink()) {
    wasAlreadyLinked = true;
    const existingTarget = await readlink(appDir);

    // Remove existing symlink
    await unlink(appDir);

    // Restore the existing target back to appDir (so we can re-link)
    if (existingTarget !== targetDir) {
      await rename(existingTarget, appDir);
    } else {
      // Same destination: just re-create the symlink
      await symlink(targetDir, appDir);
      return { appDir, targetDir, wasAlreadyLinked };
    }
  }

  // Move appDir -> targetDir, then symlink appDir -> targetDir
  // rename fails across filesystems (EXDEV). Wrap with a user-friendly message.
  try {
    await rename(appDir, targetDir);
  } catch (err) {
    const isExdev =
      err instanceof Error &&
      (err.message.includes('EXDEV') || err.message.includes('cross-device'));
    if (isExdev) {
      throw new Error(
        `Cannot move ${appDir} to ${targetDir}: source and destination are on different filesystems. ` +
          'Use a destination on the same filesystem, or manually copy the directory.',
      );
    }
    throw err;
  }
  await symlink(targetDir, appDir);

  return { appDir, targetDir, wasAlreadyLinked };
}

/**
 * Create a symlink ~/.syncpoint → <refPath>/.syncpoint.
 * For backwards compatibility, if refPath already points to a .syncpoint directory,
 * it is used as-is.
 * If ~/.syncpoint already exists, the caller must handle confirmation before invoking this.
 */
export async function linkSyncpointByRef(refPath: string): Promise<LinkResult> {
  const appDir = getAppDir();
  const absoluteRef = resolve(expandTilde(refPath));
  const targetDir =
    basename(absoluteRef) === '.syncpoint'
      ? absoluteRef
      : join(absoluteRef, '.syncpoint');

  let refStats;
  try {
    refStats = await stat(targetDir);
  } catch {
    throw new Error(`Reference syncpoint path does not exist: ${targetDir}`);
  }
  if (!refStats.isDirectory()) {
    throw new Error(
      `Reference syncpoint path is not a directory: ${targetDir}`,
    );
  }

  try {
    const existing = await lstat(appDir);
    if (existing.isSymbolicLink()) {
      await unlink(appDir);
    } else {
      await rm(appDir, { recursive: true, force: true });
    }
  } catch {
    // doesn't exist — nothing to remove
  }

  await symlink(targetDir, appDir);

  return { appDir, targetDir, wasAlreadyLinked: false };
}

/**
 * Remove the symlink at ~/.syncpoint and restore its contents by copying
 * from the symlink target back to ~/.syncpoint.
 * With options.clean=true, also removes the destination copy.
 */
export async function unlinkSyncpoint(
  options: UnlinkOptions = {},
): Promise<UnlinkResult> {
  const appDir = getAppDir();

  let lstats;
  try {
    lstats = await lstat(appDir);
  } catch {
    throw new Error(`${appDir} does not exist.`);
  }

  if (!lstats.isSymbolicLink()) {
    throw new Error(`${appDir} is not a symlink. Run "syncpoint link" first.`);
  }

  const targetDir = await readlink(appDir);

  // Remove the symlink
  await unlink(appDir);

  // Copy data from targetDir back to appDir
  await cp(targetDir, appDir, { recursive: true });

  // Optionally remove the destination copy
  if (options.clean) {
    await rm(targetDir, { recursive: true, force: true });
  }

  return { appDir, targetDir, cleaned: options.clean ?? false };
}
