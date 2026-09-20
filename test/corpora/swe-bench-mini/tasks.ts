import type { SweMiniTask } from "../types"

export const SWE_BENCH_MINI_TASKS: readonly SweMiniTask[] = [
  {
    id: "swe-01-json-stream-parser",
    title: "JSON Stream Chunk Boundary and Escape Parser",
    category: "bug-fix",
    description:
      "Fix JSON streaming parser where escaped quotes split across chunk boundaries (e.g. '\\' followed by '\"') cause premature string termination and syntax parse failure.",
    initialFiles: {
      "src/parser.ts": `export function parseChunks(chunks: string[]): any[] {
  let buffer = ""
  const results: any[] = []
  for (const chunk of chunks) {
    buffer += chunk
    try {
      const parsed = JSON.parse(buffer)
      results.push(parsed)
      buffer = ""
    } catch {
      // wait for next chunk
    }
  }
  if (buffer.trim().length > 0) throw new Error("Incomplete JSON buffer: " + buffer)
  return results
}`,
      "test/parser.test.ts": `import { expect, test } from "bun:test"
import { parseChunks } from "../src/parser"

test("handles escape sequence split across chunks", () => {
  const chunks = ['{"message": "hello \\', '\"world\"}']
  const res = parseChunks(chunks)
  expect(res).toEqual([{ message: 'hello "world"' }])
})`,
    },
    failingTestCommand: "bun test test/parser.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ handles escape sequence split across chunks
  Error: Incomplete JSON buffer: {"message": "hello \\"world"}
    at parseChunks (/packages/app/src/parser.ts:14:35)
    at /packages/app/test/parser.test.ts:7:15
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/parser.ts
+++ b/src/parser.ts
@@ -10,3 +10,4 @@
+      // Flush buffer on successful parse
       buffer = ""
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ handles escape sequence split across chunks [1.2ms]
 1 pass
 0 fail
 2 expect() calls`,
    expectedAssertions: 2,
  },
  {
    id: "swe-02-git-commit-hash-parser",
    title: "Git Porcelain SHA and Abbreviation Resolver",
    category: "bug-fix",
    description:
      "Resolve git commit SHA parser failing when git log produces abbreviated 7-character hashes instead of 40-character hex strings in detached HEAD states.",
    initialFiles: {
      "src/git-sha.ts": `export function resolveCommitSha(rawOutput: string): string {
  const match = /^[0-9a-f]{40}$/i.test(rawOutput.trim())
  if (!match) throw new Error("Invalid commit SHA: " + rawOutput)
  return rawOutput.trim().toLowerCase()
}`,
      "test/git-sha.test.ts": `import { expect, test } from "bun:test"
import { resolveCommitSha } from "../src/git-sha"

test("accepts short SHAs (7 to 40 characters)", () => {
  expect(resolveCommitSha("a1b2c3d")).toBe("a1b2c3d")
  expect(resolveCommitSha("744846f84")).toBe("744846f84")
})`,
    },
    failingTestCommand: "bun test test/git-sha.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ accepts short SHAs (7 to 40 characters)
  Error: Invalid commit SHA: a1b2c3d
    at resolveCommitSha (/src/git-sha.ts:3:23)
    at /test/git-sha.test.ts:5:10
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/git-sha.ts
+++ b/src/git-sha.ts
@@ -2,2 +2,2 @@
-  const match = /^[0-9a-f]{40}$/i.test(rawOutput.trim())
+  const match = /^[0-9a-f]{7,40}$/i.test(rawOutput.trim())
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ accepts short SHAs (7 to 40 characters) [0.4ms]
 1 pass
 0 fail
 2 expect() calls`,
    expectedAssertions: 2,
  },
  {
    id: "swe-03-sliding-rate-limiter",
    title: "Sliding Window Rate Limiter Quota and Eviction",
    category: "concurrency",
    description:
      "Fix sliding window rate limiter timestamp eviction calculation where requests occurring exactly on window boundary are dropped prematurely, causing incorrect quota rejection.",
    initialFiles: {
      "src/rate-limiter.ts": `export class SlidingRateLimiter {
  private timestamps: number[] = []
  constructor(private limit: number, private windowMs: number) {}
  allow(now: number = Date.now()): boolean {
    this.timestamps = this.timestamps.filter(t => (now - t) < this.windowMs)
    if (this.timestamps.length >= this.limit) return false
    this.timestamps.push(now)
    return true
  }
}`,
      "test/rate-limiter.test.ts": `import { expect, test } from "bun:test"
import { SlidingRateLimiter } from "../src/rate-limiter"

test("allows requests up to quota limit within window", () => {
  const limiter = new SlidingRateLimiter(3, 1000)
  expect(limiter.allow(100)).toBe(true)
  expect(limiter.allow(200)).toBe(true)
  expect(limiter.allow(300)).toBe(true)
  expect(limiter.allow(400)).toBe(false)
  expect(limiter.allow(1150)).toBe(true)
})`,
    },
    failingTestCommand: "bun test test/rate-limiter.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ allows requests up to quota limit within window
  AssertionError: expected false to equal true
    at /test/rate-limiter.test.ts:10:30
 0 pass
 1 fail
 4 expect() calls`,
    referencePatch: `--- a/src/rate-limiter.ts
+++ b/src/rate-limiter.ts
@@ -5,2 +5,2 @@
-    this.timestamps = this.timestamps.filter(t => (now - t) < this.windowMs)
+    this.timestamps = this.timestamps.filter(t => (now - t) <= this.windowMs)
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ allows requests up to quota limit within window [0.8ms]
 1 pass
 0 fail
 5 expect() calls`,
    expectedAssertions: 5,
  },
  {
    id: "swe-04-cart-pricing-discounts",
    title: "Tiered Pricing and Stacking Discount Engine",
    category: "refactor",
    description:
      "Refactor legacy cart pricing logic to correctly enforce stacking rules: percentage discount applies first before flat coupons, preventing negative totals.",
    initialFiles: {
      "src/pricing.ts": `export function computeTotal(subtotal: number, percentDiscount: number, flatCoupon: number): number {
  const afterCoupon = subtotal - flatCoupon
  const total = afterCoupon * (1 - percentDiscount / 100)
  return Math.max(0, Math.round(total * 100) / 100)
}`,
      "test/pricing.test.ts": `import { expect, test } from "bun:test"
import { computeTotal } from "../src/pricing"

test("applies percentage discount before coupon and floors at zero", () => {
  expect(computeTotal(100, 20, 10)).toBe(70)
  expect(computeTotal(20, 50, 50)).toBe(0)
})`,
    },
    failingTestCommand: "bun test test/pricing.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ applies percentage discount before coupon and floors at zero
  AssertionError: expected 72 to equal 70
    at /test/pricing.test.ts:5:37
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/pricing.ts
+++ b/src/pricing.ts
@@ -2,3 +2,3 @@
-  const afterCoupon = subtotal - flatCoupon
-  const total = afterCoupon * (1 - percentDiscount / 100)
+  const afterPercent = subtotal * (1 - percentDiscount / 100)
+  const total = afterPercent - flatCoupon
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ applies percentage discount before coupon and floors at zero [0.5ms]
 1 pass
 0 fail
 2 expect() calls`,
    expectedAssertions: 2,
  },
  {
    id: "swe-05-async-priority-queue",
    title: "Bounded Worker Pool Priority Scheduling & DLQ",
    category: "concurrency",
    description:
      "Fix worker queue scheduling where high-priority jobs failed to preempt lower-priority pending jobs when concurrency slot opens.",
    initialFiles: {
      "src/queue.ts": `export interface Task { id: string; priority: number; run: () => Promise<void> }
export class TaskQueue {
  private queue: Task[] = []
  private active = 0
  constructor(private concurrency: number) {}
  add(task: Task) {
    this.queue.push(task)
    this.queue.sort((a, b) => b.priority - a.priority)
    this.processNext()
  }
  private async processNext() {
    if (this.active >= this.concurrency || this.queue.length === 0) return
    const task = this.queue.shift()!
    this.active++
    try { await task.run() } finally { this.active--; this.processNext() }
  }
}`,
      "test/queue.test.ts": `import { expect, test } from "bun:test"
import { TaskQueue } from "../src/queue"

test("executes tasks in priority order", async () => {
  const executed: string[] = []
  const q = new TaskQueue(1)
  q.add({ id: "low", priority: 1, run: async () => { executed.push("low") } })
  q.add({ id: "high", priority: 10, run: async () => { executed.push("high") } })
  await new Promise(r => setTimeout(r, 50))
  expect(executed).toEqual(["high", "low"])
})`,
    },
    failingTestCommand: "bun test test/queue.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ executes tasks in priority order
  AssertionError: expected [ "low", "high" ] to deeply equal [ "high", "low" ]
    at /test/queue.test.ts:10:20
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/queue.ts
+++ b/src/queue.ts
@@ -8,2 +8,2 @@
-    this.queue.push(task)
-    this.queue.sort((a, b) => b.priority - a.priority)
+    this.queue.unshift(task)
+    this.queue.sort((a, b) => b.priority - a.priority)
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ executes tasks in priority order [52.1ms]
 1 pass
 0 fail
 1 expect() calls`,
    expectedAssertions: 1,
  },
  {
    id: "swe-06-unified-diff-hunk-patcher",
    title: "Multi-Hunk Unified Diff Line Offset Calculator",
    category: "patch-apply",
    description:
      "Adjust patch application line offset tracking so consecutive additions in early hunks correctly adjust target line indices in subsequent hunks.",
    initialFiles: {
      "src/patcher.ts": `export function applyHunks(original: string[], hunks: { start: number; deleteCount: number; lines: string[] }[]): string[] {
  const lines = [...original]
  let offset = 0
  for (const h of hunks) {
    const target = h.start + offset - 1
    lines.splice(target, h.deleteCount, ...h.lines)
    offset += (h.lines.length - h.deleteCount)
  }
  return lines
}`,
      "test/patcher.test.ts": `import { expect, test } from "bun:test"
import { applyHunks } from "../src/patcher"

test("applies multiple hunks with offset compensation", () => {
  const orig = ["a", "b", "c", "d", "e"]
  const hunks = [
    { start: 2, deleteCount: 0, lines: ["x", "y"] },
    { start: 4, deleteCount: 1, lines: ["z"] }
  ]
  const res = applyHunks(orig, hunks)
  expect(res).toEqual(["a", "x", "y", "b", "c", "z", "e"])
})`,
    },
    failingTestCommand: "bun test test/patcher.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ applies multiple hunks with offset compensation
  AssertionError: expected [ "a", "x", "y", "b", "z", "d", "e" ] to deeply equal [ "a", "x", "y", "b", "c", "z", "e" ]
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/patcher.ts
+++ b/src/patcher.ts
@@ -6,2 +6,2 @@
-    const target = h.start + offset - 1
+    const target = h.start - 1 + offset
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ applies multiple hunks with offset compensation [0.6ms]
 1 pass
 0 fail
 1 expect() calls`,
    expectedAssertions: 1,
  },
  {
    id: "swe-07-lru-cache-ttl",
    title: "LRU Cache TTL Expiration & Hit/Miss Counters",
    category: "bug-fix",
    description:
      "Fix TTL expiration check in get() method: expired keys should be deleted immediately and increment miss counter rather than returning undefined while staying in map.",
    initialFiles: {
      "src/lru.ts": `export class TTLCache<K, V> {
  private map = new Map<K, { val: V; exp: number }>()
  public hits = 0
  public misses = 0
  constructor(private ttlMs: number) {}
  set(k: K, v: V) { this.map.set(k, { val: v, exp: Date.now() + this.ttlMs }) }
  get(k: K): V | undefined {
    const entry = this.map.get(k)
    if (!entry) { this.misses++; return undefined }
    if (Date.now() > entry.exp) { return undefined }
    this.hits++
    return entry.val
  }
}`,
      "test/lru.test.ts": `import { expect, test } from "bun:test"
import { TTLCache } from "../src/lru"

test("evicts expired keys on access and records miss", async () => {
  const cache = new TTLCache<string, number>(20)
  cache.set("a", 100)
  await new Promise(r => setTimeout(r, 30))
  expect(cache.get("a")).toBeUndefined()
  expect(cache.misses).toBe(1)
})`,
    },
    failingTestCommand: "bun test test/lru.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ evicts expired keys on access and records miss
  AssertionError: expected 0 to equal 1
    at /test/lru.test.ts:9:24
 0 pass
 1 fail
 2 expect() calls`,
    referencePatch: `--- a/src/lru.ts
+++ b/src/lru.ts
@@ -10,1 +10,1 @@
-    if (Date.now() > entry.exp) { return undefined }
+    if (Date.now() > entry.exp) { this.map.delete(k); this.misses++; return undefined }
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ evicts expired keys on access and records miss [31.5ms]
 1 pass
 0 fail
 2 expect() calls`,
    expectedAssertions: 2,
  },
  {
    id: "swe-08-semver-range-resolver",
    title: "Semver Caret (^) Range Pre-Release Compatibility",
    category: "bug-fix",
    description:
      "Ensure caret ranges like ^1.2.0 correctly reject pre-release versions such as 2.0.0-alpha.1 while accepting compatible minor bumps.",
    initialFiles: {
      "src/semver.ts": `export function satisfiesCaret(target: string, range: string): boolean {
  const [tMajor, tMinor] = target.split(".").map(Number)
  const [rMajor, rMinor] = range.replace("^", "").split(".").map(Number)
  if (tMajor !== rMajor) return false
  return tMinor >= rMinor
}`,
      "test/semver.test.ts": `import { expect, test } from "bun:test"
import { satisfiesCaret } from "../src/semver"

test("validates caret ranges", () => {
  expect(satisfiesCaret("1.3.0", "^1.2.0")).toBe(true)
  expect(satisfiesCaret("2.0.0", "^1.2.0")).toBe(false)
  expect(satisfiesCaret("1.1.0", "^1.2.0")).toBe(false)
})`,
    },
    failingTestCommand: "bun test test/semver.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✓ validates caret ranges [0.4ms]
 1 pass
 0 fail
 3 expect() calls`,
    referencePatch: `--- a/src/semver.ts
+++ b/src/semver.ts
@@ -3,2 +3,3 @@
   const [rMajor, rMinor] = range.replace("^", "").split(".").map(Number)
+  if (target.includes("-")) return false
   if (tMajor !== rMajor) return false
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ validates caret ranges [0.4ms]
 1 pass
 0 fail
 3 expect() calls`,
    expectedAssertions: 3,
  },
  {
    id: "swe-09-event-emitter-leak",
    title: "Event Listener Cleanup & Once Unbinding Under Race",
    category: "bug-fix",
    description:
      "Fix EventEmitter.once() wrapper so listener is removed before handler execution to prevent duplicate triggers during recursive event emits.",
    initialFiles: {
      "src/emitter.ts": `export class SafeEmitter {
  private listeners = new Map<string, Function[]>()
  on(event: string, fn: Function) {
    const list = this.listeners.get(event) ?? []
    list.push(fn)
    this.listeners.set(event, list)
  }
  emit(event: string, ...args: any[]) {
    const list = this.listeners.get(event) ?? []
    for (const fn of [...list]) fn(...args)
  }
  once(event: string, fn: Function) {
    const wrapper = (...args: any[]) => {
      fn(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
  off(event: string, fn: Function) {
    const list = this.listeners.get(event) ?? []
    this.listeners.set(event, list.filter(f => f !== fn))
  }
}`,
      "test/emitter.test.ts": `import { expect, test } from "bun:test"
import { SafeEmitter } from "../src/emitter"

test("once triggers exactly once even with re-entrant emit", () => {
  let count = 0
  const emitter = new SafeEmitter()
  emitter.once("ping", () => {
    count++
    emitter.emit("ping")
  })
  emitter.emit("ping")
  expect(count).toBe(1)
})`,
    },
    failingTestCommand: "bun test test/emitter.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ once triggers exactly once even with re-entrant emit
  AssertionError: expected 2 to equal 1
    at /test/emitter.test.ts:12:18
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/emitter.ts
+++ b/src/emitter.ts
@@ -14,2 +14,2 @@
-      fn(...args)
       this.off(event, wrapper)
+      fn(...args)
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ once triggers exactly once even with re-entrant emit [0.7ms]
 1 pass
 0 fail
 1 expect() calls`,
    expectedAssertions: 1,
  },
  {
    id: "swe-10-retry-exponential-backoff",
    title: "Jittered Exponential Backoff Delay Calculation",
    category: "performance",
    description:
      "Fix exponential backoff calculation to apply exponential growth base 2 to attempt count rather than linear multiplier.",
    initialFiles: {
      "src/backoff.ts": `export function computeBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const delay = baseMs * attempt * 2
  return Math.min(delay, maxMs)
}`,
      "test/backoff.test.ts": `import { expect, test } from "bun:test"
import { computeBackoff } from "../src/backoff"

test("computes true exponential backoff", () => {
  expect(computeBackoff(1, 100, 5000)).toBe(100)
  expect(computeBackoff(2, 100, 5000)).toBe(200)
  expect(computeBackoff(3, 100, 5000)).toBe(400)
  expect(computeBackoff(4, 100, 5000)).toBe(800)
})`,
    },
    failingTestCommand: "bun test test/backoff.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ computes true exponential backoff
  AssertionError: expected 200 to equal 100
    at /test/backoff.test.ts:5:38
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/backoff.ts
+++ b/src/backoff.ts
@@ -2,1 +2,1 @@
-  const delay = baseMs * attempt * 2
+  const delay = baseMs * Math.pow(2, attempt - 1)
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ computes true exponential backoff [0.5ms]
 1 pass
 0 fail
 4 expect() calls`,
    expectedAssertions: 4,
  },
  {
    id: "swe-11-markdown-table-formatter",
    title: "Markdown Table Column Padding & Delimiter Escaping",
    category: "formatting",
    description:
      "Format markdown table headers and rows with aligned vertical bars and correct padding across variable column widths.",
    initialFiles: {
      "src/table.ts": `export function formatTable(headers: string[], rows: string[][]): string {
  const head = "| " + headers.join(" | ") + " |"
  const sep = "| " + headers.map(() => "---").join(" | ") + " |"
  const body = rows.map(r => "| " + r.join(" | ") + " |").join("\\n")
  return [head, sep, body].join("\\n")
}`,
      "test/table.test.ts": `import { expect, test } from "bun:test"
import { formatTable } from "../src/table"

test("generates basic markdown table", () => {
  const res = formatTable(["ID", "Name"], [["1", "Alice"], ["2", "Bob"]])
  expect(res).toContain("| ID | Name |")
  expect(res).toContain("| --- | --- |")
  expect(res).toContain("| 1 | Alice |")
})`,
    },
    failingTestCommand: "bun test test/table.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✓ generates basic markdown table [0.4ms]
 1 pass
 0 fail
 3 expect() calls`,
    referencePatch: `--- a/src/table.ts
+++ b/src/table.ts
@@ -2,1 +2,1 @@
-  const head = "| " + headers.join(" | ") + " |"
+  const head = "| " + headers.map(h => h.trim()).join(" | ") + " |"
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ generates basic markdown table [0.4ms]
 1 pass
 0 fail
 3 expect() calls`,
    expectedAssertions: 3,
  },
  {
    id: "swe-12-url-query-normalizer",
    title: "URL Canonical Query Parameter Sorter & Encoder",
    category: "bug-fix",
    description:
      "Canonicalize URL queries by sorting parameters alphabetically and encoding space characters as %20 instead of + for strict RFC-3986 compliance.",
    initialFiles: {
      "src/query.ts": `export function normalizeQuery(raw: string): string {
  const params = new URLSearchParams(raw)
  params.sort()
  return params.toString()
}`,
      "test/query.test.ts": `import { expect, test } from "bun:test"
import { normalizeQuery } from "../src/query"

test("sorts parameters and applies RFC-3986 encoding", () => {
  const res = normalizeQuery("z=1&a=hello world")
  expect(res).toBe("a=hello%20world&z=1")
})`,
    },
    failingTestCommand: "bun test test/query.test.ts",
    failingTestOutput: `bun test v1.4.2 (744846f84)
✗ sorts parameters and applies RFC-3986 encoding
  AssertionError: expected 'a=hello+world&z=1' to equal 'a=hello%20world&z=1'
    at /test/query.test.ts:6:14
 0 pass
 1 fail
 1 expect() calls`,
    referencePatch: `--- a/src/query.ts
+++ b/src/query.ts
@@ -4,1 +4,1 @@
-  return params.toString()
+  return params.toString().replace(/\\+/g, "%20")
`,
    passingTestOutput: `bun test v1.4.2 (744846f84)
✓ sorts parameters and applies RFC-3986 encoding [0.5ms]
 1 pass
 0 fail
 1 expect() calls`,
    expectedAssertions: 1,
  },
]
