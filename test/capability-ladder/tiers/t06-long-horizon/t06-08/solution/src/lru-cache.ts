interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private map: Map<K, Entry<V>> = new Map();

  constructor(public capacity: number, public defaultTtlMs = 0) {}

  private isExpired(entry: Entry<V>): boolean {
    if (entry.expiresAt === 0) return false;
    return Date.now() > entry.expiresAt;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const expiresAt = ttl > 0 ? Date.now() + ttl : 0;

    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict first key (least recently used)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, { value, expiresAt });
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh LRU ordering
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
