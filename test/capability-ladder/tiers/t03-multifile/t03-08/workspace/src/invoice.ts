import { computeTotalWithTax, type Item } from "./pricing";

export class InvoiceGenerator {
  createInvoice(id: string, items: Item[], country: string, isB2B: boolean) {
    const total = computeTotalWithTax(items, country, isB2B);
    return { id, total, isB2B, country };
  }
}
