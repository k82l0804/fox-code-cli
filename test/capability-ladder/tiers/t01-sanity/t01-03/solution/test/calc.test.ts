import { expect, test, describe } from "bun:test";
import { computeOrderTotal } from "../src/calc";
import { getCheckoutSummary } from "../src/checkout";
import { generateInvoice } from "../src/invoice";

describe("order calculation", () => {
  const items = [{ price: 10, quantity: 2 }, { price: 5, quantity: 1 }];

  test("computeOrderTotal calculates subtotal without tax", () => {
    expect(computeOrderTotal(items)).toBe(25);
  });

  test("getCheckoutSummary uses 8% tax", () => {
    expect(getCheckoutSummary(items).total).toBe(27);
  });

  test("generateInvoice uses 5% tax", () => {
    expect(generateInvoice("INV-001", items).total).toBe(26.25);
  });
});
