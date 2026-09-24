/**
 * Verification Baseline Tracker
 *
 * Captures a snapshot of test/typecheck/lint results at session start
 * (before any mutations) and compares subsequent verification runs
 * against this baseline to distinguish new regressions from
 * pre-existing failures.
 */

import { createHash } from "crypto"
import type { PipelineResult, VerificationResult } from "./verification"

export * as VerificationBaseline from "./verification-baseline"

export interface BaselineCommandResult {
  /** The command that was executed (e.g., "npm run test") */
  readonly command: string
  /** Whether the command passed */
  readonly passed: boolean
  /** Exit code */
  readonly exitCode: number
  /** Compressed output fingerprint (hash of failure output for comparison) */
  readonly failureHash: string | undefined
}

export interface BaselineSnapshot {
  /** When the baseline was captured */
  readonly capturedAt: number
  /** Per-command results at baseline time */
  readonly results: ReadonlyArray<BaselineCommandResult>
  /** Whether the project was fully clean at baseline */
  readonly allPassed: boolean
}

export interface RegressionDetail {
  /** The command that regressed */
  readonly command: string
  /** Exit code at baseline (0 = was passing) */
  readonly baselineExitCode: number
  /** Current exit code */
  readonly currentExitCode: number
}

export interface PreExistingDetail {
  /** The command that was already failing */
  readonly command: string
  /** Whether the failure output is identical to baseline */
  readonly sameFailure: boolean
}

export interface RegressionAnalysis {
  /** Commands that were passing at baseline but now fail (agent broke them) */
  readonly newRegressions: ReadonlyArray<RegressionDetail>
  /** Commands that were already failing at baseline and still fail (not agent's fault) */
  readonly preExisting: ReadonlyArray<PreExistingDetail>
  /** Commands that were failing at baseline but now pass (agent fixed them) */
  readonly newFixes: ReadonlyArray<string>
  /** Whether the agent caused any new regressions */
  readonly hasNewRegressions: boolean
  /** Human-readable summary */
  readonly summary: string
}

/**
 * Generate a deterministic short hash of failure output for comparison.
 */
export function hashFailureOutput(output: string): string {
  return createHash("sha256").update(output).digest("hex").slice(0, 16)
}

/**
 * Capture a baseline snapshot from a pipeline result.
 * Called once at session start, before any mutations.
 */
export function captureBaseline(pipelineResult: PipelineResult): BaselineSnapshot {
  const results: BaselineCommandResult[] = pipelineResult.results.map((res) => ({
    command: res.command,
    passed: res.passed,
    exitCode: res.exitCode,
    failureHash: res.passed ? undefined : hashFailureOutput(res.compressedOutput),
  }))

  return {
    capturedAt: Date.now(),
    results,
    allPassed: pipelineResult.allPassed,
  }
}

/**
 * Compare a verification run against the baseline to classify regressions.
 */
export function analyzeRegressions(
  baseline: BaselineSnapshot,
  current: PipelineResult,
): RegressionAnalysis {
  const newRegressions: RegressionDetail[] = []
  const preExisting: PreExistingDetail[] = []
  const newFixes: string[] = []

  const baselineMap = new Map<string, BaselineCommandResult>()
  for (const b of baseline.results) {
    baselineMap.set(b.command, b)
  }

  for (const res of current.results) {
    const base = baselineMap.get(res.command)
    const curHash = res.passed ? undefined : hashFailureOutput(res.compressedOutput)

    if (!base) {
      // Command was not in baseline
      if (!res.passed) {
        newRegressions.push({
          command: res.command,
          baselineExitCode: 0,
          currentExitCode: res.exitCode,
        })
      }
      continue
    }

    if (base.passed && !res.passed) {
      // Regressed: was passing, now failing
      newRegressions.push({
        command: res.command,
        baselineExitCode: base.exitCode,
        currentExitCode: res.exitCode,
      })
    } else if (!base.passed && !res.passed) {
      // Pre-existing: was failing, still failing
      const sameFailure = base.failureHash !== undefined && base.failureHash === curHash
      preExisting.push({
        command: res.command,
        sameFailure,
      })
    } else if (!base.passed && res.passed) {
      // Fixed: was failing, now passing
      newFixes.push(res.command)
    }
  }

  const parts: string[] = [
    `${newRegressions.length} new regression${newRegressions.length === 1 ? "" : "s"}`,
    `${preExisting.length} pre-existing failure${preExisting.length === 1 ? "" : "s"}`,
    `${newFixes.length} fix${newFixes.length === 1 ? "" : "es"}`,
  ]

  return {
    newRegressions,
    preExisting,
    newFixes,
    hasNewRegressions: newRegressions.length > 0,
    summary: parts.join(", "),
  }
}

/**
 * Format regression analysis as model-facing feedback.
 */
export function formatRegressionFeedback(analysis: RegressionAnalysis): string {
  const hasItems =
    analysis.newRegressions.length > 0 ||
    analysis.preExisting.length > 0 ||
    analysis.newFixes.length > 0

  if (!hasItems) return ""

  const lines: string[] = ["─── Regression Analysis ───"]

  if (analysis.newRegressions.length > 0) {
    lines.push("🆕 NEW REGRESSIONS (agent-introduced):")
    for (const reg of analysis.newRegressions) {
      lines.push(`  [❌ NEW] ${reg.command} (was ✅ passing, now exit ${reg.currentExitCode})`)
    }
    lines.push("")
  }

  if (analysis.preExisting.length > 0) {
    lines.push("📋 PRE-EXISTING (not caused by this edit):")
    for (const pre of analysis.preExisting) {
      const detail = pre.sameFailure ? "same output" : "different output"
      lines.push(`  [⚠️ PRE] ${pre.command} (was ❌ failing, still ❌ failing, ${detail})`)
    }
    lines.push("")
  }

  if (analysis.newFixes.length > 0) {
    lines.push("✅ FIXED BY THIS EDIT:")
    for (const fix of analysis.newFixes) {
      lines.push(`  [🔧 FIX] ${fix} (was ❌ failing, now ✅ passing)`)
    }
    lines.push("")
  }

  lines.push(`Summary: ${analysis.summary}`)
  lines.push("─── End Regression Analysis ───")

  return lines.join("\n")
}
