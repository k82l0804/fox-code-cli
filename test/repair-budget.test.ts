import { describe, expect, test } from "bun:test"
import {
  createBudget,
  recordFailure,
  recordSuccess,
  reset,
  isExhausted,
  RepairBudgetWarning,
  type RepairBudget,
} from "@opencode-ai/core/repair-budget"

describe("RepairBudget", () => {
  describe("createBudget", () => {
    test("creates budget with default maxTurns of 3", () => {
      const budget = createBudget()
      expect(budget.maxTurns).toBe(3)
      expect(budget.consecutiveFailures).toBe(0)
      expect(budget.totalRepairTurns).toBe(0)
    })

    test("creates budget with custom maxTurns", () => {
      const budget = createBudget(5)
      expect(budget.maxTurns).toBe(5)
    })
  })

  describe("recordFailure", () => {
    test("increments consecutive failures", () => {
      const budget = createBudget(3)
      const r1 = recordFailure(budget)
      expect(r1.consecutiveFailures).toBe(1)
      expect(r1.exhausted).toBe(false)

      const r2 = recordFailure(budget)
      expect(r2.consecutiveFailures).toBe(2)
      expect(r2.exhausted).toBe(false)
    })

    test("exhausts budget at threshold", () => {
      const budget = createBudget(3)
      recordFailure(budget)
      recordFailure(budget)
      const r3 = recordFailure(budget)
      expect(r3.exhausted).toBe(true)
      expect(r3.consecutiveFailures).toBe(3)
    })

    test("increments total repair turns", () => {
      const budget = createBudget(3)
      recordFailure(budget)
      recordFailure(budget)
      expect(budget.totalRepairTurns).toBe(2)
    })

    test("stays exhausted beyond threshold", () => {
      const budget = createBudget(2)
      recordFailure(budget)
      recordFailure(budget) // Exhausted
      const r = recordFailure(budget) // Beyond
      expect(r.exhausted).toBe(true)
      expect(r.consecutiveFailures).toBe(3)
    })
  })

  describe("recordSuccess", () => {
    test("resets consecutive failures", () => {
      const budget = createBudget(3)
      recordFailure(budget)
      recordFailure(budget)
      const result = recordSuccess(budget)
      expect(result.consecutiveFailures).toBe(0)
      expect(result.exhausted).toBe(false)
    })

    test("preserves total repair turns", () => {
      const budget = createBudget(3)
      recordFailure(budget) // total: 1
      recordFailure(budget) // total: 2
      recordSuccess(budget) // consecutive reset, total stays
      expect(budget.totalRepairTurns).toBe(2)
    })

    test("allows new failures after success", () => {
      const budget = createBudget(2)
      recordFailure(budget)
      recordFailure(budget) // Exhausted
      recordSuccess(budget) // Reset

      // Should be able to fail again without immediate exhaustion
      const r = recordFailure(budget)
      expect(r.exhausted).toBe(false)
      expect(r.consecutiveFailures).toBe(1)
    })
  })

  describe("reset", () => {
    test("clears all counters", () => {
      const budget = createBudget(3)
      recordFailure(budget)
      recordFailure(budget)
      recordFailure(budget)

      reset(budget)
      expect(budget.consecutiveFailures).toBe(0)
      expect(budget.totalRepairTurns).toBe(0)
    })
  })

  describe("isExhausted", () => {
    test("returns false for fresh budget", () => {
      expect(isExhausted(createBudget())).toBe(false)
    })

    test("returns true at threshold", () => {
      const budget = createBudget(2)
      recordFailure(budget)
      expect(isExhausted(budget)).toBe(false)
      recordFailure(budget)
      expect(isExhausted(budget)).toBe(true)
    })

    test("returns false after success reset", () => {
      const budget = createBudget(2)
      recordFailure(budget)
      recordFailure(budget)
      expect(isExhausted(budget)).toBe(true)
      recordSuccess(budget)
      expect(isExhausted(budget)).toBe(false)
    })
  })

  describe("RepairBudgetWarning.format", () => {
    test("returns undefined when budget is not exhausted", () => {
      const budget = createBudget(3)
      recordFailure(budget)
      expect(RepairBudgetWarning.format(budget)).toBeUndefined()
    })

    test("returns warning string when budget is exhausted", () => {
      const budget = createBudget(3)
      recordFailure(budget)
      recordFailure(budget)
      recordFailure(budget)

      const warning = RepairBudgetWarning.format(budget)
      expect(warning).toBeDefined()
      expect(warning).toContain("REPAIR BUDGET EXHAUSTED")
      expect(warning).toContain("3 consecutive failed")
      expect(warning).toContain("STOP your current approach")
      expect(warning).toContain("overall strategy")
    })

    test("includes total repair turns in warning", () => {
      const budget = createBudget(2)
      recordFailure(budget)
      recordSuccess(budget) // total: 1
      recordFailure(budget) // total: 2
      recordFailure(budget) // total: 3, exhausted

      const warning = RepairBudgetWarning.format(budget)
      expect(warning).toContain("Total repair turns this session: 3")
    })
  })
})
