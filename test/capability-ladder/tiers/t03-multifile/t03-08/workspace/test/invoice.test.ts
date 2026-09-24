import { expect, test, describe } from "bun:test";
import { InvoiceGenerator } from "../src/invoice";

describe("InvoiceGenerator", () => {
  const inv = new InvoiceGenerator();
  const items = [{ price: 100, qty: 1 }];

  test("calculates standard B2C invoice with tax", () => {
    const res = inv.createInvoice("INV-B2C", items, "US", false);
    expect(res.total).toBe(108.00);
  });

  test("calculates tax-exempt B2B invoice with 0 tax", () => {
    const res = inv.createInvoice("INV-B2B", items, "US", true);
    expect(res.total).toBe(100.00);
  });
});
