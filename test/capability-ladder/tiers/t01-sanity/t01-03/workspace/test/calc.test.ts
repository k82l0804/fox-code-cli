import { expect, test, describe } from "bun:test";
import { calculateTotal } from "../src/calc";
import { getCheckoutSummary } from "../src/checkout";
import { generateInvoice } from "../src/invoice";

describe("order calculation", () => {
  const items = [{ price: 10, quantity: 2 }, { price: 5, quantity: 1 }];

  test("calculateTotal calculates subtotal without tax", () => {
    expect(calculateTotal(items)).toBe(25);
  });

  test("getCheckoutSummary uses 8% tax", () => {
    expect(getCheckoutSummary(items).total).toBe(27);
  });

  test("generateInvoice uses 5% tax", () => {
    expect(generateInvoice("INV-001", items).total).toBe(26.25);
  });
});
