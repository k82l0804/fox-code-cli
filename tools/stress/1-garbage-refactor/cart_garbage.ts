export interface CartItem {
  p?: number;
  q?: number;
}

export interface User {
  tier?: string;
}

export interface Coupon {
  code?: string;
  exp?: number;
}

export interface Cart {
  items?: CartItem[];
  u?: User;
  coupon?: Coupon;
  state?: string;
}

export interface CartCalculationResult {
  subtotal: number;
  discount: number;
  net: number;
  shipping: number;
  tax: number;
  total: number;
  applied: string[];
}

const BULK_QUANTITY_THRESHOLD = 10;
const BULK_DISCOUNT_RATE = 0.05;

const COUPON_EXPIRATION_THRESHOLD = 1_700_000_000;
const COUPON_SAVE20_THRESHOLD = 50;
const COUPON_SAVE20_AMOUNT = 20.0;
const COUPON_HALF_OFF_RATE = 0.50;

const TIER_HIGH_THRESHOLD = 100;
const TIER_HIGH_DISCOUNT_RATE = 0.15;
const TIER_MID_THRESHOLD = 50;
const TIER_MID_DISCOUNT_RATE = 0.10;
const TIER_FLAT_DISCOUNT_AMOUNT = 5.0;
const TIER_SILVER_THRESHOLD = 75;
const TIER_SILVER_DISCOUNT_RATE = 0.07;

const SHIPPING_FREE_THRESHOLD = 100;
const SHIPPING_REDUCED_THRESHOLD = 50;
const SHIPPING_PRICE_STANDARD = 9.99;
const SHIPPING_PRICE_REDUCED = 4.99;
const SHIPPING_PRICE_FREE = 0;

const TAX_RATES: Record<string, number> = {
  CA: 0.0825,
  NY: 0.08875,
  TX: 0.0625,
};
const DEFAULT_TAX_RATE = 0.05;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function createZeroResult(): CartCalculationResult {
  return {
    subtotal: 0,
    discount: 0,
    net: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    applied: [],
  };
}

function calculateShipping(net: number): number {
  if (net >= SHIPPING_FREE_THRESHOLD) {
    return SHIPPING_PRICE_FREE;
  }
  if (net >= SHIPPING_REDUCED_THRESHOLD) {
    return SHIPPING_PRICE_REDUCED;
  }
  return SHIPPING_PRICE_STANDARD;
}

export function calculateCartDiscount(cart: Cart | null | undefined): CartCalculationResult {
  if (!cart?.items || !Array.isArray(cart.items) || cart.items.length === 0) {
    return createZeroResult();
  }

  let subtotal = 0;
  let discount = 0;
  const appliedFlags: string[] = [];

  cart.items.forEach((item, index) => {
    if (item.p != null && item.q != null && item.q > 0) {
      const lineTotal = item.p * item.q;
      subtotal += lineTotal;

      if (item.q >= BULK_QUANTITY_THRESHOLD) {
        discount += lineTotal * BULK_DISCOUNT_RATE;
        appliedFlags.push(`BULK_${index}`);
      }
    }
  });

  const userTier = cart.u?.tier;
  if (userTier === "GOLD" || userTier === "VIP") {
    if (subtotal > TIER_HIGH_THRESHOLD) {
      discount += (subtotal - discount) * TIER_HIGH_DISCOUNT_RATE;
      appliedFlags.push("TIER_HIGH");
    } else if (subtotal > TIER_MID_THRESHOLD) {
      discount += (subtotal - discount) * TIER_MID_DISCOUNT_RATE;
      appliedFlags.push("TIER_MID");
    } else {
      discount += TIER_FLAT_DISCOUNT_AMOUNT;
      appliedFlags.push("TIER_FLAT");
    }
  } else if (userTier === "SILVER") {
    if (subtotal > TIER_SILVER_THRESHOLD) {
      discount += (subtotal - discount) * TIER_SILVER_DISCOUNT_RATE;
      appliedFlags.push("TIER_SILVER");
    }
  }

  const coupon = cart.coupon;
  if (coupon?.code && coupon.exp != null && coupon.exp > COUPON_EXPIRATION_THRESHOLD) {
    if (coupon.code === "SAVE20" && subtotal >= COUPON_SAVE20_THRESHOLD) {
      discount += COUPON_SAVE20_AMOUNT;
      appliedFlags.push("CPN_20");
    } else if (coupon.code === "HALF_OFF") {
      discount += (subtotal - discount) * COUPON_HALF_OFF_RATE;
      appliedFlags.push("CPN_HALF");
    }
  }

  discount = Math.min(discount, subtotal);

  const net = subtotal - discount;
  const shipping = calculateShipping(net);
  const taxRate = TAX_RATES[cart.state || "DEFAULT"] ?? DEFAULT_TAX_RATE;
  const tax = net * taxRate;

  return {
    subtotal: roundCurrency(subtotal),
    discount: roundCurrency(discount),
    net: roundCurrency(net),
    shipping,
    tax: roundCurrency(tax),
    total: roundCurrency(net + shipping + tax),
    applied: appliedFlags,
  };
}
