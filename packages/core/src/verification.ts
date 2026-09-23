/**
 * Auto-Verification Runner — detects project test commands, executes them,
 * and formats compressed verification feedback for the Autonomous Verification
 * Layer.
 *
 * This module provides:
 * 1. Auto-detection of test/typecheck/lint commands from package.json
 * 2. Safe reading of package.json scripts via `readPackageScripts`
 * 3. Child process execution with timeout enforcement via `executeVerification`
 * 4. LLTC-compressed output formatting via `formatVerificationFeedback`
 */
export * as Verification from "./verification"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A detected verification command with its source. */
export interface VerificationCommand {
  /** The shell command to execute. */
  readonly command: string
  /** Where this command was detected from (e.g., "package.json scripts.test"). */
  readonly source: string
  /** Priority: lower = higher priority. */
  readonly priority: number
}

/** Result of a verification run. */
export interface VerificationResult {
  /** Whether all verification checks passed. */
  readonly passed: boolean
  /** Process exit code. */
  readonly exitCode: number
  /** The command that was executed. */
  readonly command: string
  /** Compressed output (after LLTC pipeline). */
  readonly compressedOutput: string
  /** Whether output was truncated due to size limits. */
  readonly truncated: boolean
  /** Execution time in milliseconds. */
  readonly elapsedMs: number
}

/** A verification execution pipeline configuration. */
export interface VerificationPipeline {
  /** Ordered list of verification commands to run. */
  readonly commands: VerificationCommand[]
  /** Strategy: 'sequential' stops on first failure, 'all' runs everything. */
  readonly strategy: "sequential" | "all"
}

