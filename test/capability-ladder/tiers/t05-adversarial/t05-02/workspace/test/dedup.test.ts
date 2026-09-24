import { expect, test, describe } from "bun:test";
import { deduplicateNumbers } from "../src/dedup";

describe("deduplicateNumbers", () => {
  test("removes duplicate numbers and preserves order", () => {
    expect(deduplicateNumbers([1, 2, 2, 3, 1, 4, 3])).toEqual([1, 2, 3, 4]);
  });

  test("handles empty array and single element", () => {
    expect(deduplicateNumbers([])).toEqual([]);
    expect(deduplicateNumbers([42])).toEqual([42]);
  });
});
