import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect } from "effect"
import { makePromptLoop } from "@/session/prompt/loop"
import { createJournal } from "@/session/mutation-journal"
import { harnessCommit, rollbackToCommit } from "@/session/processor"
import {
  resolveExitCondition,
  isCodeChangeTask,
  formatWakeUpAudit,
  buildEmptyExitReflectionText,
} from "@/session/control-plane"
import { classifyIntent } from "@/foxcode/intent"
import { RepairBudgetTracker } from "@opencode-ai/core/repair-budget"

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

describe("Exit Gate Full-Stack Smoke Tests", () => {
  let fixtureDir: string

  beforeEach(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), "fox-exit-smoke-"))
    runGit(["init"], fixtureDir)
    runGit(["config", "user.name", "Smoke Tester"], fixtureDir)
    runGit(["config", "user.email", "smoke@example.com"], fixtureDir)

    // Base repo setup with package.json
    await writeFile(
      join(fixtureDir, "package.json"),
      JSON.stringify({
        name: "fixture-repo",
        scripts: {
          test: "echo 'tests passed'",
        },
      }),
    )
    await writeFile(join(fixtureDir, "index.ts"), "export const value = 1;\n")
    runGit(["add", "."], fixtureDir)
    runGit(["commit", "-m", "chore: initial commit"], fixtureDir)
  })

  afterEach(async () => {
    if (fixtureDir) {
      await rm(fixtureDir, { recursive: true, force: true })
    }
  })

  test("Smoke 1: Code-change task with empty journal refuses finish and injects reflection", async () => {
    const userPrompt = "fix the failing rate limiter test in index.ts"
    const intent = classifyIntent({ message: userPrompt })
    const isCodeChange = isCodeChangeTask(intent, userPrompt, true)
    expect(isCodeChange).toBe(true)

    const journal = createJournal()
    expect(journal.isEmpty()).toBe(true)

    // First attempt: empty journal -> continue with reflection
    const firstDecision = resolveExitCondition({
      isCodeChangeTask: isCodeChange,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      tier: "B",
    })

    expect(firstDecision.action).toBe("continue")
    expect(firstDecision.incrementEmptyExit).toBe(true)
    expect(firstDecision.reflectionText).toContain("No files were modified")
    expect(firstDecision.reflectionText).toContain("`edit`")

    // Second attempt: still empty -> continue with reflection
    const secondDecision = resolveExitCondition({
      isCodeChangeTask: isCodeChange,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 1,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      tier: "B",
    })
    expect(secondDecision.action).toBe("continue")

    // Third attempt: retries exhausted -> break with needs-review
    const thirdDecision = resolveExitCondition({
      isCodeChangeTask: isCodeChange,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 2,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      tier: "B",
    })
    expect(thirdDecision.action).toBe("break")
    expect(thirdDecision.terminalState).toBe("needs-review")
    expect(thirdDecision.reason).toContain("empty exit retries exhausted")
  })

  test("Smoke 2: Non-code task exits cleanly on finish without requiring mutations", async () => {
    const userPrompt = "explain how the index.ts exports work"
    const intent = classifyIntent({ message: userPrompt })
    const isCodeChange = isCodeChangeTask(intent, userPrompt, true)
    expect(isCodeChange).toBe(false)

    const journal = createJournal()
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
    expect(decision.reason).toContain("non-code task")
  })

  test("Smoke 3: Verification failure injects regression details until budget exhaustion", async () => {
    const budget = RepairBudgetTracker.createBudget(3)
    const journal = createJournal()
    journal.record({
      tool: "edit",
      file: join(fixtureDir, "index.ts"),
      timestamp: Date.now(),
      messageId: "msg_1",
    })

    // Cycle 1: Failure with budget remaining -> continue
    RepairBudgetTracker.recordFailure(budget)
    const decision1 = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      hasNewRegressions: true,
      repairBudgetExhausted: RepairBudgetTracker.isExhausted(budget),
      hasGreenCommit: false,
      isMaxSteps: false,
      regressionReflectionText: "1 failed test: test/index.test.ts",
    })
    expect(decision1.action).toBe("continue")
    expect(decision1.reflectionText).toContain("1 failed test")

    // Cycle 2: Failure
    RepairBudgetTracker.recordFailure(budget)
    // Cycle 3: Failure -> budget exhausted
    const res3 = RepairBudgetTracker.recordFailure(budget)
    expect(res3.exhausted).toBe(true)

    // With budget exhausted and no green commit: halt with needs-review
    const decisionExhausted = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      hasNewRegressions: true,
      repairBudgetExhausted: true,
      hasGreenCommit: false,
      isMaxSteps: false,
    })
    expect(decisionExhausted.action).toBe("break")
    expect(decisionExhausted.terminalState).toBe("needs-review")
    expect(decisionExhausted.reason).toContain("repair budget exhausted")
  })

  test("Smoke 4: Successful mutation creates harness commit and enables rollback on subsequent regression", async () => {
    const targetFile = join(fixtureDir, "index.ts")
    const baseCommit = runGit(["rev-parse", "HEAD"], fixtureDir)

    // 1. Model applies mutation
    await writeFile(targetFile, "export const value = 42;\n")
    const commitHash = await harnessCommit(fixtureDir, [targetFile], "edit")
    expect(commitHash).toBeDefined()

    // 2. Verification passes -> this commit is a green anchor
    const journal = createJournal()
    journal.record({
      tool: "edit",
      file: targetFile,
      timestamp: Date.now(),
      messageId: "msg_green",
    })

    // 3. Subsequent mutation introduces a bug and budget is exhausted
    await writeFile(targetFile, "export const value = INVALID_SYNTAX;\n")
    const brokenCommit = await harnessCommit(fixtureDir, [targetFile], "edit")
    expect(brokenCommit).toBeDefined()

    const decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: false,
      emptyExitRetries: 0,
      hasNewRegressions: true,
      repairBudgetExhausted: true,
      hasGreenCommit: true, // green commit exists
      isMaxSteps: false,
    })

    expect(decision.action).toBe("rollback")
    expect(decision.terminalState).toBe("failed-safe")

    // 4. Rollback executes to green commit
    const rollbackSuccess = await rollbackToCommit(fixtureDir, commitHash!)
    expect(rollbackSuccess).toBe(true)

    const restoredContent = runGit(["show", "HEAD:index.ts"], fixtureDir)
    expect(restoredContent).toContain("export const value = 42;")

    // 5. Wake-up audit formats the rollback anchor
    const audit = formatWakeUpAudit({
      terminalState: decision.terminalState!,
      sessionID: "smoke_session_1",
      reason: decision.reason,
      rollbackAnchor: commitHash,
      modifiedFiles: [targetFile],
      failedStage: "typecheck",
    })
    expect(audit).toContain(`Rollback Anchor: ${commitHash}`)
    expect(audit).toContain("Terminal State : failed-safe")
  })

  test("Smoke 5: makePromptLoop initializes all PR 1 exit gate deps cleanly", () => {
    const mockProcessor: any = {
      create: () => Effect.succeed({} as any),
      getJournal: () => createJournal(),
      getRepairBudget: () => RepairBudgetTracker.createBudget(3),
      getVerificationBaseline: () => undefined,
      getHarnessCommits: () => [],
      getLastGreenCommit: () => undefined,
      rollbackToLastGreen: () => Effect.succeed(true),
      getParseFailStreak: () => 0,
      resetParseFailStreak: () => {},
      tagCommitGreen: () => {},
    }

    const fakeDeps: any = {
      sessions: {
        get: () => Effect.succeed({ id: "s1" } as any),
        updateMessage: () => Effect.void,
        updatePart: () => Effect.void,
      },
      status: { set: () => Effect.void },
      agents: { get: () => Effect.succeed({ name: "code", steps: 10 } as any) },
      provider: {},
      processor: mockProcessor,
      compaction: {},
      plugin: {},
      config: {
        get: () => Effect.succeed({} as any),
        directories: () => Effect.succeed([fixtureDir]),
      },
      permission: {},
      question: {},
      fsys: {},
      mcp: {},
      registry: {},
      truncate: {},
      scope: {},
      instruction: {},
      state: {},
      summary: {},
      sys: {},
      events: { publish: () => Effect.void },
      flags: {},
      database: {},
      control: {},
      ops: () => Effect.succeed({} as any),
      getModel: () =>
        Effect.succeed({
          api: { id: "gemini-2.5-flash" },
          id: "gemini-2.5-flash",
          providerID: "google",
        } as any),
      handleSubtask: () => Effect.void,
      title: () => Effect.void,
      lastAssistant: () => Effect.succeed({ info: {} as any, parts: [] }),
    }

    const loopModule = makePromptLoop(fakeDeps)
    expect(loopModule).toBeDefined()
    expect(typeof loopModule.loop).toBe("function")
    expect(typeof loopModule.runLoop).toBe("function")
  })
})
