export class LRUCache<K, V> {
  constructor(public capacity: number, public defaultTtlMs = 0) {}

  set(key: K, value: V, ttlMs?: number): void {
    throw new Error("Not implemented");
  }

  get(key: K): V | undefined {
    return undefined;
  }

  has(key: K): boolean {
    return false;
  }

  delete(key: K): boolean {
    return false;
  }

  size(): number {
    return 0;
  }

  clear(): void {}
}
