export interface CacheStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
}

export class MemoryCache<T> implements CacheStore<T> {
  protected store = new Map<string, T>();

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  set(key: string, value: T): void {
    this.store.set(key, value);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export class BoundedCache<T> implements CacheStore<T> {
  private store = new Map<string, T>();

  constructor(private maxCapacity: number) {
    if (maxCapacity <= 0) throw new Error("Capacity must be positive");
  }

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.set(key, value);
      return;
    }

    if (this.store.size >= this.maxCapacity) {
      // Evict oldest (first key in insertion order)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, value);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
