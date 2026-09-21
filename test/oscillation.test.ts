import { describe, expect, test } from "bun:test"
import {
  createTracker,
  recordAndDetect,
  contentHash,
  reset,
  OscillationWarning,
  type OscillationTracker,
} from "@opencode-ai/core/oscillation"

describe("Oscillation", () => {
  describe("contentHash", () => {
    test("produces consistent SHA-256 hex for identical content", () => {
      const h1 = contentHash("hello world")
      const h2 = contentHash("hello world")
      expect(h1).toBe(h2)
      expect(h1).toHaveLength(64)
    })

    test("produces different hashes for different content", () => {
      const h1 = contentHash("version A")
      const h2 = contentHash("version B")
      expect(h1).not.toBe(h2)
    })

    test("accepts Uint8Array input", () => {
      const str = "test content"
      const h1 = contentHash(str)
      const h2 = contentHash(new TextEncoder().encode(str))
      expect(h1).toBe(h2)
    })
  })

  describe("createTracker", () => {
    test("creates tracker with default window size of 4", () => {
      const tracker = createTracker()
      expect(tracker.windowSize).toBe(4)
      expect(tracker.history.size).toBe(0)
    })

    test("creates tracker with custom window size", () => {
      const tracker = createTracker(6)
      expect(tracker.windowSize).toBe(6)
    })
  })

  describe("recordAndDetect", () => {
    function makeTracker(windowSize = 4): OscillationTracker {
      return createTracker(windowSize)
    }

    const hashA = contentHash("state A")
    const hashB = contentHash("state B")
    const hashC = contentHash("state C")
    const hashD = contentHash("state D")

    test("no oscillation on first mutation", () => {
      const tracker = makeTracker()
      const result = recordAndDetect(tracker, "foo.ts", hashA, 1)
      expect(result.detected).toBe(false)
      expect(result.filePath).toBe("foo.ts")
    })

    test("no oscillation for two sequential unique edits", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1)
      const result = recordAndDetect(tracker, "foo.ts", hashB, 2)
      expect(result.detected).toBe(false)
    })

    test("no oscillation for three sequential unique edits", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "foo.ts", hashB, 2)
      const result = recordAndDetect(tracker, "foo.ts", hashC, 3)
      expect(result.detected).toBe(false)
    })

    test("detects A→B→A toggle oscillation", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1) // A
      recordAndDetect(tracker, "foo.ts", hashB, 2) // B
      const result = recordAndDetect(tracker, "foo.ts", hashA, 3) // A again

      expect(result.detected).toBe(true)
      expect(result.filePath).toBe("foo.ts")
      expect(result.pattern).toBe("A→B→A")
      expect(result.turns).toEqual([1, 2, 3])
    })

    test("detects A→B→A→B extended oscillation", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "foo.ts", hashB, 2)
      recordAndDetect(tracker, "foo.ts", hashA, 3)
      const result = recordAndDetect(tracker, "foo.ts", hashB, 4) // B again

      expect(result.detected).toBe(true)
      expect(result.pattern).toContain("B")
    })

    test("does not false-positive on idempotent edit (A→A)", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1)
      const result = recordAndDetect(tracker, "foo.ts", hashA, 2) // Same hash = no change
      expect(result.detected).toBe(false)
    })

    test("does not false-positive on A→B→C→D (all unique)", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "foo.ts", hashB, 2)
      recordAndDetect(tracker, "foo.ts", hashC, 3)
      const result = recordAndDetect(tracker, "foo.ts", hashD, 4)
      expect(result.detected).toBe(false)
    })

    test("tracks multiple files independently", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "bar.ts", hashA, 1) // Different file, same hash
      recordAndDetect(tracker, "foo.ts", hashB, 2)
      recordAndDetect(tracker, "bar.ts", hashB, 2)

      // foo.ts oscillates
      const fooResult = recordAndDetect(tracker, "foo.ts", hashA, 3)
      expect(fooResult.detected).toBe(true)

      // bar.ts also oscillates independently
      const barResult = recordAndDetect(tracker, "bar.ts", hashA, 3)
      expect(barResult.detected).toBe(true)
    })

    test("enforces sliding window limit", () => {
      const tracker = makeTracker(3) // Small window

      recordAndDetect(tracker, "foo.ts", hashA, 1) // Will be evicted
      recordAndDetect(tracker, "foo.ts", hashB, 2)
      recordAndDetect(tracker, "foo.ts", hashC, 3)
      recordAndDetect(tracker, "foo.ts", hashD, 4) // hashA is now evicted from window

      // hashA should NOT trigger oscillation since it's been evicted
      const result = recordAndDetect(tracker, "foo.ts", hashA, 5)
      expect(result.detected).toBe(false)

      // Verify the window only has the recent entries
      expect(tracker.history.get("foo.ts")!.length).toBeLessThanOrEqual(3)
    })

    test("detects oscillation within sliding window", () => {
      const tracker = makeTracker(4)

      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "foo.ts", hashB, 2)
      recordAndDetect(tracker, "foo.ts", hashC, 3)

      // hashA is still within the 4-entry window
      const result = recordAndDetect(tracker, "foo.ts", hashA, 4)
      expect(result.detected).toBe(true)
    })

    test("pattern labels use sequential letters", () => {
      const tracker = makeTracker()
      recordAndDetect(tracker, "f.ts", hashA, 1) // A
      recordAndDetect(tracker, "f.ts", hashB, 2) // B
      recordAndDetect(tracker, "f.ts", hashC, 3) // C
      const result = recordAndDetect(tracker, "f.ts", hashA, 4) // Back to A

      expect(result.detected).toBe(true)
      expect(result.pattern).toBe("A→B→C→A")
    })
  })

  describe("reset", () => {
    test("resets specific file history", () => {
      const tracker = createTracker()
      const hashA = contentHash("state A")
      const hashB = contentHash("state B")

      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "bar.ts", hashA, 1)

      reset(tracker, "foo.ts")

      expect(tracker.history.has("foo.ts")).toBe(false)
      expect(tracker.history.has("bar.ts")).toBe(true)
    })

    test("resets all file histories when no path specified", () => {
      const tracker = createTracker()
      recordAndDetect(tracker, "foo.ts", contentHash("a"), 1)
      recordAndDetect(tracker, "bar.ts", contentHash("b"), 1)

      reset(tracker)

      expect(tracker.history.size).toBe(0)
    })

    test("no oscillation after reset", () => {
      const tracker = createTracker()
      const hashA = contentHash("state A")
      const hashB = contentHash("state B")

      recordAndDetect(tracker, "foo.ts", hashA, 1)
      recordAndDetect(tracker, "foo.ts", hashB, 2)

      reset(tracker, "foo.ts")

      // After reset, returning to hashA should NOT trigger oscillation
      const result = recordAndDetect(tracker, "foo.ts", hashA, 3)
      expect(result.detected).toBe(false)
    })
  })

  describe("OscillationWarning.format", () => {
    test("returns undefined for non-detected result", () => {
      expect(OscillationWarning.format({ detected: false, filePath: "foo.ts" })).toBeUndefined()
    })

    test("returns warning string for detected oscillation", () => {
      const warning = OscillationWarning.format({
        detected: true,
        filePath: "src/app.ts",
        pattern: "A→B→A",
        turns: [1, 2, 3],
      })

      expect(warning).toBeDefined()
      expect(warning).toContain("OSCILLATION DETECTED")
      expect(warning).toContain("src/app.ts")
      expect(warning).toContain("A→B→A")
      expect(warning).toContain("strategy deadlock")
      expect(warning).toContain("fundamentally different approach")
    })
  })
})
