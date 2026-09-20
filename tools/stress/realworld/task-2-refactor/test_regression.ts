// test_regression.ts — Regression test suite for E-Commerce Pricing & Coupon Stacking Engine
// Verifies that refactored code preserves all original business logic & edge cases.

import { calculateCartDiscount } from "./cart_garbage"

interface TestCase {
  name: string
  cart: any
  expected: {
    subtotal: number
    discount: number
    net: number
    shipping: number
    tax: number
    total: number
    applied: string[]
  }
}

const testCases: TestCase[] = [
  {
    name: "TC-1: Null cart returns zeroed structure",
    cart: null,
    expected: { subtotal: 0, discount: 0, net: 0, shipping: 0, tax: 0, total: 0, applied: [] },
  },
  {
    name: "TC-2: Empty items list returns zeroed structure",
    cart: { items: [] },
    expected: { subtotal: 0, discount: 0, net: 0, shipping: 0, tax: 0, total: 0, applied: [] },
  },
  {
    name: "TC-3: Basic items with CA tax and standard shipping",
    cart: { items: [{ p: 10, q: 2 }, { p: 15, q: 1 }], state: "CA" },
    expected: { subtotal: 35, discount: 0, net: 35, shipping: 9.99, tax: 2.89, total: 47.88, applied: [] },
  },
  {
    name: "TC-4: Bulk item discount (12 units) with TX tax",
    cart: { items: [{ p: 5, q: 12 }], state: "TX" },
    expected: { subtotal: 60, discount: 3, net: 57, shipping: 4.99, tax: 3.56, total: 65.55, applied: ["BULK_0"] },
  },
  {
    name: "TC-5: VIP GOLD tier over $100 with NY tax and free shipping",
    cart: { items: [{ p: 40, q: 3 }], u: { tier: "GOLD" }, state: "NY" },
    expected: { subtotal: 120, discount: 18, net: 102, shipping: 0, tax: 9.05, total: 111.05, applied: ["TIER_HIGH"] },
  },
  {
    name: "TC-6: VIP tier under $50 gets flat $5 discount",
    cart: { items: [{ p: 20, q: 2 }], u: { tier: "VIP" }, state: "DEFAULT" },
    expected: { subtotal: 40, discount: 5, net: 35, shipping: 9.99, tax: 1.75, total: 46.74, applied: ["TIER_FLAT"] },
  },
  {
    name: "TC-7: SAVE20 coupon applied when threshold >= $50",
    cart: { items: [{ p: 30, q: 2 }], coupon: { code: "SAVE20", exp: 1750000000 }, state: "CA" },
    expected: { subtotal: 60, discount: 20, net: 40, shipping: 9.99, tax: 3.3, total: 53.29, applied: ["CPN_20"] },
  },
  {
    name: "TC-8: HALF_OFF coupon with TX tax and free shipping",
    cart: { items: [{ p: 50, q: 4 }], coupon: { code: "HALF_OFF", exp: 1750000000 }, state: "TX" },
    expected: { subtotal: 200, discount: 100, net: 100, shipping: 0, tax: 6.25, total: 106.25, applied: ["CPN_HALF"] },
  },
  {
    name: "TC-9: Expired coupon is ignored",
    cart: { items: [{ p: 60, q: 1 }], coupon: { code: "SAVE20", exp: 1600000000 }, state: "CA" },
    expected: { subtotal: 60, discount: 0, net: 60, shipping: 4.99, tax: 4.95, total: 69.94, applied: [] },
  },
  {
    name: "TC-10: SILVER tier (75+) with stacking bulk discount",
    cart: { items: [{ p: 10, q: 10 }], u: { tier: "SILVER" }, state: "DEFAULT" },
    expected: { subtotal: 100, discount: 11.65, net: 88.35, shipping: 4.99, tax: 4.42, total: 97.76, applied: ["BULK_0", "TIER_SILVER"] },
  },
]

let passed = 0
let failed = 0

console.log("Running Regression Test Suite for E-Commerce Pricing...")
console.log("─────────────────────────────────────────────────────────────")

for (const tc of testCases) {
  try {
    const result = calculateCartDiscount(tc.cart)
    const matchSubtotal = Math.abs(result.subtotal - tc.expected.subtotal) < 0.01
    const matchDiscount = Math.abs(result.discount - tc.expected.discount) < 0.01
    const matchNet = Math.abs(result.net - tc.expected.net) < 0.01
    const matchShipping = Math.abs(result.shipping - tc.expected.shipping) < 0.01
    const matchTax = Math.abs(result.tax - tc.expected.tax) < 0.01
    const matchTotal = Math.abs(result.total - tc.expected.total) < 0.01
    const matchApplied =
      JSON.stringify(result.applied || []) === JSON.stringify(tc.expected.applied)

    if (
      matchSubtotal &&
      matchDiscount &&
      matchNet &&
      matchShipping &&
      matchTax &&
      matchTotal &&
      matchApplied
    ) {
      console.log(`  ✓ ${tc.name}`)
      passed++
    } else {
      console.log(`  ✗ ${tc.name}`)
      console.log(`    Expected: ${JSON.stringify(tc.expected)}`)
      console.log(`    Received: ${JSON.stringify(result)}`)
      failed++
    }
  } catch (err: any) {
    console.log(`  ✗ ${tc.name} threw error: ${err.message}`)
    failed++
  }
}

console.log("─────────────────────────────────────────────────────────────")
console.log(`Result: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
}
