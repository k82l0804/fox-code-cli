export class CacheWarmer {
  private cache = new Map<string, string>();
  private loaded = false;

  constructor(private fetcher: (key: string) => Promise<string>) {}

  async warmCache(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const val = await this.fetcher(key);
        this.cache.set(key, val);
      })
    );
    this.loaded = true;
  }

  isWarm(): boolean {
    return this.loaded;
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }
}
