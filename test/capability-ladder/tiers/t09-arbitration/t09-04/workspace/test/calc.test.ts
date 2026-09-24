import { expect, test, describe } from "bun:test";
import { add, multiply } from "../src/calc";

describe("Calculator Synthesis", () => {
  test("both merged functions operate correctly", () => {
    expect((add as any)(2, 3)).toBe(5);
    expect((multiply as any)(3, 4)).toBe(12);
  });
});
