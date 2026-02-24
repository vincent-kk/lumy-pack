import { mkdir, stat } from 'node:fs/promises';
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

export function resolveAbsolute(p: string): string {
  return resolve(p);
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
