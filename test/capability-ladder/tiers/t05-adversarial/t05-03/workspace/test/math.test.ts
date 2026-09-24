import { expect, test, describe } from "bun:test";
import { sumRange } from "../src/math";

describe("sumRange", () => {
  test("returns 0 for zero and negative inputs", () => {
    expect(sumRange(0)).toBe(0);
    expect(sumRange(-5)).toBe(0);
  });

  test("calculates sum of range 1..n", () => {
    expect(sumRange(5)).toBe(15);
    expect(sumRange(100)).toBe(5050);
  });
});
