export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(public config: { maxRequests: number; windowMs: number }) {}

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = (this.requests.get(ip) || []).filter((t) => t > windowStart);

    if (timestamps.length >= this.config.maxRequests) {
      this.requests.set(ip, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);
    return true;
  }

  reset(): void {
    this.requests.clear();
  }
}
