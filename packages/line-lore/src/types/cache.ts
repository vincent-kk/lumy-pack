export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
}