/** Aggregated result of running a verification pipeline. */
export interface PipelineResult {
  /** Individual verification results in execution order. */
  readonly results: VerificationResult[]
  /** True if all executed commands passed. */
  readonly allPassed: boolean
  /** First failed verification result, if any. */
  readonly firstFailure: VerificationResult | undefined
  /** Total elapsed time across all executed commands in milliseconds. */
  readonly totalElapsedMs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum bytes of verification output to retain after compression. */
export const MAX_VERIFICATION_OUTPUT_BYTES = 4096

/** Default timeout for verification commands in milliseconds. */
export const DEFAULT_VERIFICATION_TIMEOUT_MS = 30_000

/**
 * The mutation tool names that trigger auto-verification.
 * Read-only tools (read, grep, glob) and shell (bash) do NOT trigger.
 */
export const MUTATION_TOOLS = new Set(["edit", "apply_patch", "write", "commit"])

// ---------------------------------------------------------------------------
// Test Command Detection
// ---------------------------------------------------------------------------

/** Known test-related script names in priority order. */
const TEST_SCRIPT_PRIORITIES: readonly [string, number][] = [
  ["test", 1],
  ["test:check", 2],
  ["typecheck", 3],
  ["check", 4],
  ["test:unit", 5],
  ["test:smoke", 6],
  ["lint", 7],
]

/**
 * Parse a package.json `scripts` object and return detected verification
 * commands in priority order.
 *
 * @param scripts The `scripts` field from package.json.
 * @returns Array of VerificationCommand in priority order (lowest first).
 */
export function detectTestCommands(
  scripts: Record<string, string> | undefined | null,
): VerificationCommand[] {
  if (!scripts || typeof scripts !== "object") return []

  const found: VerificationCommand[] = []

  for (const [name, priority] of TEST_SCRIPT_PRIORITIES) {
    const command = scripts[name]
    if (typeof command === "string" && command.trim().length > 0) {
      found.push({
        command: `npm run ${name}`,
        source: `package.json scripts.${name}`,
        priority,
      })
    }
  }

  return found.sort((a, b) => a.priority - b.priority)
}

/**
 * Detect the best verification command for a project.
 * Returns the highest-priority detected command, or undefined if none found.
 *
 * @param scripts The `scripts` field from package.json.
 * @param override Optional user-configured override command.
 * @returns The best verification command, or undefined.
 */
export function detectBestCommand(
  scripts: Record<string, string> | undefined | null,
  override?: string | null,
): VerificationCommand | undefined {
  // User override takes absolute priority
  if (override && typeof override === "string" && override.trim().length > 0) {
    return {
      command: override.trim(),
      source: "fox.jsonc autonomous.test_command",
      priority: 0,
    }
  }

  const commands = detectTestCommands(scripts)
  return commands[0]
}

/**
 * Detect all verification commands and return them as an ordered pipeline.
 * The pipeline runs commands in priority order (typecheck before tests before lint).
 *
 * @param scripts - package.json scripts object
 * @param overrides - User-configured command overrides from fox.jsonc
 * @returns Pipeline of commands to execute in order
 */
export function detectCommandPipeline(
  scripts: Record<string, string> | undefined | null,
  overrides?: {
    test_command?: string | null
    typecheck_command?: string | null
    lint_command?: string | null
    verification_strategy?: "sequential" | "all" | null
  },
): VerificationPipeline {
  const commands: VerificationCommand[] = []

  // 1. Typecheck (fastest static checks: typecheck -> check)
  if (
    overrides?.typecheck_command &&
    typeof overrides.typecheck_command === "string" &&
    overrides.typecheck_command.trim().length > 0
  ) {
    commands.push({
      command: overrides.typecheck_command.trim(),
      source: "fox.jsonc autonomous.typecheck_command",
      priority: 0,
    })
  } else if (scripts && typeof scripts === "object") {
    if (typeof scripts.typecheck === "string" && scripts.typecheck.trim().length > 0) {
      commands.push({
        command: "npm run typecheck",
        source: "package.json scripts.typecheck",
        priority: 1,
      })
    } else if (typeof scripts.check === "string" && scripts.check.trim().length > 0) {
      commands.push({
        command: "npm run check",
        source: "package.json scripts.check",
        priority: 1,
      })
    }
  }

  // 2. Tests (unit / integration tests: test -> test:check -> test:unit -> test:smoke)
  if (
    overrides?.test_command &&
    typeof overrides.test_command === "string" &&
    overrides.test_command.trim().length > 0
  ) {
    commands.push({
      command: overrides.test_command.trim(),
      source: "fox.jsonc autonomous.test_command",
      priority: 0,
    })
  } else if (scripts && typeof scripts === "object") {
    const testNames = ["test", "test:check", "test:unit", "test:smoke"] as const
    for (const name of testNames) {
      const cmd = scripts[name]
      if (typeof cmd === "string" && cmd.trim().length > 0) {
        commands.push({
          command: `npm run ${name}`,
          source: `package.json scripts.${name}`,
          priority: 2,
        })
        break
      }
    }
  }

  // 3. Lint (style / static analysis: lint)
  if (
    overrides?.lint_command &&
    typeof overrides.lint_command === "string" &&
    overrides.lint_command.trim().length > 0
  ) {
    commands.push({
      command: overrides.lint_command.trim(),
      source: "fox.jsonc autonomous.lint_command",
      priority: 0,
    })
  } else if (scripts && typeof scripts === "object") {
    if (typeof scripts.lint === "string" && scripts.lint.trim().length > 0) {
      commands.push({
        command: "npm run lint",
        source: "package.json scripts.lint",
        priority: 3,
      })
    }
  }

  const strategy = overrides?.verification_strategy === "all" ? "all" : "sequential"

  return {
    commands,
    strategy,
  }
}

// ---------------------------------------------------------------------------
// Result Formatting
// ---------------------------------------------------------------------------

/**
 * Format a verification result as a model-facing feedback block.
 * The output is designed to be appended to the mutation tool's output
 * so the agent sees it on the same turn.
 */
export function formatVerificationFeedback(result: VerificationResult): string {
  const status = result.passed ? "✅ PASSED" : "❌ FAILED"
  const truncNote = result.truncated ? " [output truncated]" : ""
  const elapsed = `${(result.elapsedMs / 1000).toFixed(1)}s`

  const lines = [
    ``,
    `─── Auto-Verification ${status} ───`,
    `Command: ${result.command}`,
    `Exit code: ${result.exitCode} | Elapsed: ${elapsed}${truncNote}`,
  ]

  if (!result.passed && result.compressedOutput.trim().length > 0) {
    lines.push(``, `Compressed failure output:`, result.compressedOutput)
  } else if (result.passed) {
    lines.push(``, `All checks passed.`)
  }

  lines.push(`─── End Auto-Verification ───`)

  return lines.join("\n")
}

/**
 * Format pipeline results as a model-facing feedback block.
 * Shows status summary for all executed checks, but only includes
 * compressed failure output for commands that failed.
 *
 * @param pipelineResult Aggregated pipeline execution result.
 * @returns Formatted feedback string.
 */
export function formatPipelineFeedback(pipelineResult: PipelineResult): string {
  const status = pipelineResult.allPassed ? "✅ PASSED" : "❌ FAILED"
  const count = pipelineResult.results.length
  const totalElapsed = `${(pipelineResult.totalElapsedMs / 1000).toFixed(1)}s`

  const lines = [
    ``,
    `─── Auto-Verification Pipeline ${status} ───`,
    `Pipeline: ${count} ${count === 1 ? "check" : "checks"} executed | Total elapsed: ${totalElapsed}`,
  ]

  for (const r of pipelineResult.results) {
    const itemStatus = r.passed ? "✅ PASS" : "❌ FAIL"
    const truncNote = r.truncated ? " [output truncated]" : ""
    const elapsed = `${(r.elapsedMs / 1000).toFixed(1)}s`
    lines.push(`  [${itemStatus}] ${r.command} (exit ${r.exitCode}, ${elapsed})${truncNote}`)
  }

  const failures = pipelineResult.results.filter((r) => !r.passed)
  if (failures.length > 0) {
    for (const fail of failures) {
      lines.push(``, `Failure details for "${fail.command}":`)
      if (fail.compressedOutput.trim().length > 0) {
        lines.push(fail.compressedOutput)
      } else {
        lines.push(`(Command exited with code ${fail.exitCode} with no output)`)
      }
    }
  } else if (pipelineResult.allPassed && count > 0) {
    lines.push(``, `All pipeline checks passed.`)
  }

  lines.push(`─── End Auto-Verification Pipeline ───`)

  return lines.join("\n")
}

/**
 * Truncate verification output to the byte limit, preserving the end
 * (which typically contains the most useful error summary).
 *
 * @param output Raw output string.
 * @param maxBytes Maximum bytes to retain (default: MAX_VERIFICATION_OUTPUT_BYTES).
 * @returns Object with truncated output and whether truncation occurred.
 */
export function truncateOutput(
  output: string,
  maxBytes = MAX_VERIFICATION_OUTPUT_BYTES,
): { output: string; truncated: boolean } {
  const bytes = Buffer.byteLength(output, "utf8")
  if (bytes <= maxBytes) {
    return { output, truncated: false }
  }

  // Keep the tail (most useful for error summaries)
  // Binary search for the right character offset
  let lo = 0
  let hi = output.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (Buffer.byteLength(output.slice(mid), "utf8") > maxBytes) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const truncated = output.slice(lo)
  const header = `[...${bytes - Buffer.byteLength(truncated, "utf8")} bytes truncated...]\n`
  return { output: header + truncated, truncated: true }
}

// ---------------------------------------------------------------------------
// Package Scripts Reader
// ---------------------------------------------------------------------------

/**
 * Safely read the `scripts` field from a project's `package.json`.
 *
 * Returns `undefined` when the file is missing, unreadable, or invalid JSON.
 * Never throws — all I/O errors are swallowed and logged to the console
 * at debug level.
 *
 * @param dir Absolute path to the project root (directory containing package.json).
 * @returns The `scripts` object from package.json, or undefined.
 */
export async function readPackageScripts(
  dir: string,
): Promise<Record<string, string> | undefined> {
  const { readFile } = await import("fs/promises")
  const { join } = await import("path")
  try {
    const raw = await readFile(join(dir, "package.json"), "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && parsed.scripts && typeof parsed.scripts === "object") {
      return parsed.scripts as Record<string, string>
    }
    return undefined
  } catch {
    // Missing file, permission denied, invalid JSON — all non-fatal
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Verification Execution
// ---------------------------------------------------------------------------

/** Options for executeVerification. */
export interface VerificationExecutionOptions {
  /** Working directory for the command. */
  readonly cwd: string
  /** Timeout in milliseconds. Defaults to DEFAULT_VERIFICATION_TIMEOUT_MS. */
  readonly timeoutMs?: number
  /** Additional environment variables to merge into the child process env. */
  readonly env?: Record<string, string | undefined>
}

/**
 * Execute a verification command as a child process and return a
 * structured `VerificationResult`.
 *
 * This function:
 * 1. Spawns the command with `shell: true` and `detached: true` (non-win32)
 *    so the entire process group can be killed on timeout.
 * 2. Injects `CI=true`, `GIT_TERMINAL_PROMPT=0`, `PAGER=cat` into the
 *    child environment to prevent interactive prompts.
 * 3. Enforces `timeoutMs` (default 30 s) using `killTree` from `./shell`.
 * 4. Compresses output through `filterTestOutput` (LLTC pipeline).
 * 5. Truncates to `MAX_VERIFICATION_OUTPUT_BYTES` keeping the tail.
 *
 * @param command The shell command to execute (e.g. `npm run test`).
 * @param options Execution options (cwd, timeout, env).
 * @returns A VerificationResult with compressed, truncated output.
 */
export async function executeVerification(
  command: string,
  options: VerificationExecutionOptions,
): Promise<VerificationResult> {
  const { spawn } = await import("child_process")
  const { killTree } = await import("./shell")
  const { filterTestOutput } = await import("./tool/compress")

  const timeoutMs = options.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS
  const isWin = process.platform === "win32"

  const env: Record<string, string | undefined> = {
    ...process.env,
    CI: "true",
    GIT_TERMINAL_PROMPT: "0",
    PAGER: "cat",
    ...options.env,
  }

  const child = spawn(command, [], {
    cwd: options.cwd,
    shell: true,
    detached: !isWin,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  })

  const startTime = performance.now()

  // Collect combined stdout + stderr
  const chunks: Buffer[] = []
  child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk))
  child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk))

  let timedOut = false
  let exited = false

  const result = await new Promise<{ exitCode: number }>((resolve) => {
    let resolved = false
    const settle = (exitCode: number) => {
      if (resolved) return
      resolved = true
      resolve({ exitCode })
    }

    // Timeout handler
    const timer = setTimeout(async () => {
      if (exited) return
      timedOut = true
      await killTree(child, { exited: () => exited })
      settle(124) // 124 = GNU timeout convention
    }, timeoutMs)

    child.on("exit", (code) => {
      exited = true
      clearTimeout(timer)
      // If killTree triggered this exit, report as timeout (124)
      settle(timedOut ? 124 : (code ?? 1))
    })

    child.on("error", () => {
      exited = true
      clearTimeout(timer)
      settle(127) // 127 = command not found convention
    })
  })

  const elapsedMs = Math.round(performance.now() - startTime)
  let rawOutput = Buffer.concat(chunks).toString("utf8")

  if (timedOut) {
    rawOutput += `\n\n[Verification timed out after ${(timeoutMs / 1000).toFixed(0)}s]`
  }

  // LLTC compression: collapse consecutive passing test lines
  const compressed = filterTestOutput(rawOutput)

  // Byte-limit truncation: keep the tail (error summaries)
  const { output: finalOutput, truncated } = truncateOutput(compressed)

  return {
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    command,
    compressedOutput: finalOutput,
    truncated,
    elapsedMs,
  }
}

/**
 * Execute a verification pipeline. Runs commands in order.
 * With "sequential" strategy, stops at first failure.
 * With "all" strategy, runs all commands regardless.
 *
 * @param pipeline The verification pipeline to execute.
 * @param options Execution options (cwd, timeout, env).
 * @returns Aggregated PipelineResult.
 */
export async function executePipeline(
  pipeline: VerificationPipeline,
  options: VerificationExecutionOptions,
): Promise<PipelineResult> {
  const results: VerificationResult[] = []
  const startTime = performance.now()

  for (const cmd of pipeline.commands) {
    const res = await executeVerification(cmd.command, options)
    results.push(res)
    if (!res.passed && pipeline.strategy === "sequential") {
      break
    }
  }

  const totalElapsedMs = Math.round(performance.now() - startTime)
  const firstFailure = results.find((r) => !r.passed)
  const allPassed = results.length > 0 ? results.every((r) => r.passed) : true

  return {
    results,
    allPassed,
    firstFailure,
    totalElapsedMs,
  }
}
