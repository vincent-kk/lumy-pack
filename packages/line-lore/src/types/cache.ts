export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
}

/** Disk-serialized PRInfo — date fields stored as numeric timestamps (ms) */
export interface CachedPRInfo {
  number: number;
  title: string;
  author: string;
  url: string;
  mergeCommit: string;
  baseBranch: string;
  /** Unix timestamp in milliseconds, NOT ISO 8601 string */
  mergedAt?: number;
}
