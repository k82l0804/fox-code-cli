import { getTaxRate } from "./tax";

export interface Item {
  price: number;
  qty: number;
}

export function computeTotalWithTax(items: Item[], country: string, isB2B: boolean): number {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const taxRate = getTaxRate(country, isB2B);
  return Number((subtotal * (1 + taxRate)).toFixed(2));
}
