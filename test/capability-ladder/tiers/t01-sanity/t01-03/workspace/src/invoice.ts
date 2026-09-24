import { calculateTotal, type LineItem } from "./calc";

export function generateInvoice(invoiceId: string, items: LineItem[]) {
  const total = calculateTotal(items, 0.05);
  return { invoiceId, total, date: "2026-09-24" };
}
