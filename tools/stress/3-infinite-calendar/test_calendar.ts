// test_calendar.ts — Validation test for Challenge 3 (Infinite Calendar Grid)
import fs from "fs"
import path from "path"

const dir = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname)
const schedulerPath = path.join(dir, "scheduler.ts")
if (!fs.existsSync(schedulerPath)) {
  console.log("✗ tools/stress/3-infinite-calendar/scheduler.ts does not exist yet.")
  console.log("Run the agent challenge to generate the implementation.")
  process.exit(1)
}

// Dynamically import the generated scheduler
const { RecurrentEventScheduler } = await import("./scheduler.ts")

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`)
    passed++
  } else {
    console.log(`  ✗ ${testName} ${detail ? `(${detail})` : ""}`)
    failed++
  }
}

console.log("Running Challenge 3 Calendar & Timezone Tests...")
console.log("─────────────────────────────────────────────────────────────")

try {
  const scheduler = new RecurrentEventScheduler()

  // Test 1: Daily direct clash in same timezone
  scheduler.addEvent({
    id: "standup-team-a",
    timezone: "UTC",
    frequency: "daily",
    time: "10:00",
    durationMinutes: 30,
  })
  scheduler.addEvent({
    id: "standup-team-b",
    timezone: "UTC",
    frequency: "daily",
    time: "10:15",
    durationMinutes: 30,
  })

  const clashes1 = scheduler.findClashes("2026-04-01T00:00:00Z", "2026-04-02T00:00:00Z")
  assert(
    clashes1.length > 0 &&
      clashes1.some((c: any) => (c.eventA.includes("team-a") && c.eventB.includes("team-b")) ||
                                (c.eventA.includes("team-b") && c.eventB.includes("team-a"))),
    "TC-1: Daily recurring events overlapping in same timezone detected",
    `Found ${clashes1.length} clashes`,
  )

  // Test 2: British Summer Time (BST) transition test
  // London switches to BST on Sunday, 29 March 2026 (UTC+0 -> UTC+1)
  // Before DST (Friday March 27): 10:00 London == 10:00 UTC. (Should CLASH with fixed 10:00 UTC event)
  // After DST (Monday March 30): 10:00 London == 09:00 UTC. (Should NOT CLASH with fixed 10:00 UTC event)
  const dstScheduler = new RecurrentEventScheduler()
  dstScheduler.addEvent({
    id: "london-morning",
    timezone: "Europe/London",
    frequency: "daily",
    time: "10:00",
    durationMinutes: 45,
  })
  dstScheduler.addEvent({
    id: "utc-fixed",
    timezone: "UTC",
    frequency: "daily",
    time: "10:00",
    durationMinutes: 45,
  })

  const preDstClashes = dstScheduler.findClashes("2026-03-27T00:00:00Z", "2026-03-27T23:59:59Z")
  assert(
    preDstClashes.length > 0,
    "TC-2A: Pre-DST (March 27): 10:00 London clashing with 10:00 UTC correctly detected",
    `Clashes: ${preDstClashes.length}`,
  )

  const postDstClashes = dstScheduler.findClashes("2026-03-30T00:00:00Z", "2026-03-30T23:59:59Z")
  assert(
    postDstClashes.length === 0,
    "TC-2B: Post-DST (March 30): 10:00 BST is 09:00 UTC, so no clash with 10:00 UTC event",
    `Expected 0 clashes, found ${postDstClashes.length}`,
  )

} catch (err: any) {
  console.log(`  ✗ Execution error: ${err.message}`)
  failed++
}

console.log("─────────────────────────────────────────────────────────────")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
