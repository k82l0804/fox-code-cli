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

  // TODO: Support 'SUMMER20' promo code (20% off after tier discount)
  // Ensure price floor of MIN_PRICE ($5.00) is enforced after all discounts

  return Number(price.toFixed(2));
}
