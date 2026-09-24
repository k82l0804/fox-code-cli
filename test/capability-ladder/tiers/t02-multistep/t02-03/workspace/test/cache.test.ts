import { expect, test, describe } from "bun:test";
import { MemoryCache, BoundedCache } from "../src/cache";

describe("MemoryCache", () => {
  test("stores and retrieves values", () => {
    const cache = new MemoryCache<string>();
    cache.set("a", "alpha");
    cache.set("b", "beta");
    expect(cache.get("a")).toBe("alpha");
    expect(cache.size()).toBe(2);
    expect(cache.delete("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe("BoundedCache", () => {
  test("evicts oldest item when maxCapacity is exceeded", () => {
    const cache = new BoundedCache<number>(2);
    cache.set("k1", 100);
    cache.set("k2", 200);
    expect(cache.size()).toBe(2);

    // Exceed capacity
    cache.set("k3", 300);
    expect(cache.size()).toBe(2);
    expect(cache.get("k1")).toBeUndefined(); // oldest evicted
    expect(cache.get("k2")).toBe(200);
    expect(cache.get("k3")).toBe(300);
  });

  test("updating existing key does not evict", () => {
    const cache = new BoundedCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "updated");
    expect(cache.size()).toBe(2);
    expect(cache.get("a")).toBe("updated");
    expect(cache.get("b")).toBe("2");
  });
});
