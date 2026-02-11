import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function getHomeDir(): string {
  return process.env.SYNCPOINT_HOME || homedir();
}

/**
 * Expand ~ to the user's home directory.
 */
export function expandTilde(p: string): string {
  if (p === "~") return getHomeDir();
  if (p.startsWith("~/")) return join(getHomeDir(), p.slice(2));
  return p;
}

/**
 * Contract the home directory prefix back to ~.
 */
export function contractTilde(p: string): string {
  const home = getHomeDir();
  if (p === home) return "~";
  if (p.startsWith(home + "/")) return "~" + p.slice(home.length);
  return p;
}

/**
 * Resolve a target path (expand tilde, resolve relative).
 */
export function resolveTargetPath(p: string): string {
  return resolve(expandTilde(p));
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
