import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { join } from 'node:path';

import fg from 'fast-glob';

/**
 * Computes a hash of the project files for incremental skill caching.
 * Uses fast-glob to enumerate files — intentionally isolated from cache-manager.ts
 * so that context-injector hook bundles do NOT pull in fast-glob.
 */
export async function computeProjectHash(cwd: string): Promise<string> {
  const files = await fg('**/*.{ts,tsx,js,jsx,md}', {
    cwd,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.filid/review/**',
    ],
    absolute: false,
  });

  files.sort();

  const parts: string[] = [];
  for (const file of files) {
    try {
      const fullPath = join(cwd, file);
      const mtime = statSync(fullPath).mtimeMs;
      parts.push(`${file}:${mtime}`);
    } catch {
      // skip files that can't be stat'd
    }
  }

  const input = parts.join('\n');
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
