import { expect, test, describe } from "bun:test";
import { containsAll } from "../src/lookup";

describe("Lookup Performance Arbitration", () => {
  test("correctly checks membership", () => {
    expect(containsAll(["a", "b", "c"], ["b", "a"])).toBe(true);
    expect(containsAll(["a", "b"], ["a", "z"])).toBe(false);
  });

  test("runs efficiently within 150ms budget", () => {
    const haystack = Array.from({ length: 10000 }, (_, i) => `item_${i}`);
    const needles = Array.from({ length: 2000 }, (_, i) => `item_${i * 2}`);

    const start = performance.now();
    const result = containsAll(haystack, needles);
    const duration = performance.now() - start;

    expect(result).toBe(true);
    expect(duration).toBeLessThan(150);
  });
});
