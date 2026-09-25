import * as fs from "node:fs/promises"
import * as syncFs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { execFileSync, spawn } from "node:child_process"
import { Process } from "@/util/process"
import { Verification } from "@opencode-ai/core/verification"
import { VerificationBaseline } from "@opencode-ai/core/verification-baseline"
import {
  type AttemptResult,
  type AttemptSelection,
  selectBestAttempt,
} from "./attempt-selector"

export type { AttemptResult, AttemptSelection }

// Registry of active worktrees for process cleanup safety
const pendingWorktrees = new Map<string, string>() // worktreePath -> projectDir
let handlersRegistered = false

function trackWorktree(worktreePath: string, projectDir: string): void {
  pendingWorktrees.set(worktreePath, projectDir)
  ensureCleanupHandlers()
}

function untrackWorktree(worktreePath: string): void {
  pendingWorktrees.delete(worktreePath)
}

function ensureCleanupHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  const cleanupSync = () => {
    for (const [wt, projectDir] of pendingWorktrees.entries()) {
      try {
        syncFs.rmSync(wt, { recursive: true, force: true })
      } catch {}
      try {
        execFileSync("git", ["worktree", "prune"], {
          cwd: projectDir,
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
          stdio: "ignore",
        })
      } catch {}
    }
    pendingWorktrees.clear()
  }

  process.on("exit", cleanupSync)
  process.on("SIGINT", () => {
    cleanupSync()
    process.exit(1)
  })
  process.on("SIGTERM", () => {
    cleanupSync()
    process.exit(1)
  })
}

async function execGit(
  args: string[],
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const res = await Process.run(["git", ...args], {
    cwd,
    nothrow: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })
  return {
    exitCode: res.code,
    stdout: res.stdout.toString("utf-8"),
    stderr: res.stderr.toString("utf-8"),
  }
}

async function execGitWithStdin(
  args: string[],
  cwd: string,
  input: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => {
      stdout += d.toString("utf-8")
    })
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf-8")
    })
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })
    child.on("error", (err) => {
      resolve({ exitCode: 1, stdout, stderr: err.message })
    })
    child.stdin.write(input)
    child.stdin.end()
  })
}

/**
 * Creates an isolated git worktree detached at HEAD.
 */
export async function createAttemptWorktree(projectDir: string, attemptIndex: number): Promise<string> {
  const worktreePath = path.join(
    os.tmpdir(),
    `fox-attempt-${process.pid}-${Date.now()}-${attemptIndex}`,
  )
  const res = await execGit(["worktree", "add", "--detach", worktreePath, "HEAD"], projectDir)
  if (res.exitCode !== 0) {
    throw new Error(
      `Failed to create attempt worktree at ${worktreePath}: ${res.stderr || res.stdout}`,
    )
  }
  trackWorktree(worktreePath, projectDir)
  return worktreePath
}

/**
 * Cleans up a git worktree directory and prunes git worktree registry.
 */
export async function cleanupWorktree(worktreePath: string, projectDir: string): Promise<void> {
  untrackWorktree(worktreePath)
  try {
    await fs.rm(worktreePath, { recursive: true, force: true })
  } catch {}
  try {
    await execGit(["worktree", "prune"], projectDir)
  } catch {}
}

export interface AttemptExecuteResult {
  commits?: string[]
  totalTokens?: number
  exitReason?: string
  hasMutations?: boolean
  verification?: Verification.PipelineResult
  regressionAnalysis?: VerificationBaseline.RegressionAnalysis
  newRegressionCount?: number
  hasGreenCommit?: boolean
}

export interface AttemptOptions {
  projectDir: string
  worktreePath: string
  index: number
  task: string
  model?: string
  timeoutMs?: number // default 300_000 (5 minutes)
  execute?: (worktreeDir: string, signal: AbortSignal) => Promise<AttemptExecuteResult>
}

/**
 * Executes a single attempt within its isolated worktree.
 */
