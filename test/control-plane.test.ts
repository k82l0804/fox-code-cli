import { describe, expect, test } from "bun:test"
import {
  resolveExitCondition,
  isCodeChangeTask,
  formatWakeUpAudit,
  buildSuggestedPrompt,
  buildEmptyExitReflectionText,
  CODE_CHANGE_OVERRIDE_WORDS,
  type ExitConditionState,
} from "../src/session/control-plane"
import type { IntentClassification } from "../src/foxcode/intent"

describe("Control Plane — resolveExitCondition", () => {
  const baseState: ExitConditionState = {
    isCodeChangeTask: true,
    journalEmpty: false,
    emptyExitRetries: 0,
    maxEmptyExitRetries: 2,
    hasNewRegressions: false,
    repairBudgetExhausted: false,
    maxRepairTurns: 3,
    hasGreenCommit: false,
    isMaxSteps: false,
    parseFailStreak: 0,
    maxParseFailStreak: 3,
  }

  test("1. Max steps overrides all other conditions", () => {
    const decision = resolveExitCondition({
      ...baseState,
      isMaxSteps: true,
      journalEmpty: true,
      hasNewRegressions: true,
      parseFailStreak: 5,
    })
    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("needs-review")
    expect(decision.reason).toBe("max steps reached")
  })

  test("2. Non-code task exits normally with done state", () => {
    const decision = resolveExitCondition({
      ...baseState,
      isCodeChangeTask: false,
      journalEmpty: true, // even if no mutations occurred
    })
    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("done")
    expect(decision.reason).toContain("non-code task")
  })

  test("3. Parse-fail circuit breaker trips at streak threshold with rollback if green commit exists", () => {
    const decision = resolveExitCondition({
      ...baseState,
      parseFailStreak: 3,
      hasGreenCommit: true,
    })
    expect(decision.action).toBe("rollback")
    expect(decision.terminalState).toBe("failed-safe")
    expect(decision.reason).toContain("parse-fail circuit breaker")
  })

  test("3b. Parse-fail circuit breaker trips with break if no green commit exists", () => {
    const decision = resolveExitCondition({
      ...baseState,
      parseFailStreak: 3,
      hasGreenCommit: false,
    })
    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("failed-safe")
    expect(decision.reason).toContain("parse-fail circuit breaker")
  })

  test("3c. Parse-fail streak below threshold does not trip circuit breaker", () => {
    const decision = resolveExitCondition({
      ...baseState,
      parseFailStreak: 2,
      journalEmpty: true, // will trigger empty journal check
    })
    expect(decision.action).toBe("continue")
    expect(decision.incrementEmptyExit).toBe(true)
  })

  test("4. Empty journal on code-change task prompts reflection if retries remain", () => {
    const decision = resolveExitCondition({
      ...baseState,
      journalEmpty: true,
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
    })
    expect(decision.action).toBe("continue")
    expect(decision.incrementEmptyExit).toBe(true)
    expect(decision.reflectionText).toContain("No files were modified")
    expect(decision.reason).toBe("no mutations on code-change task")
  })

  test("4b. Empty journal on code-change task breaks with needs-review when retries exhausted", () => {
    const decision = resolveExitCondition({
      ...baseState,
      journalEmpty: true,
      emptyExitRetries: 2,
      maxEmptyExitRetries: 2,
    })
    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("needs-review")
    expect(decision.reason).toContain("empty exit retries exhausted")
  })

  test("5. Regressions continue with reflection when repair budget not exhausted", () => {
    const decision = resolveExitCondition({
      ...baseState,
      hasNewRegressions: true,
      repairBudgetExhausted: false,
    })
    expect(decision.action).toBe("continue")
    expect(decision.reflectionText).toContain("regressions")
    expect(decision.reason).toBe("new regressions detected")
  })

  test("5b. Regressions rollback to green commit when repair budget is exhausted", () => {
    const decision = resolveExitCondition({
      ...baseState,
      hasNewRegressions: true,
      repairBudgetExhausted: true,
      hasGreenCommit: true,
    })
    expect(decision.action).toBe("rollback")
    expect(decision.terminalState).toBe("failed-safe")
    expect(decision.reason).toContain("repair budget exhausted")
  })

  test("5c. Regressions break with needs-review when repair budget is exhausted and no green commit exists", () => {
    const decision = resolveExitCondition({
      ...baseState,
      hasNewRegressions: true,
      repairBudgetExhausted: true,
      hasGreenCommit: false,
    })
    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("needs-review")
    expect(decision.reason).toContain("repair budget exhausted")
  })

  test("6. Mutations applied and verification passed exits cleanly as done", () => {
    const decision = resolveExitCondition({
      ...baseState,
      journalEmpty: false,
      hasNewRegressions: false,
    })
    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("done")
    expect(decision.reason).toBe("mutations applied, verification passed")
  })
})

