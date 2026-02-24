import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, resolve } from 'node:path';

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Expand leading ~ to homedir. Node's path.resolve() does not expand ~,
 * so paths like ~/Desktop/foo depend on process.cwd() and can produce
 * different results when run from different directories.
 */
export function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Resolve path to absolute. Expands ~ to homedir first so that the result
 * does not depend on process.cwd().
 */
export function resolveAbsolute(p: string): string {
  return resolve(expandTilde(p));
}

/**
 * Derive default output directory name from input file path.
 * e.g., /path/to/video.mp4 -> /path/to/video_scenes
 */
export function deriveOutputPath(inputPath: string): string {
  const dir = resolve(inputPath, '..');
  const name = basename(inputPath, extname(inputPath));
  return resolve(dir, `${name}_scenes`);
}

export function isSupportedFile(
  filePath: string,
  extensions: string[],
): boolean {
  return extensions.includes(extname(filePath).toLowerCase());
}
