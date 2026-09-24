// TODO: Implement RateLimiter class
export class RateLimiter {
  constructor(public config: { maxRequests: number; windowMs: number }) {}

  isAllowed(ip: string): boolean {
    return false;
  }

  reset(): void {}
}