describe("Control Plane — isCodeChangeTask", () => {
  test("returns true when intent.needsWriteTools is true", () => {
    const intent: Partial<IntentClassification> = {
      needsWriteTools: true,
      intent: "feature",
    }
    expect(isCodeChangeTask(intent as IntentClassification, "do something", false)).toBe(true)
    expect(isCodeChangeTask(intent as IntentClassification, "do something", true)).toBe(true)
  })

  test("intent override: 'the rate limiter tests are failing' with research intent + edit tools returns true", () => {
    const intent: Partial<IntentClassification> = {
      needsWriteTools: false,
      intent: "research",
    }
    expect(isCodeChangeTask(intent as IntentClassification, "the rate limiter tests are failing", true)).toBe(true)
  })

  test("research intent with no edit tools returns false even with override words", () => {
    const intent: Partial<IntentClassification> = {
      needsWriteTools: false,
      intent: "research",
    }
    expect(isCodeChangeTask(intent as IntentClassification, "the rate limiter tests are failing", false)).toBe(false)
  })

  test("research intent without override words returns false even with edit tools", () => {
    const intent: Partial<IntentClassification> = {
      needsWriteTools: false,
      intent: "research",
    }
    expect(isCodeChangeTask(intent as IntentClassification, "explain how the cache works", true)).toBe(false)
  })

  test("string input directly classifies and respects override words", () => {
    expect(isCodeChangeTask("the rate limiter tests are failing", true)).toBe(true)
    expect(isCodeChangeTask("explain what this function does", false)).toBe(false)
  })

  test("override words regex matches all expected terms", () => {
    const words = [
      "fix", "add", "refactor", "implement", "create", "update", "change",
      "modify", "remove", "delete", "failing", "broken", "bug", "error",
    ]
    for (const word of words) {
      expect(CODE_CHANGE_OVERRIDE_WORDS.test(`Please ${word} the login issue`)).toBe(true)
    }
    expect(CODE_CHANGE_OVERRIDE_WORDS.test("Explain how authentication works")).toBe(false)
  })
})

describe("Control Plane — Reflection & Audit Helpers", () => {
  test("buildEmptyExitReflectionText adapts to model tier", () => {
    expect(buildEmptyExitReflectionText("S")).toContain("`edit`")
    expect(buildEmptyExitReflectionText("A")).toContain("`edit`")
    expect(buildEmptyExitReflectionText("B")).toContain("`edit`")
    expect(buildEmptyExitReflectionText("C")).toContain("`rewrite_file`")
    expect(buildEmptyExitReflectionText("D")).toContain("`rewrite_file`")
  })

  test("formatWakeUpAudit formats all fields accurately", () => {
    const audit = formatWakeUpAudit({
      terminalState: "failed-safe",
      sessionID: "sess_123",
      reason: "repair budget exhausted (3 cycles)",
      rollbackAnchor: "c3d4e5f",
      modifiedFiles: ["/src/a.ts", "/src/b.ts"],
      failedStage: "typecheck",
      suggestedPrompt: "Rolled back to green commit. Focus on fixing: typecheck",
    })

    expect(audit).toContain("=== [Fox Wake-up Audit] ===")
    expect(audit).toContain("Terminal State : failed-safe")
    expect(audit).toContain("Session ID     : sess_123")
    expect(audit).toContain("Reason         : repair budget exhausted (3 cycles)")
    expect(audit).toContain("Rollback Anchor: c3d4e5f")
    expect(audit).toContain("Modified Files : [/src/a.ts, /src/b.ts]")
    expect(audit).toContain("Failing Stage  : typecheck")
    expect(audit).toContain('Suggested Next : "Rolled back to green commit. Focus on fixing: typecheck"')
  })

  test("buildSuggestedPrompt returns appropriate prompt for terminal states", () => {
    expect(buildSuggestedPrompt({ action: "break", terminalState: "done", reason: "all pass" })).toContain("Review")
    expect(buildSuggestedPrompt({ action: "rollback", terminalState: "failed-safe", reason: "regressions" })).toContain("Rolled back")
    expect(buildSuggestedPrompt({ action: "break", terminalState: "needs-review", reason: "budget exhausted" })).toContain("Budget exhausted")
    expect(buildSuggestedPrompt({ action: "break", terminalState: "blocked", reason: "human input needed" })).toContain("Human decision")
  })
})
