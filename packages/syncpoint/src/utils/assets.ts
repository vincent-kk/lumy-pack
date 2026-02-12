import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function getPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('Could not find package root');
}

export function getAssetPath(filename: string): string {
  return join(getPackageRoot(), 'assets', filename);
}

export function readAsset(filename: string): string {
  return readFileSync(getAssetPath(filename), 'utf-8');
}
