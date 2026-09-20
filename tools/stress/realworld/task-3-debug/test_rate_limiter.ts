// test_rate_limiter.ts — Test suite for Sliding Window Rate Limiter
import { SlidingWindowRateLimiter } from "./rate_limiter"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.log(`  ✗ ${name} ${detail ? `(${detail})` : ""}`)
    failed++
  }
}

console.log("Running Sliding Window Rate Limiter Test Suite...")
console.log("─────────────────────────────────────────────────────────────")

// Test 1: Basic allowance within rate limit
{
  const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000 })
  const t0 = 10000
  let allAllowed = true
  for (let i = 0; i < 5; i++) {
    if (!limiter.allow("user-1", 1, t0 + i * 10)) {
      allAllowed = false
    }
  }
  assert(allAllowed, "TC-1: Allows 5 requests within limit in current window")
}

// Test 2: Rejects requests exceeding capacity
{
  const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000 })
  const t0 = 10000
  limiter.allow("user-2", 1, t0)
  limiter.allow("user-2", 1, t0 + 10)
  limiter.allow("user-2", 1, t0 + 20)
  const fourth = limiter.allow("user-2", 1, t0 + 30)
  assert(!fourth, "TC-2: Rejects 4th request when limit is 3")
}

// Test 3: Sliding window weighted carry-over across window boundaries
{
  // Window size = 1000ms, Limit = 10 requests
  // Window 1 (10000..11000): user sends 10 requests at t=10500.
  // Window 2 starts at t=11000.
  // At t=11250 (250ms into window 2):
  // 750ms of the 1000ms rolling window overlaps with window 1.
  // Weight of window 1 should be (1000 - 250) / 1000 = 0.75.
  // Weighted previous count = 10 * 0.75 = 7.5.
  // Remaining capacity in rolling window = 10 - 7.5 = 2.5.
  // Therefore, requesting 2 permits should SUCCEED.
  // Requesting 3 permits should FAIL (7.5 + 3 = 10.5 > 10).
  const limiter = new SlidingWindowRateLimiter({ limit: 10, windowMs: 1000 })
  limiter.allow("user-3", 10, 10500)

  // 25% into next window (t = 11250)
  const canTake2 = limiter.allow("user-3", 2, 11250)
  assert(canTake2 === true, "TC-3A: Sliding window allows 2 permits at 25% into next window", `got ${canTake2}`)

  // Now current count is 2, weighted prev is 7.5 -> total 9.5
  const canTake2More = limiter.allow("user-3", 2, 11250)
  assert(canTake2More === false, "TC-3B: Sliding window rejects additional 2 permits (exceeds 10)", `got ${canTake2More}`)
}

// Test 4: Key isolation between multiple independent clients
{
  const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000 })
  const t0 = 10000
  limiter.allow("client-A", 2, t0)
  const clientARejected = !limiter.allow("client-A", 1, t0 + 10)
  const clientBAllowed = limiter.allow("client-B", 1, t0 + 10)
  assert(clientARejected && clientBAllowed, "TC-4: Client A limit exhaustion does not throttle Client B")
}

// Test 5: Stale client cleanup evicts inactive entries
{
  const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000 })
  limiter.allow("active-user", 1, 10000)
  limiter.allow("stale-user", 1, 5000)

  // Clean up entries idle for > 3000ms as of now (t = 10000)
  const evictedCount = limiter.cleanupStale(3000, 10000)
  const hasStale = limiter.hasClient("stale-user")
  const hasActive = limiter.hasClient("active-user")

  assert(
    evictedCount === 1 && !hasStale && hasActive,
    "TC-5: Stale client cleanup correctly evicts idle users while retaining active users",
    `evicted=${evictedCount}, hasStale=${hasStale}, hasActive=${hasActive}`,
  )
}

// Test 6: Reset clears quota immediately
{
  const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000 })
  limiter.allow("reset-user", 2, 10000)
  assert(!limiter.allow("reset-user", 1, 10010), "TC-6A: User blocked before reset")
  limiter.reset("reset-user")
  assert(limiter.allow("reset-user", 1, 10020), "TC-6B: User immediately unblocked after reset")
}

console.log("─────────────────────────────────────────────────────────────")
console.log(`Result: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
}
