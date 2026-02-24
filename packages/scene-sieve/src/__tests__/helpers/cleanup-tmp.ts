import { readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Removes directories under os.tmpdir() whose names start with any of the given prefixes.
 * Used in globalTeardown to clean up tmp dirs left by tests or production code (e.g. on throw).
 * Only removes directories; errors during removal are logged and do not stop other removals.
 */
export function cleanupTmpDirs(prefixes: string[]): void {
  const base = tmpdir();
  let entries: string[];
  try {
    entries = readdirSync(base);
  } catch (err) {
    console.warn('[cleanup-tmp] Failed to read tmpdir:', err);
    return;
  }

  for (const name of entries) {
    const matches = prefixes.some((p) => name.startsWith(p));
    if (!matches) continue;

    const path = join(base, name);
    try {
      if (!statSync(path).isDirectory()) continue;
      rmSync(path, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[cleanup-tmp] Failed to remove ${path}:`, err);
    }
  }
}
