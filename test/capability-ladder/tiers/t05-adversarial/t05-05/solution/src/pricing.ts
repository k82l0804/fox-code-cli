export function calculateDiscountedPrice(price: number, discountRate: number): number {
  return price * (1 - discountRate);
}