export async function runAttempt(options: AttemptOptions): Promise<AttemptResult> {
  const { worktreePath, index, timeoutMs = 300_000, execute } = options
  const startTime = Date.now()

  const initialHeadRes = await execGit(["rev-parse", "HEAD"], worktreePath)
  const initialCommit = initialHeadRes.stdout.trim()

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  let executeResult: AttemptExecuteResult = {}
  let timedOut = false

  try {
    if (execute) {
      executeResult = await execute(worktreePath, controller.signal)
    } else {
      // Default execution fallback
      executeResult = {
        hasMutations: false,
        exitReason: "No executor provided",
      }
    }
  } catch (err: any) {
    if (controller.signal.aborted || err?.name === "AbortError" || err?.message?.includes("aborted")) {
      timedOut = true
      executeResult.exitReason = "attempt timeout exceeded"
    } else {
      executeResult.exitReason = err instanceof Error ? err.message : String(err)
    }
  } finally {
    clearTimeout(timer)
  }

  const elapsedMs = Date.now() - startTime

  // Extract git diff from initialCommit to current working tree
  const diffRes = await execGit(["diff", initialCommit], worktreePath)
  const diff = diffRes.exitCode === 0 ? diffRes.stdout : ""

  // Extract commits made in worktree
  const logRes = await execGit(["rev-list", `${initialCommit}..HEAD`], worktreePath)
  const logCommits =
    logRes.exitCode === 0 && logRes.stdout.trim()
      ? logRes.stdout.trim().split("\n").filter(Boolean)
      : []
  const commits = executeResult.commits ?? logCommits

  const hasMutations =
    executeResult.hasMutations ?? (diff.trim().length > 0 || commits.length > 0)

  let verification = executeResult.verification
  let regressionAnalysis = executeResult.regressionAnalysis
  let newRegressionCount = executeResult.newRegressionCount ?? 0

  if (!verification && hasMutations) {
    try {
      const scripts = await Verification.readPackageScripts(worktreePath)
      const pipeline = Verification.detectCommandPipeline(scripts)
      if (pipeline.commands.length > 0) {
        verification = await Verification.executePipeline(pipeline, {
          cwd: worktreePath,
          timeoutMs: 60_000,
        })
        newRegressionCount = verification.allPassed ? 0 : 1
      }
    } catch {}
  }

  const exitReason = timedOut
    ? "attempt timeout exceeded"
    : (executeResult.exitReason || (hasMutations ? "completed" : "no mutations applied"))

  return {
    index,
    worktreePath,
    diff,
    hasMutations,
    verification,
    regressionAnalysis,
    newRegressionCount,
    commits,
    totalTokens: executeResult.totalTokens ?? 0,
    elapsedMs,
    exitReason,
    hasGreenCommit: executeResult.hasGreenCommit,
  }
}

/**
 * Applies the winner's diff as a patch onto the original HEAD.
 */
export async function applyWinner(projectDir: string, winner: AttemptResult): Promise<void> {
  const diffContent = winner.diff
  if (!diffContent || !diffContent.trim()) {
    throw new Error("Winner has empty diff — should have been filtered")
  }

  // Apply via git apply (3-way fallback to direct)
  const applyRes = await execGitWithStdin(["apply", "--3way", "-"], projectDir, diffContent)
  if (applyRes.exitCode !== 0) {
    const fallbackRes = await execGitWithStdin(["apply", "-"], projectDir, diffContent)
    if (fallbackRes.exitCode !== 0) {
      throw new Error(`Failed to apply winner diff: ${fallbackRes.stderr || applyRes.stderr}`)
    }
  }

  // Stage all changes
  await execGit(["add", "-A"], projectDir)
}

export interface MultiAttemptOptions {
  projectDir: string
  attempts: number
  attemptTimeoutMs?: number
  task: string
  model?: string
  execute?: (worktreeDir: string, signal: AbortSignal) => Promise<AttemptExecuteResult>
  onAttemptStart?: (index: number, total: number) => void
  onAttemptComplete?: (result: AttemptResult) => void
}

export interface MultiAttemptRunResult {
  winner?: AttemptResult
  attempts: AttemptResult[]
  selection: AttemptSelection
  applied: boolean
}

/**
 * Orchestrates multiple isolated sequential attempts across worktrees, selects the best,
 * applies it onto the original HEAD, and cleans up all worktrees.
 */
export async function runMultiAttempt(options: MultiAttemptOptions): Promise<MultiAttemptRunResult> {
  const { projectDir, attempts, attemptTimeoutMs = 300_000, task, model, execute } = options
  const results: AttemptResult[] = []

  const headRes = await execGit(["rev-parse", "HEAD"], projectDir)
  if (headRes.exitCode !== 0) {
    throw new Error(`Failed to resolve HEAD in ${projectDir}: ${headRes.stderr}`)
  }

  const createdWorktrees: string[] = []

  try {
    for (let i = 0; i < attempts; i++) {
      options.onAttemptStart?.(i, attempts)
      const worktreePath = await createAttemptWorktree(projectDir, i)
      createdWorktrees.push(worktreePath)

      try {
        const result = await runAttempt({
          projectDir,
          worktreePath,
          index: i,
          task,
          model,
          timeoutMs: attemptTimeoutMs,
          execute,
        })
        results.push(result)
        options.onAttemptComplete?.(result)
      } catch (err) {
        const errorResult: AttemptResult = {
          index: i,
          worktreePath,
          diff: "",
          hasMutations: false,
          newRegressionCount: 0,
          commits: [],
          totalTokens: 0,
          elapsedMs: 0,
          exitReason: err instanceof Error ? err.message : String(err),
        }
        results.push(errorResult)
        options.onAttemptComplete?.(errorResult)
      }
    }
  } finally {
    for (const wt of createdWorktrees) {
      await cleanupWorktree(wt, projectDir)
    }
  }

  const selection = selectBestAttempt(results)

  let applied = false
  if (selection.winner && selection.winner.diff.trim()) {
    await applyWinner(projectDir, selection.winner)
    applied = true
  }

  return {
    winner: selection.winner,
    attempts: results,
    selection,
    applied,
  }
}
