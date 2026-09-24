import { expect, test, describe } from "bun:test";
import { divide, add, multiply } from "../src/calculator";

describe("Calculator", () => {
  test("divide calculates quotient accurately", () => {
    expect(divide(10, 2)).toBe(5);
    expect(divide(9, 3)).toBe(3);
    expect(() => divide(5, 0)).toThrow("Division by zero");
  });

  test("other operations remain intact", () => {
    expect(add(2, 3)).toBe(5);
    expect(multiply(3, 4)).toBe(12);
  });
});
