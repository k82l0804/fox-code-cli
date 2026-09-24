export class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(private maxRequests: number, private windowMs: number) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = (this.requests.get(key) ?? []).filter((t) => now - t < this.windowMs);

    if (timestamps.length >= this.maxRequests) {
      this.requests.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }
}
