export type CustomerTier = "STANDARD" | "PREMIUM" | "VIP";

export const MIN_PRICE = 5.00;

export function applyDiscount(
  basePrice: number,
  tier: CustomerTier,
  promoCode?: string
): number {
  if (basePrice <= 0) return 0;
  if (basePrice < MIN_PRICE) return basePrice;

  let price = basePrice;

  // Tier discount
  if (tier === "PREMIUM") {
    price *= 0.90;
  } else if (tier === "VIP") {
    price *= 0.80;
  }

  // Promo discount
  if (promoCode === "SUMMER20") {
    price *= 0.80;
  }

  // Minimum price floor
  if (price < MIN_PRICE) {
    price = MIN_PRICE;
  }

  return Number(price.toFixed(2));
}
