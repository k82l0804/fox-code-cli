import { expect, test, describe, beforeEach } from "bun:test";
import { RateLimiter } from "../src/limiter";
import { defaultConfig } from "../src/config";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter((defaultConfig as any).rateLimit || { maxRequests: 5, windowMs: 1000 });
  });

  test("allows requests up to maxRequests", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed("127.0.0.1")).toBe(true);
    }
    expect(limiter.isAllowed("127.0.0.1")).toBe(false);
  });

  test("isolates rate limits per IP", () => {
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed("10.0.0.1");
    }
    expect(limiter.isAllowed("10.0.0.1")).toBe(false);
    expect(limiter.isAllowed("10.0.0.2")).toBe(true);
  });

  test("reset() clears history", () => {
    for (let i = 0; i < 5; i++) {
      limiter.isAllowed("127.0.0.1");
    }
    expect(limiter.isAllowed("127.0.0.1")).toBe(false);
    limiter.reset();
    expect(limiter.isAllowed("127.0.0.1")).toBe(true);
  });
});
