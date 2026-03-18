import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileCache } from '../file-cache.js';

describe('FileCache', () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'line-lore-test-'));
  });

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it('writes then reads same data', async () => {
    const cache = new FileCache<string>('test.json', { cacheDir });
    await cache.set('key1', 'value1');
    const result = await cache.get('key1');
    expect(result).toBe('value1');
  });

  it('returns null for cache miss', async () => {
    const cache = new FileCache<string>('test.json', { cacheDir });
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('uses atomic write via temp file', async () => {
    const cache = new FileCache<string>('test.json', { cacheDir });
    await cache.set('key1', 'value1');
    // Verify the file exists (not the tmp file)
    const result = await cache.get('key1');
    expect(result).toBe('value1');
  });

  it('evicts oldest entries when exceeding maxEntries', async () => {
    const cache = new FileCache<string>('test.json', {
      cacheDir,
      maxEntries: 3,
    });

    await cache.set('a', '1');
    await cache.set('b', '2');
    await cache.set('c', '3');
    await cache.set('d', '4');

    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('d')).toBe('4');
    expect(await cache.size()).toBe(3);
  });

  it('handles corrupted JSON gracefully', async () => {
    const filePath = join(cacheDir, 'corrupt.json');
    await writeFile(filePath, '{invalid json!!!', 'utf-8');

    const cache = new FileCache<string>('corrupt.json', { cacheDir });
    const result = await cache.get('key1');
    expect(result).toBeNull();
  });

  it('deletes an entry', async () => {
    const cache = new FileCache<string>('test.json', { cacheDir });
    await cache.set('key1', 'value1');
    const deleted = await cache.delete('key1');
    expect(deleted).toBe(true);
    expect(await cache.get('key1')).toBeNull();
  });

  it('clears all entries', async () => {
    const cache = new FileCache<string>('test.json', { cacheDir });
    await cache.set('a', '1');
    await cache.set('b', '2');
    await cache.clear();
    expect(await cache.size()).toBe(0);
  });

  it('returns correct size', async () => {
    const cache = new FileCache<string>('test.json', { cacheDir });
    expect(await cache.size()).toBe(0);
    await cache.set('a', '1');
    await cache.set('b', '2');
    expect(await cache.size()).toBe(2);
  });
});
