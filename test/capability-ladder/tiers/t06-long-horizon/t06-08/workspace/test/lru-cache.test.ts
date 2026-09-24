import { expect, test, describe } from "bun:test";
import { LRUCache } from "../src/lru-cache";

describe("LRUCache with TTL", () => {
  test("evicts least recently used on capacity limit", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBe(1); // 'a' accessed, so 'b' is older
    cache.set("c", 3); // 'b' evicted

    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  test("expires items after TTL", async () => {
    const cache = new LRUCache<string, string>(5, 50); // 50ms TTL
    cache.set("temp", "hello");
    expect(cache.get("temp")).toBe("hello");

    await new Promise((r) => setTimeout(r, 60));
    expect(cache.has("temp")).toBe(false);
    expect(cache.get("temp")).toBeUndefined();
  });
});
