import { expect, test, describe } from "bun:test";
import { calculateDiscountedPrice } from "../src/pricing";

describe("calculateDiscountedPrice", () => {
  test("calculates discounted price accurately", () => {
    expect(calculateDiscountedPrice(100, 0.2)).toBe(80);
    expect(calculateDiscountedPrice(50, 0.1)).toBe(45);
    expect(calculateDiscountedPrice(200, 0)).toBe(200);
  });
});
