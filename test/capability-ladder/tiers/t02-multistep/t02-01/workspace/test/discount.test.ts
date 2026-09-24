import { expect, test, describe } from "bun:test";
import { applyDiscount, MIN_PRICE } from "../src/discount";

describe("applyDiscount", () => {
  test("calculates tier discounts without promo", () => {
    expect(applyDiscount(100, "STANDARD")).toBe(100);
    expect(applyDiscount(100, "PREMIUM")).toBe(90);
    expect(applyDiscount(100, "VIP")).toBe(80);
  });

  test("applies SUMMER20 after tier discount", () => {
    // 100 -> STANDARD: 100 -> SUMMER20: 80
    expect(applyDiscount(100, "STANDARD", "SUMMER20")).toBe(80);
    // 100 -> PREMIUM: 90 -> SUMMER20: 72
    expect(applyDiscount(100, "PREMIUM", "SUMMER20")).toBe(72);
    // 100 -> VIP: 80 -> SUMMER20: 64
    expect(applyDiscount(100, "VIP", "SUMMER20")).toBe(64);
  });

  test("enforces minimum price floor of $5.00", () => {
    // 6.00 with VIP (4.80) should clamp to 5.00
    expect(applyDiscount(6.00, "VIP")).toBe(MIN_PRICE);
    // 6.00 with STANDARD and SUMMER20 (4.80) should clamp to 5.00
    expect(applyDiscount(6.00, "STANDARD", "SUMMER20")).toBe(MIN_PRICE);
  });

  test("preserves base price if already below price floor", () => {
    expect(applyDiscount(3.50, "VIP")).toBe(3.50);
  });

  test("ignores unrecognized promo code", () => {
    expect(applyDiscount(100, "STANDARD", "UNKNOWN")).toBe(100);
  });
});
