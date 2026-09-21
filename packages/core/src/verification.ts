/**
 * Auto-Verification Runner — detects project test commands and formats
 * compressed verification feedback for the Autonomous Verification Layer.
 *
 * This module provides:
 * 1. Auto-detection of test/typecheck/lint commands from package.json
 * 2. Verification result formatting with LLTC-compressed output
 *
 * The actual command execution is done by the session processor using the
 * existing bash tool infrastructure. This module handles detection and
 * formatting only.
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
export const MUTATION_TOOLS = new Set(["edit", "apply_patch", "write"])

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
