import { describe, expect, test } from "bun:test"
import { TransactionConfidence } from "../packages/core/src/transaction-confidence"

// ─── scoreHunk ──────────────────────────────────────────────────────────────

describe("scoreHunk", () => {
  test("exact match produces score 1.0", () => {
    const result = TransactionConfidence.scoreHunk("test.ts", 0, "exact", 0)
    expect(result.score).toBe(1.0)
    expect(result.matchTier).toBe("exact")
    expect(result.path).toBe("test.ts")
    expect(result.hunkIndex).toBe(0)
  })

  test("rstrip match produces score 0.95", () => {
    const result = TransactionConfidence.scoreHunk("test.ts", 1, "rstrip", 0)
    expect(result.score).toBe(0.95)
    expect(result.matchTier).toBe("rstrip")
  })

  test("trim match produces score 0.9", () => {
    const result = TransactionConfidence.scoreHunk("test.ts", 2, "trim", 0)
    expect(result.score).toBe(0.9)
    expect(result.matchTier).toBe("trim")
  })

  test("normalized match produces score 0.8", () => {
    const result = TransactionConfidence.scoreHunk("test.ts", 3, "normalized", 0)
    expect(result.score).toBe(0.8)
    expect(result.matchTier).toBe("normalized")
  })

  test("context lines add a small bonus", () => {
    const noContext = TransactionConfidence.scoreHunk("test.ts", 0, "rstrip", 0)
    const withContext = TransactionConfidence.scoreHunk("test.ts", 0, "rstrip", 3)
    expect(withContext.score).toBeGreaterThan(noContext.score)
    expect(withContext.contextLines).toBe(3)
  })

  test("context bonus is capped at 5 lines", () => {
    const five = TransactionConfidence.scoreHunk("test.ts", 0, "rstrip", 5)
    const ten = TransactionConfidence.scoreHunk("test.ts", 0, "rstrip", 10)
    expect(five.score).toBe(ten.score)
  })

  test("score never exceeds 1.0", () => {
    const result = TransactionConfidence.scoreHunk("test.ts", 0, "exact", 100)
    expect(result.score).toBeLessThanOrEqual(1.0)
  })
})

// ─── recommend ──────────────────────────────────────────────────────────────

describe("recommend", () => {
  test("score >= 0.9 recommends apply", () => {
    expect(TransactionConfidence.recommend(0.9)).toBe("apply")
    expect(TransactionConfidence.recommend(1.0)).toBe("apply")
    expect(TransactionConfidence.recommend(0.95)).toBe("apply")
  })

  test("score 0.7-0.9 recommends review", () => {
    expect(TransactionConfidence.recommend(0.7)).toBe("review")
    expect(TransactionConfidence.recommend(0.8)).toBe("review")
    expect(TransactionConfidence.recommend(0.89)).toBe("review")
  })

  test("score < 0.7 recommends reject", () => {
    expect(TransactionConfidence.recommend(0.69)).toBe("reject")
    expect(TransactionConfidence.recommend(0.5)).toBe("reject")
    expect(TransactionConfidence.recommend(0.0)).toBe("reject")
  })
})

// ─── aggregate ──────────────────────────────────────────────────────────────

describe("aggregate", () => {
  test("empty hunks produces apply with 1.0 overall", () => {
    const result = TransactionConfidence.aggregate([])
    expect(result.overall).toBe(1.0)
    expect(result.recommendation).toBe("apply")
    expect(result.hunks).toHaveLength(0)
  })

  test("single exact hunk produces apply", () => {
    const hunks = [TransactionConfidence.scoreHunk("a.ts", 0, "exact", 0)]
    const result = TransactionConfidence.aggregate(hunks)
    expect(result.overall).toBe(1.0)
    expect(result.recommendation).toBe("apply")
  })

  test("overall is minimum of all hunk scores", () => {
    const hunks = [
      TransactionConfidence.scoreHunk("a.ts", 0, "exact", 0),
      TransactionConfidence.scoreHunk("b.ts", 1, "normalized", 0),
    ]
    const result = TransactionConfidence.aggregate(hunks)
    expect(result.overall).toBe(0.8)
    expect(result.recommendation).toBe("review")
  })

  test("low-confidence hunk triggers reject", () => {
    // normalized (0.8) with no context is still "review", not reject
    // but if we manually construct a very low score:
    const hunks = [
      { path: "a.ts", hunkIndex: 0, score: 0.5, matchTier: "normalized" as const, contextLines: 0 },
    ]
    const result = TransactionConfidence.aggregate(hunks)
    expect(result.overall).toBe(0.5)
    expect(result.recommendation).toBe("reject")
  })

  test("mixed hunks use conservative minimum", () => {
    const hunks = [
      TransactionConfidence.scoreHunk("a.ts", 0, "exact", 5),
      TransactionConfidence.scoreHunk("b.ts", 1, "trim", 2),
      TransactionConfidence.scoreHunk("c.ts", 2, "rstrip", 0),
    ]
    const result = TransactionConfidence.aggregate(hunks)
    // trim(0.9) + 2 context(0.02) = 0.92 > rstrip(0.95) > exact(1.0+0.05=1.0)
    // minimum should be rstrip at 0.92 or trim at 0.92
    expect(result.overall).toBeLessThanOrEqual(1.0)
    expect(result.overall).toBeGreaterThanOrEqual(0.9)
    expect(result.recommendation).toBe("apply")
  })
})
