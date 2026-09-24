export function calculateDiscountedPrice(price: number, discountRate: number): number {
  // BUG: Subtracts percentage directly instead of multiplying price
  return price - discountRate;
}
