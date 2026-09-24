import { expect, test, describe } from "bun:test";
import { chunkArray, flatten, unique } from "../src/utils";

describe("chunkArray", () => {
  test("chunks evenly divisible array", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  test("includes remainder when not evenly divisible", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("handles chunk size equal to array length", () => {
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  test("handles chunk size larger than array", () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  test("handles empty array", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  test("handles single element", () => {
    expect(chunkArray([42], 1)).toEqual([[42]]);
  });

  test("throws on non-positive chunk size", () => {
    expect(() => chunkArray([1, 2], 0)).toThrow();
    expect(() => chunkArray([1, 2], -1)).toThrow();
  });
});

describe("flatten", () => {
  test("flattens nested arrays", () => {
    expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
  });

  test("handles empty inner arrays", () => {
    expect(flatten([[], [1], []])).toEqual([1]);
  });
});

describe("unique", () => {
  test("removes duplicates", () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  test("handles empty array", () => {
    expect(unique([])).toEqual([]);
  });
});
