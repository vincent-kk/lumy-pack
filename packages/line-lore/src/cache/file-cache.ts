import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { CacheEntry } from '../types/index.js';

const DEFAULT_CACHE_DIR = join(homedir(), '.line-lore', 'cache');
const DEFAULT_MAX_ENTRIES = 10_000;

export class FileCache<T> {
  private readonly filePath: string;
  private readonly maxEntries: number;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    fileName: string,
    options?: { maxEntries?: number; cacheDir?: string },
  ) {
    const cacheDir = options?.cacheDir ?? DEFAULT_CACHE_DIR;
    this.filePath = join(cacheDir, fileName);
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async get(key: string): Promise<T | null> {
    const data = await this.readStore();
    const entry = data[key];
    return entry?.value ?? null;
  }

  async has(key: string): Promise<boolean> {
    const data = await this.readStore();
    return key in data;
  }

  set(key: string, value: T): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => this.doSet(key, value))
      .catch(() => {});
    return this.writeQueue;
  }

  delete(key: string): Promise<boolean> {
    let deleted = false;
    this.writeQueue = this.writeQueue
      .then(async () => {
        const data = await this.readStore();
        if (key in data) {
          delete data[key];
          await this.writeStore(data);
          deleted = true;
        }
      })
      .catch(() => {});
    return this.writeQueue.then(() => deleted);
  }

  clear(): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => this.writeStore({}))
      .catch(() => {});
    return this.writeQueue;
  }

  async size(): Promise<number> {
    const data = await this.readStore();
    return Object.keys(data).length;
  }

  private async doSet(key: string, value: T): Promise<void> {
    const data = await this.readStore();
    data[key] = { key, value, createdAt: Date.now() };

    const keys = Object.keys(data);
    if (keys.length > this.maxEntries) {
      const sorted = keys.sort((a, b) => data[a].createdAt - data[b].createdAt);
      const toRemove = sorted.slice(0, keys.length - this.maxEntries);
      for (const k of toRemove) {
        delete data[k];
      }
    }

    await this.writeStore(data);
  }

  private async readStore(): Promise<Record<string, CacheEntry<T>>> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as Record<string, CacheEntry<T>>;
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ERR_INVALID_JSON')
      ) {
        console.warn(
          `[line-lore] Cache file corrupted, resetting: ${this.filePath}`,
        );
        await this.writeStore({});
        return {};
      }
      return {};
    }
  }

  private async writeStore(data: Record<string, CacheEntry<T>>): Promise<void> {
    const dir = join(this.filePath, '..');
    await mkdir(dir, { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data), 'utf-8');
    await rename(tmpPath, this.filePath);
  }

  async destroy(): Promise<void> {
    try {
      await unlink(this.filePath);
    } catch {
      // File may not exist
    }
  }
}
