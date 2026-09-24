import { expect, test, describe } from "bun:test";
import { CacheWarmer } from "../src/cache-warmer";

describe("CacheWarmer", () => {
  test("reliably warms all keys before resolving", async () => {
    const keys = ["k1", "k2", "k3"];
    const warmer = new CacheWarmer(async (k) => {
      await new Promise((r) => setTimeout(r, 20));
      return `val-${k}`;
    });

    await warmer.warmCache(keys);

    expect(warmer.isWarm()).toBe(true);
    for (const k of keys) {
      expect(warmer.get(k)).toBe(`val-${k}`);
    }
  });
});
