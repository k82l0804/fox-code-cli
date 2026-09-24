import { computeOrderTotal, type LineItem } from "./calc";

export function getCheckoutSummary(items: LineItem[]) {
  const total = computeOrderTotal(items, 0.08);
  return { itemCount: items.length, total };
}
