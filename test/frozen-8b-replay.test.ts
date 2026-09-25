import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createJournal } from "@/session/mutation-journal"
import { harnessCommit, rollbackToCommit } from "@/session/processor"
import {
  resolveExitCondition,
  isCodeChangeTask,
  formatWakeUpAudit,
  buildEmptyExitReflectionText,
} from "@/session/control-plane"
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

describe("Frozen 8B Empty-Exit Trace Replay (Phase 2E PR 1 Gate)", () => {
  let fixtureDir: string

  beforeEach(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), "fox-8b-replay-"))
    runGit(["init"], fixtureDir)
    runGit(["config", "user.name", "8B Replay Tester"], fixtureDir)
    runGit(["config", "user.email", "replay@example.com"], fixtureDir)

    // Base package.json
    await writeFile(
      join(fixtureDir, "package.json"),
      JSON.stringify({
        name: "task-3-rate-limiter",
        scripts: { test: "echo 'all tests pass'" },
      }),
    )

    // The real 1-span bug from Task 3 (sliding window weighting)
    await writeFile(
      join(fixtureDir, "rate_limiter.ts"),
      `export class SlidingWindowRateLimiter {
  private limit: number;
  private windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  public calculateWeight(elapsed: number): number {
    // BUG: inverted weighting
    return elapsed / this.windowMs;
  }
}
`,
    )

    // Decoy file (must NOT be touched)
    await writeFile(
      join(fixtureDir, "decoy.ts"),
      `export const logger = { log: (msg: string) => console.log("[DECOY]", msg) };\n`,
    )

    runGit(["add", "."], fixtureDir)
    runGit(["commit", "-m", "chore: initial benchmark setup"], fixtureDir)
  })

  afterEach(async () => {
    if (fixtureDir) {
      await rm(fixtureDir, { recursive: true, force: true })
    }
  })

  test("Gate Test: 8B prose-only completion on Task 3 is REJECTED by exit gate", () => {
    const taskPrompt =
      "The Sliding Window Rate Limiter implementation at `rate_limiter.ts` is failing multiple tests. " +
      "Surgically fix the bugs in `rate_limiter.ts` so all tests pass. Do NOT modify or delete `test_rate_limiter.ts`."

    // 1. Classifier + override evaluate the intent
    const intent = classifyIntent({ message: taskPrompt })
    const isCodeChange = isCodeChangeTask(intent, taskPrompt, true)
    expect(isCodeChange).toBe(true)

    // 2. Frozen 8B Turn 1: Model outputs prose explanation without calling any tool
    const frozen8BTurn1Prose =
      "I have analyzed `rate_limiter.ts` and identified the bug in `calculateWeight`. " +
      "The formula divides elapsed time directly instead of computing the remaining proportion. " +
      "The fix is to subtract elapsed / windowMs from 1. All tests should now pass."

    const journal = createJournal()
    expect(journal.isEmpty()).toBe(true)

    // Pre-PR1 behavior: loop checked finish="stop" without tool-calls and exited!
    // Post-PR1 behavior: resolveExitCondition intercepts
    const exitDecision = resolveExitCondition({
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

    // Assert: PR 1 REJECTS exit on prose
    expect(exitDecision.action).toBe("continue")
    expect(exitDecision.incrementEmptyExit).toBe(true)
    expect(exitDecision.terminalState).toBeUndefined()
    expect(exitDecision.reflectionText).toContain("No files were modified. The task requires a code change.")
    expect(exitDecision.reflectionText).toContain("Please use the `edit` tool to make the necessary changes.")
    expect(exitDecision.reflectionText).toContain("Do not describe the changes — apply them directly.")

    // For Tier C/D, reflection directs to rewrite_file
    const tierCDecision = resolveExitCondition({
      isCodeChangeTask: isCodeChange,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      tier: "C",
    })
    expect(tierCDecision.action).toBe("continue")
    expect(tierCDecision.reflectionText).toContain("Please use the `rewrite_file` tool")
  })

  test("Gate Test: 8B replay recovers after reflection, mutates real span, and triggers harness commit", async () => {
    const taskPrompt = "Surgically fix the bug in rate_limiter.ts"
    const journal = createJournal()

    // Turn 1: Empty exit intercepted
    const turn1Decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
      tier: "B",
    })
    expect(turn1Decision.action).toBe("continue")

    // Turn 2: In response to reflection, model applies surgical fix to rate_limiter.ts
    const targetFile = join(fixtureDir, "rate_limiter.ts")
    const decoyFile = join(fixtureDir, "decoy.ts")

    const originalDecoyContent = await readFile(decoyFile, "utf-8")

    // Apply surgical fix to rate_limiter.ts
    await writeFile(
      targetFile,
      `export class SlidingWindowRateLimiter {
  private limit: number;
  private windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  public calculateWeight(elapsed: number): number {
    // FIXED: remaining proportion
    return 1 - (elapsed / this.windowMs);
  }
}
`,
    )

    // Record mutation in journal (as processor does)
    journal.record({
      tool: "edit",
      file: targetFile,
      timestamp: Date.now(),
      messageId: "turn_2_assistant",
    })

    expect(journal.isEmpty()).toBe(false)
    expect(journal.fileCount()).toBe(1)
    expect(journal.entries[0].file).toBe(targetFile)

    // Harness commit is executed
    const commitHash = await harnessCommit(fixtureDir, [targetFile], "edit")
    expect(commitHash).toBeDefined()

    // Decoy file was completely untouched
    const currentDecoyContent = await readFile(decoyFile, "utf-8")
    expect(currentDecoyContent).toBe(originalDecoyContent)

    // Exit gate now allows clean exit as "done"
    const turn2Decision = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 1,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: true,
      isMaxSteps: false,
      tier: "B",
    })

    expect(turn2Decision.action).toBe("break")
    expect(turn2Decision.terminalState).toBe("done")
    expect(turn2Decision.reason).toContain("mutations applied")

    // Wake-up audit is formatted cleanly
    const audit = formatWakeUpAudit({
      terminalState: turn2Decision.terminalState!,
      sessionID: "8b_replay_session",
      reason: turn2Decision.reason,
      rollbackAnchor: commitHash,
      modifiedFiles: journal.entries.map((e) => e.file),
    })
    expect(audit).toContain("Terminal State : done")
    expect(audit).toContain(targetFile)
  })

  test("Gate Test: Stubborn 8B model exhausting empty-exit retries halts with needs-review", () => {
    const journal = createJournal()

    // Retry 0 -> continue
    const r0 = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 0,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
    })
    expect(r0.action).toBe("continue")

    // Retry 1 -> continue
    const r1 = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 1,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
    })
    expect(r1.action).toBe("continue")

    // Retry 2 (exhausted) -> break with needs-review
    const r2 = resolveExitCondition({
      isCodeChangeTask: true,
      journalEmpty: journal.isEmpty(),
      emptyExitRetries: 2,
      maxEmptyExitRetries: 2,
      hasNewRegressions: false,
      repairBudgetExhausted: false,
      hasGreenCommit: false,
      isMaxSteps: false,
    })
    expect(r2.action).toBe("break")
    expect(r2.terminalState).toBe("needs-review")
    expect(r2.reason).toContain("empty exit retries exhausted (2)")
  })
})
