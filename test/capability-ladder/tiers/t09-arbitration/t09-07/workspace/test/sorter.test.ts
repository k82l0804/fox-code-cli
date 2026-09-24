import { expect, test, describe } from "bun:test";
import { sortDescending } from "../src/sorter";

describe("Sorter Arbitration", () => {
  test("sorts descending with mixed positive and negative numbers", () => {
    expect(sortDescending([3, -1, 5, -10, 0])).toEqual([5, 3, 0, -1, -10]);
  });
});
