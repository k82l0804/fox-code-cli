import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { harnessCommit, rollbackToCommit } from "@/session/processor"
import {
  resolveExitCondition,
  isCodeChangeTask,
  buildEmptyExitReflectionText,
  formatWakeUpAudit,
  type ExitConditionState,
} from "@/session/control-plane"
import { createJournal } from "@/session/mutation-journal"
import { classifyIntent } from "@/foxcode/intent"

function runGit(args: string[], cwd: string) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    windowsHide: true,
  })
  if (result.exitCode !== 0) {
    throw new Error(`Git command failed (${args.join(" ")}): ${result.stderr.toString()}`)
  }
  return result.stdout.toString().trim()
}

describe("Exit Gate — Harness Commit & Rollback", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "fox-harness-commit-test-"))
    runGit(["init"], testDir)
    runGit(["config", "user.name", "Fox Test"], testDir)
    runGit(["config", "user.email", "fox@example.com"], testDir)

    // Initial base commit
    await writeFile(join(testDir, "app.ts"), "const x = 1\n")
    runGit(["add", "app.ts"], testDir)
    runGit(["commit", "-m", "chore: base commit"], testDir)
  })

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test("harnessCommit creates commit with deterministic message format and returns short hash", async () => {
    const file = join(testDir, "app.ts")
    await writeFile(file, "const x = 2\n")

    const shortHash = await harnessCommit(testDir, [file], "edit")
    expect(shortHash).toBeDefined()
    expect(shortHash!.length).toBeGreaterThanOrEqual(7)

    const logMsg = runGit(["log", "-1", "--format=%B"], testDir)
    expect(logMsg).toBe("fox: edit app.ts")

    const logHash = runGit(["log", "-1", "--format=%h"], testDir)
    expect(logHash).toBe(shortHash!)
  })

  test("harnessCommit returns undefined when files have no actual changes", async () => {
    const file = join(testDir, "app.ts")
    // File content identical to current HEAD
    const shortHash = await harnessCommit(testDir, [file], "edit")
    expect(shortHash).toBeUndefined()
  })

  test("rollbackToCommit resets workspace to target commit", async () => {
    const file = join(testDir, "app.ts")
    const baseHash = runGit(["rev-parse", "HEAD"], testDir)

    // Make and commit change
    await writeFile(file, "const x = 999\n")
    const hash = await harnessCommit(testDir, [file], "edit")
    expect(hash).toBeDefined()
    expect(await readFile(file, "utf-8")).toBe("const x = 999\n")

    // Rollback to base
    const success = await rollbackToCommit(testDir, baseHash)
    expect(success).toBe(true)
    expect(await readFile(file, "utf-8")).toBe("const x = 1\n")
  })
})

describe("Exit Gate — Control Plane Integration Decisions", () => {
  test("code-change task with empty journal continues and injects reflection", () => {
    const journal = createJournal()
    const intent = classifyIntent({ message: "fix the rate limiter bug in api.ts" })
    const isCodeChange = isCodeChangeTask(intent, "fix the rate limiter bug in api.ts", true)
    expect(isCodeChange).toBe(true)

    const decision = resolveExitCondition({
      isCodeChangeTask: isCodeChange,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      parseFailStreak: 0,
      tier: "B",
    })

    expect(decision.action).toBe("continue")
    expect(decision.incrementEmptyExit).toBe(true)
    expect(decision.reflectionText).toContain("`edit`")
    expect(decision.reflectionText).toContain("No files were modified")
  })

  test("code-change task with empty journal uses rewrite_file for Tier C/D", () => {
    const journal = createJournal()
    const text = buildEmptyExitReflectionText("C")
    expect(text).toContain("`rewrite_file`")

    const decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      parseFailStreak: 0,
      tier: "C",
    })
    expect(decision.action).toBe("continue")
    expect(decision.reflectionText).toContain("`rewrite_file`")
  })

  test("non-code task exits cleanly without requiring mutations", () => {
    const journal = createJournal()
    const intent = classifyIntent({ message: "explain how authentication works" })
    const isCodeChange = isCodeChangeTask(intent, "explain how authentication works", true)
    expect(isCodeChange).toBe(false)

    const decision = resolveExitCondition({
      isCodeChangeTask: isCodeChange,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
    })

    expect(decision.action).toBe("break")
    expect(decision.terminalState).toBe("done")
  })

  test("regressions detected with budget remaining prompts reflection with details", () => {
    const decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: false,
      emptyExitRetries: 0,
      hasNewRegressions: true,
      repairBudgetExhausted: false,
      hasGreenCommit: true,
      isMaxSteps: false,
      regressionReflectionText: "FAIL: test_rate_limit: timeout after 5000ms",
    })

    expect(decision.action).toBe("continue")
    expect(decision.reflectionText).toBe("FAIL: test_rate_limit: timeout after 5000ms")
    expect(decision.reason).toBe("new regressions detected")
  })

  test("regressions detected with exhausted budget triggers rollback to green commit", () => {
    const decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: false,
      emptyExitRetries: 0,
      hasNewRegressions: true,
      repairBudgetExhausted: true,
      hasGreenCommit: true,
      isMaxSteps: false,
    })

    expect(decision.action).toBe("rollback")
    expect(decision.terminalState).toBe("failed-safe")
  })

  test("parse-fail streak = 3 trips circuit breaker", () => {
    const decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: false,
      emptyExitRetries: 0,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: true,
      isMaxSteps: false,
      parseFailStreak: 3,
      maxParseFailStreak: 3,
    })

    expect(decision.action).toBe("rollback")
    expect(decision.terminalState).toBe("failed-safe")
    expect(decision.reason).toContain("parse-fail circuit breaker")
  })

  test("wake-up audit is formatted properly for all terminal exits", () => {
    const audit = formatWakeUpAudit({
      terminalState: "needs-review",
      sessionID: "sess_test",
      reason: "empty exit retries exhausted (2)",
      modifiedFiles: [],
      suggestedPrompt: "Check session state and decide next steps.",
    })

    expect(audit).toContain("=== [Fox Wake-up Audit] ===")
    expect(audit).toContain("Terminal State : needs-review")
    expect(audit).toContain("Session ID     : sess_test")
    expect(audit).toContain("Reason         : empty exit retries exhausted (2)")
  })
})
