import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as syncFs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { execFileSync } from "node:child_process"
import {
  createAttemptWorktree,
  cleanupWorktree,
  applyWinner,
  runAttempt,
  runMultiAttempt,
  type AttemptResult,
} from "@/session/attempt"
import { selectBestAttempt, formatSummary } from "@/session/attempt-selector"

function initGitRepo(dir: string): void {
  execFileSync("git", ["init"], { cwd: dir, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } })
  execFileSync("git", ["config", "user.name", "Test Agent"], { cwd: dir })
  execFileSync("git", ["config", "user.email", "test@foxcode.ai"], { cwd: dir })
  syncFs.writeFileSync(path.join(dir, "README.md"), "# Test Repo\n", "utf-8")
  syncFs.writeFileSync(
    path.join(dir, "calc.ts"),
    "export function add(a: number, b: number) { return a - b; }\n",
    "utf-8",
  )
  execFileSync("git", ["add", "."], { cwd: dir })
  execFileSync("git", ["commit", "-m", "initial commit"], { cwd: dir })
}

describe("Phase 2E PR 5: Multi-Attempt Architecture", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fox-multi-attempt-test-"))
    initGitRepo(tmpDir)
  })

  afterEach(async () => {
    if (tmpDir && syncFs.existsSync(tmpDir)) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  test("1. createAttemptWorktree creates detached worktree at HEAD and returns path", async () => {
    const worktreePath = await createAttemptWorktree(tmpDir, 0)
    expect(syncFs.existsSync(worktreePath)).toBe(true)

    // Verify it is detached at HEAD
    const headInOrig = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tmpDir, encoding: "utf-8" }).trim()
    const headInWt = execFileSync("git", ["rev-parse", "HEAD"], { cwd: worktreePath, encoding: "utf-8" }).trim()
    expect(headInWt).toBe(headInOrig)

    // Cleanup
    await cleanupWorktree(worktreePath, tmpDir)
  })

  test("2. cleanupWorktree removes worktree and prunes git worktree registry", async () => {
    const worktreePath = await createAttemptWorktree(tmpDir, 1)
    expect(syncFs.existsSync(worktreePath)).toBe(true)

    await cleanupWorktree(worktreePath, tmpDir)
    expect(syncFs.existsSync(worktreePath)).toBe(false)

    const worktreeList = execFileSync("git", ["worktree", "list"], { cwd: tmpDir, encoding: "utf-8" })
    expect(worktreeList).not.toContain(worktreePath)
  })

  test("3. Selector: 3 attempts (empty, green, 1-regression) -> picks green", () => {
    const attempts: AttemptResult[] = [
      {
        index: 0,
        worktreePath: "/tmp/wt0",
        diff: "",
        hasMutations: false,
        newRegressionCount: 0,
        commits: [],
        totalTokens: 1200,
        elapsedMs: 500,
        exitReason: "empty exit retries exhausted",
      },
      {
        index: 1,
        worktreePath: "/tmp/wt1",
        diff: "diff --git a/calc.ts b/calc.ts\n--- a/calc.ts\n+++ b/calc.ts\n@@ -1 +1 @@\n-export function add(a: number, b: number) { return a - b; }\n+export function add(a: number, b: number) { return a + b; }\n",
        hasMutations: true,
        verification: { allPassed: true, executedCount: 1, commandCount: 1, passedCount: 1, failedCount: 0, totalDurationMs: 100 },
        newRegressionCount: 0,
        commits: ["c1"],
        totalTokens: 2500,
        elapsedMs: 1500,
        exitReason: "completed",
      },
      {
        index: 2,
        worktreePath: "/tmp/wt2",
        diff: "diff --git a/calc.ts b/calc.ts\n--- a/calc.ts\n+++ b/calc.ts\n@@ -1 +1 @@\n-export function add(a: number, b: number) { return a - b; }\n+export function add(a: number, b: number) { return a * b; }\n",
        hasMutations: true,
        verification: { allPassed: false, executedCount: 1, commandCount: 1, passedCount: 0, failedCount: 1, totalDurationMs: 100 },
        newRegressionCount: 1,
        commits: [],
        totalTokens: 3000,
        elapsedMs: 2000,
        exitReason: "repair budget exhausted",
      },
    ]

    const selection = selectBestAttempt(attempts)
    expect(selection.winner).toBeDefined()
    expect(selection.winner?.index).toBe(1)
    expect(selection.discarded.length).toBe(2)
    expect(selection.summary).toContain("Winner: Attempt 2")
  })

  test("4. Selector: 3 attempts all empty -> returns failure, no diff applied", () => {
    const attempts: AttemptResult[] = [
      {
        index: 0,
        worktreePath: "/tmp/wt0",
        diff: "",
        hasMutations: false,
        newRegressionCount: 0,
        commits: [],
        totalTokens: 500,
        elapsedMs: 300,
        exitReason: "empty exit retries exhausted",
      },
      {
        index: 1,
        worktreePath: "/tmp/wt1",
        diff: "   \n",
        hasMutations: false,
        newRegressionCount: 0,
        commits: [],
        totalTokens: 600,
        elapsedMs: 400,
        exitReason: "max steps reached",
      },
      {
        index: 2,
        worktreePath: "/tmp/wt2",
        diff: "",
        hasMutations: false,
        newRegressionCount: 0,
        commits: [],
        totalTokens: 550,
        elapsedMs: 350,
        exitReason: "empty exit retries exhausted",
      },
    ]

    const selection = selectBestAttempt(attempts)
    expect(selection.winner).toBeUndefined()
    expect(selection.discarded.length).toBe(3)
    expect(selection.summary).toContain("All 3 attempts failed — no changes applied.")
  })

  test("5. Selector: 3 attempts all have regressions -> picks fewest regressions", () => {
    const attempts: AttemptResult[] = [
      {
        index: 0,
        worktreePath: "/tmp/wt0",
        diff: "diff --git a/a.ts b/a.ts\n",
        hasMutations: true,
        verification: { allPassed: false, executedCount: 1, commandCount: 1, passedCount: 0, failedCount: 1, totalDurationMs: 100 },
        newRegressionCount: 3,
        commits: [],
        totalTokens: 2000,
        elapsedMs: 1000,
        exitReason: "repair budget exhausted",
      },
      {
        index: 1,
        worktreePath: "/tmp/wt1",
        diff: "diff --git a/b.ts b/b.ts\n",
        hasMutations: true,
        verification: { allPassed: false, executedCount: 1, commandCount: 1, passedCount: 0, failedCount: 1, totalDurationMs: 100 },
        newRegressionCount: 1,
        commits: [],
        totalTokens: 1800,
        elapsedMs: 900,
        exitReason: "repair budget exhausted",
      },
      {
        index: 2,
        worktreePath: "/tmp/wt2",
        diff: "diff --git a/c.ts b/c.ts\n",
        hasMutations: true,
        verification: { allPassed: false, executedCount: 1, commandCount: 1, passedCount: 0, failedCount: 1, totalDurationMs: 100 },
        newRegressionCount: 2,
        commits: [],
        totalTokens: 2200,
        elapsedMs: 1100,
        exitReason: "repair budget exhausted",
      },
    ]

    const selection = selectBestAttempt(attempts)
    expect(selection.winner).toBeDefined()
    expect(selection.winner?.index).toBe(1) // fewest regressions (1 < 2 < 3)
  })

  test("6. Selector: tie-break on token count (cheaper wins)", () => {
    const attempts: AttemptResult[] = [
      {
        index: 0,
        worktreePath: "/tmp/wt0",
        diff: "diff --git a/a.ts b/a.ts\n",
        hasMutations: true,
        verification: { allPassed: true, executedCount: 1, commandCount: 1, passedCount: 1, failedCount: 0, totalDurationMs: 100 },
        newRegressionCount: 0,
        commits: ["c1"],
        totalTokens: 3500,
        elapsedMs: 1200,
        exitReason: "completed",
      },
      {
        index: 1,
        worktreePath: "/tmp/wt1",
        diff: "diff --git a/a.ts b/a.ts\n",
        hasMutations: true,
        verification: { allPassed: true, executedCount: 1, commandCount: 1, passedCount: 1, failedCount: 0, totalDurationMs: 100 },
        newRegressionCount: 0,
        commits: ["c2"],
        totalTokens: 1500, // cheaper!
        elapsedMs: 800,
        exitReason: "completed",
      },
    ]

    const selection = selectBestAttempt(attempts)
    expect(selection.winner).toBeDefined()
    expect(selection.winner?.index).toBe(1)
  })

  test("7. Winner application: diff applied cleanly onto HEAD", async () => {
    const diff =
      "diff --git a/calc.ts b/calc.ts\n" +
      "--- a/calc.ts\n" +
      "+++ b/calc.ts\n" +
      "@@ -1 +1 @@\n" +
      "-export function add(a: number, b: number) { return a - b; }\n" +
      "+export function add(a: number, b: number) { return a + b; }\n"

    const winner: AttemptResult = {
      index: 0,
      worktreePath: "/tmp/wt",
      diff,
      hasMutations: true,
      newRegressionCount: 0,
      commits: [],
      totalTokens: 1000,
      elapsedMs: 500,
      exitReason: "completed",
    }

    await applyWinner(tmpDir, winner)

    const updatedContent = syncFs.readFileSync(path.join(tmpDir, "calc.ts"), "utf-8")
    expect(updatedContent).toContain("return a + b;")

    // Staged via git add -A
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: tmpDir, encoding: "utf-8" })
    expect(status).toContain("M  calc.ts")
  })

  test("8. Winner application: empty diff -> error, not applied", async () => {
    const winner: AttemptResult = {
      index: 0,
      worktreePath: "/tmp/wt",
      diff: "   \n",
      hasMutations: false,
      newRegressionCount: 0,
      commits: [],
      totalTokens: 1000,
      elapsedMs: 500,
      exitReason: "no mutations",
    }

    expect(applyWinner(tmpDir, winner)).rejects.toThrow("Winner has empty diff — should have been filtered")
  })

  test("9. Per-attempt timeout: stuck attempt killed, remaining continue", async () => {
    const result = await runAttempt({
      projectDir: tmpDir,
      worktreePath: tmpDir,
      index: 0,
      task: "test timeout",
      timeoutMs: 80,
      execute: async (_wt: string, signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({ hasMutations: true })
          }, 5000)
          signal.addEventListener("abort", () => {
            clearTimeout(timer)
            const err = new Error("aborted")
            err.name = "AbortError"
            reject(err)
          })
        })
      },
    })

    expect(result.exitReason).toBe("attempt timeout exceeded")
  })

  test("10. Empty-diff filtering: attempt with zero mutations -> discarded before selection", () => {
    const att: AttemptResult = {
      index: 0,
      worktreePath: "/tmp/wt0",
      diff: "",
      hasMutations: false,
      newRegressionCount: 0,
      commits: [],
      totalTokens: 100,
      elapsedMs: 50,
      exitReason: "empty",
    }

    const selection = selectBestAttempt([att])
    expect(selection.winner).toBeUndefined()
    expect(selection.discarded.length).toBe(1)
    expect(selection.discarded[0].reason).toContain("Empty")
  })

  test("12. Integration: runMultiAttempt produces result, cleans up worktrees, and applies winner", async () => {
    const multiResult = await runMultiAttempt({
      projectDir: tmpDir,
      attempts: 3,
      task: "Fix add function",
      execute: async (worktreeDir: string, _signal: AbortSignal) => {
        // Find attempt index from worktreeDir name
        const match = worktreeDir.match(/-(\d+)$/)
        const idx = match ? parseInt(match[1], 10) : 0

        if (idx === 0) {
          // Attempt 0: Empty
          return { hasMutations: false, exitReason: "empty exit" }
        } else if (idx === 1) {
          // Attempt 1: Correct fix
          const calcFile = path.join(worktreeDir, "calc.ts")
          syncFs.writeFileSync(calcFile, "export function add(a: number, b: number) { return a + b; }\n", "utf-8")
          execFileSync("git", ["add", "."], { cwd: worktreeDir })
          execFileSync("git", ["commit", "-m", "fix: correct addition"], { cwd: worktreeDir })
          return {
            hasMutations: true,
            commits: ["fix1"],
            totalTokens: 1500,
            hasGreenCommit: true,
            newRegressionCount: 0,
            exitReason: "completed",
          }
        } else {
          // Attempt 2: Buggy fix with regression
          const calcFile = path.join(worktreeDir, "calc.ts")
          syncFs.writeFileSync(calcFile, "export function add(a: number, b: number) { return a * b; }\n", "utf-8")
          return {
            hasMutations: true,
            totalTokens: 2500,
            newRegressionCount: 1,
            exitReason: "repair budget exhausted",
          }
        }
      },
    })

    expect(multiResult.applied).toBe(true)
    expect(multiResult.winner).toBeDefined()
    expect(multiResult.winner?.index).toBe(1)

    // Applied onto original HEAD
    const appliedContent = syncFs.readFileSync(path.join(tmpDir, "calc.ts"), "utf-8")
    expect(appliedContent).toContain("return a + b;")

    // Verify all worktrees cleaned up
    const worktreeList = execFileSync("git", ["worktree", "list"], { cwd: tmpDir, encoding: "utf-8" })
    for (const att of multiResult.attempts) {
      expect(syncFs.existsSync(att.worktreePath)).toBe(false)
      expect(worktreeList).not.toContain(att.worktreePath)
    }
  })
})
