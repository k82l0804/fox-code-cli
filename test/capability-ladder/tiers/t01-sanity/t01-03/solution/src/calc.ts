export interface LineItem {
  price: number;
  quantity: number;
}

export function computeOrderTotal(items: LineItem[], taxRate: number = 0): number {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Number((subtotal * (1 + taxRate)).toFixed(2));
}
