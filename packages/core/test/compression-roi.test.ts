import { describe, expect, test, beforeEach } from "bun:test"
import {
  CompressionMetrics,
  ROI_THRESHOLD,
} from "../src/tool/compression-metrics"

// ═══════════════════════════════════════════════════════════════════════════
// ROI Scoring & Auto-Skip
// ═══════════════════════════════════════════════════════════════════════════

describe("ROI scoring", () => {
  beforeEach(() => {
    CompressionMetrics.reset()
    CompressionMetrics.resetROI()
  })

  test("calculates ROI correctly", () => {
    // 100 chars saved in 10ms = ROI of 10
    CompressionMetrics.recordTransformROI("test", 100, 10)
    const roi = CompressionMetrics.getTransformROI("test")
    expect(roi).toBeDefined()
    expect(roi!.avgROI).toBe(10)
    expect(roi!.skipped).toBe(false)
  })

  test("marks low-ROI transforms as skipped after 3+ calls", () => {
    // ROI = 1 (below threshold of 5)
    CompressionMetrics.recordTransformROI("slow", 1, 1)
    CompressionMetrics.recordTransformROI("slow", 1, 1)
    CompressionMetrics.recordTransformROI("slow", 1, 1)
    const roi = CompressionMetrics.getTransformROI("slow")
    expect(roi!.skipped).toBe(true)
  })

  test("does not skip high-ROI transforms", () => {
    // ROI = 100 (well above threshold)
    CompressionMetrics.recordTransformROI("fast", 100, 1)
    CompressionMetrics.recordTransformROI("fast", 100, 1)
    CompressionMetrics.recordTransformROI("fast", 100, 1)
    expect(CompressionMetrics.shouldSkip("fast")).toBe(false)
  })

  test("shouldSkip returns false for unknown transforms", () => {
    expect(CompressionMetrics.shouldSkip("nonexistent")).toBe(false)
  })

  test("re-evaluates skipped transforms periodically", () => {
    // Mark as skipped
    for (let i = 0; i < 5; i++) {
      CompressionMetrics.recordTransformROI("flaky", 1, 1)
    }
    expect(CompressionMetrics.shouldSkip("flaky")).toBe(true)

    // Simulate 20 calls where it would be skipped
    for (let i = 0; i < 19; i++) {
      CompressionMetrics.shouldSkip("flaky")
    }
    // On the 20th check, it should be re-evaluated (not skipped)
    expect(CompressionMetrics.shouldSkip("flaky")).toBe(false)
  })

  test("handles zero duration (infinite ROI)", () => {
    CompressionMetrics.recordTransformROI("instant", 100, 0)
    const roi = CompressionMetrics.getTransformROI("instant")
    expect(roi).toBeDefined()
    expect(roi!.avgROI).toBe(Infinity)
    expect(roi!.skipped).toBe(false)
  })

  test("sliding window limits size to 10", () => {
    // Fill 15 entries, window should only keep last 10
    for (let i = 0; i < 15; i++) {
      CompressionMetrics.recordTransformROI("window", 100, 10)
    }
    // Can't directly check window size, but ROI should still be correct
    const roi = CompressionMetrics.getTransformROI("window")
    expect(roi!.avgROI).toBe(10)
  })

  test("ROI_THRESHOLD is exported and equals 5", () => {
    expect(ROI_THRESHOLD).toBe(5)
  })

  test("resetROI clears all tracking", () => {
    CompressionMetrics.recordTransformROI("temp", 100, 10)
    expect(CompressionMetrics.getTransformROI("temp")).toBeDefined()
    CompressionMetrics.resetROI()
    expect(CompressionMetrics.getTransformROI("temp")).toBeUndefined()
  })
})
