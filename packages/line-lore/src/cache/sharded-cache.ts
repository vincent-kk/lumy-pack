import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { CacheEntry } from '../types/index.js';

export interface RepoIdentity {
  host: string;
  owner: string;
  repo: string;
}

const DEFAULT_CACHE_BASE = join(homedir(), '.line-lore', 'cache');
const DEFAULT_MAX_ENTRIES_PER_SHARD = 1_000;

type ShardStore<T> = Record<string, CacheEntry<T>>;

interface ShardState<T> {
  store: ShardStore<T> | null;
  writeQueue: Promise<void>;
}

function getShardPrefix(key: string): string {
  return key.slice(0, 2).toLowerCase();
}

export class ShardedCache<T> {
  private readonly baseDir: string;
  private readonly maxEntriesPerShard: number;
  private readonly enabled: boolean;
  private readonly shards = new Map<string, ShardState<T>>();

  constructor(
    namespace: string,
    options?: {
      repoId?: RepoIdentity;
      maxEntriesPerShard?: number;
      cacheBase?: string;
      enabled?: boolean;
    },
  ) {
    const cacheBase = options?.cacheBase ?? DEFAULT_CACHE_BASE;
    const repoId = options?.repoId ?? {
      host: '_local',
      owner: '_',
      repo: '_default',
    };
    this.baseDir = join(
      cacheBase,
      repoId.host,
      repoId.owner,
      repoId.repo,
      namespace,
    );
    this.maxEntriesPerShard =
      options?.maxEntriesPerShard ?? DEFAULT_MAX_ENTRIES_PER_SHARD;
    this.enabled = options?.enabled ?? true;
  }

  async get(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    const data = await this.readShard(getShardPrefix(key));
    const entry = data[key];
    return entry?.value ?? null;
  }

  async has(key: string): Promise<boolean> {
    if (!this.enabled) return false;
    const data = await this.readShard(getShardPrefix(key));
    return key in data;
  }

  set(key: string, value: T): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    const prefix = getShardPrefix(key);
    const state = this.getShardState(prefix);
    state.writeQueue = state.writeQueue
      .then(() => this.doSet(prefix, key, value))
      .catch(() => {});
    return state.writeQueue;
  }

  delete(key: string): Promise<boolean> {
    if (!this.enabled) return Promise.resolve(false);
    const prefix = getShardPrefix(key);
    const state = this.getShardState(prefix);
    let deleted = false;
    state.writeQueue = state.writeQueue
      .then(async () => {
        const data = await this.readShard(prefix);
        if (key in data) {
          delete data[key];
          state.store = data;
          await this.writeShard(prefix, data);
          deleted = true;
        }
      })
      .catch(() => {});
    return state.writeQueue.then(() => deleted);
  }

  async clear(): Promise<void> {
    this.shards.clear();
    try {
      await rm(this.baseDir, { recursive: true, force: true });
    } catch {
      // ignored
    }
  }

  async size(): Promise<number> {
    let total = 0;
    try {
      const files = await readdir(this.baseDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const prefix = file.replace('.json', '');
        const data = await this.readShard(prefix);
        total += Object.keys(data).length;
      }
    } catch {
      // directory doesn't exist yet
    }
    return total;
  }

  async destroy(): Promise<void> {
    this.shards.clear();
    try {
      await rm(this.baseDir, { recursive: true, force: true });
    } catch {
      // ignored
    }
  }

  private getShardState(prefix: string): ShardState<T> {
    let state = this.shards.get(prefix);
    if (!state) {
      state = { store: null, writeQueue: Promise.resolve() };
      this.shards.set(prefix, state);
    }
    return state;
  }

  private async doSet(
    prefix: string,
    key: string,
    value: T,
  ): Promise<void> {
    const state = this.getShardState(prefix);
    const data = await this.readShard(prefix);
    data[key] = { key, value, createdAt: Date.now() };

    const keys = Object.keys(data);
    if (keys.length > this.maxEntriesPerShard) {
      const sorted = keys.sort(
        (a, b) => data[a].createdAt - data[b].createdAt,
      );
      const toRemove = sorted.slice(0, keys.length - this.maxEntriesPerShard);
      for (const k of toRemove) {
        delete data[k];
      }
    }

    state.store = data;
    await this.writeShard(prefix, data);
  }

  private async readShard(prefix: string): Promise<ShardStore<T>> {
    const state = this.getShardState(prefix);
    if (state.store !== null) return state.store;

    const filePath = join(this.baseDir, `${prefix}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      state.store = JSON.parse(content) as ShardStore<T>;
      return state.store;
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ERR_INVALID_JSON')
      ) {
        console.warn(
          `[line-lore] Cache shard corrupted, resetting: ${filePath}`,
        );
        state.store = {};
        await this.writeShard(prefix, {});
        return state.store;
      }
      state.store = {};
      return state.store;
    }
  }

  private async writeShard(
    prefix: string,
    data: ShardStore<T>,
  ): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const filePath = join(this.baseDir, `${prefix}.json`);
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data), 'utf-8');
    await rename(tmpPath, filePath);
  }
}

/**
 * Removes the legacy flat cache files (pre-sharding).
 * Safe to call multiple times — no-ops if already cleaned.
 */
export async function cleanupLegacyCache(): Promise<void> {
  const legacyDir = join(homedir(), '.line-lore', 'cache');
  try {
    const entries = await readdir(legacyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          await rm(join(legacyDir, entry.name), { force: true });
        } catch {
          // ignored
        }
      }
    }
  } catch {
    // Directory doesn't exist or unreadable
  }
}
