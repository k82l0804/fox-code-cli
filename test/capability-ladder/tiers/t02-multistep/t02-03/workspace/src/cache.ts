export interface CacheStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
}

// TODO: Implement MemoryCache<T> implements CacheStore<T>

// TODO: Implement BoundedCache<T> implements CacheStore<T>
