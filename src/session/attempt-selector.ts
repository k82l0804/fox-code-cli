import type { Verification } from "@opencode-ai/core/verification"
import type { VerificationBaseline } from "@opencode-ai/core/verification-baseline"

export interface AttemptResult {
  index: number
  worktreePath: string
  /** git diff from original HEAD to final state */
  diff: string
  /** Whether the attempt produced any mutations */
  hasMutations: boolean
  /** Verification pipeline result (if run) */
  verification?: Verification.PipelineResult
  /** Regression analysis against baseline */
  regressionAnalysis?: VerificationBaseline.RegressionAnalysis
  /** Number of new regressions introduced */
  newRegressionCount: number
  /** Harness commits in this attempt */
  commits: string[]
  /** Total tokens consumed */
  totalTokens: number
  /** Elapsed time in ms */
  elapsedMs: number
  /** Exit reason from control plane */
  exitReason: string
  /** Whether this attempt reached a green commit at any point */
  hasGreenCommit?: boolean
}

export interface AttemptSelection {
  winner?: AttemptResult
  discarded: Array<{ attempt: AttemptResult; reason: string }>
  ranked: AttemptResult[]
  summary: string
}

/**
 * Deterministic Filter -> Rank selection algorithm for multi-attempt executions.
 *
 * 1. Filter out empty: hasMutations === false or empty diff -> discard.
 * 2. Filter out worse-than-baseline: newRegressionCount > 0 AND no green commit -> discard,
 *    unless ALL non-empty attempts have regressions, in which case rank all non-empty by fewest regressions.
 * 3. Rank remaining candidates by:
 *    a. newRegressionCount ascending (fewer regressions = better)
 *    b. Verification allPassed boolean (green > red)
 *    c. totalTokens ascending (cheaper = tiebreaker)
 *    d. index ascending (deterministic tiebreaker)
 */
export function selectBestAttempt(attempts: AttemptResult[]): AttemptSelection {
  const discarded: Array<{ attempt: AttemptResult; reason: string }> = []
  const nonDiscarded: AttemptResult[] = []

  for (const att of attempts) {
    if (!att.hasMutations || !att.diff.trim()) {
      discarded.push({
        attempt: att,
        reason: `Empty (exit: ${att.exitReason || "no mutations applied"})`,
      })
      continue
    }
    nonDiscarded.push(att)
  }

  if (nonDiscarded.length === 0) {
    return {
      winner: undefined,
      discarded,
      ranked: [],
      summary: formatSummary(attempts, undefined, discarded),
    }
  }

  // Check for clean / green candidates
  const cleanCandidates = nonDiscarded.filter(
    (a) => a.newRegressionCount === 0 || a.hasGreenCommit === true || a.verification?.allPassed === true,
  )

  let candidates: AttemptResult[]
  if (cleanCandidates.length > 0 && cleanCandidates.length < nonDiscarded.length) {
    for (const att of nonDiscarded) {
      if (!cleanCandidates.includes(att)) {
        discarded.push({
          attempt: att,
          reason: `${att.newRegressionCount} new regression${att.newRegressionCount === 1 ? "" : "s"} (exit: ${att.exitReason || "repair budget exhausted"})`,
        })
      }
    }
    candidates = cleanCandidates
  } else {
    // If all candidates have regressions (or all are clean), retain them for ranking
    candidates = [...nonDiscarded]
  }

  // Rank candidates
  candidates.sort((a, b) => {
    // a. newRegressionCount ascending (fewer regressions = better)
    if (a.newRegressionCount !== b.newRegressionCount) {
      return a.newRegressionCount - b.newRegressionCount
    }
    // b. Verification allPassed boolean (green > red)
    const aPassed = a.verification?.allPassed ? 1 : 0
    const bPassed = b.verification?.allPassed ? 1 : 0
    if (aPassed !== bPassed) {
      return bPassed - aPassed
    }
    // c. totalTokens ascending (cheaper = tiebreaker)
    if (a.totalTokens !== b.totalTokens) {
      return a.totalTokens - b.totalTokens
    }
    // d. index ascending
    return a.index - b.index
  })

  const winner = candidates[0]
  const summary = formatSummary(attempts, winner, discarded)

  return {
    winner,
    discarded,
    ranked: candidates,
    summary,
  }
}

export function formatSummary(
  attempts: AttemptResult[],
  winner: AttemptResult | undefined,
  discarded: Array<{ attempt: AttemptResult; reason: string }>,
): string {
  const lines: string[] = []
  const count = attempts.length
  lines.push(`─── Multi-Attempt Summary (${count} attempt${count === 1 ? "" : "s"}) ───`)

  for (const att of attempts) {
    const isWinner = winner && att.index === winner.index
    const disc = discarded.find((d) => d.attempt.index === att.index)

    if (isWinner) {
      const filesCount = att.diff ? countChangedFiles(att.diff) : 0
      const verifStr = att.verification?.allPassed
        ? "verification: all passed"
        : att.verification
          ? "verification: failed"
          : "no verification"
      lines.push(
        `  Attempt ${att.index + 1}: ✅ Winner (${att.newRegressionCount} regressions, ${verifStr}, ${filesCount} file${filesCount === 1 ? "" : "s"} changed)`,
      )
    } else if (disc) {
      if (!att.hasMutations || !att.diff.trim()) {
        lines.push(`  Attempt ${att.index + 1}: ❌ Empty (${disc.reason})`)
      } else {
        lines.push(`  Attempt ${att.index + 1}: ⚠️ ${disc.reason}`)
      }
    } else {
      const filesCount = att.diff ? countChangedFiles(att.diff) : 0
      lines.push(
        `  Attempt ${att.index + 1}: ⚠️ ${att.newRegressionCount} new regression${att.newRegressionCount === 1 ? "" : "s"} (${filesCount} file${filesCount === 1 ? "" : "s"} changed)`,
      )
    }
  }

  lines.push("")
  if (winner) {
    lines.push(`Winner: Attempt ${winner.index + 1} — applied as patch onto HEAD.`)
  } else {
    lines.push(`All ${count} attempts failed — no changes applied.`)
  }
  lines.push(`─── End Multi-Attempt Summary ───`)

  return lines.join("\n")
}

function countChangedFiles(diff: string): number {
  const matches = diff.match(/^diff --git /gm)
  return matches ? matches.length : 1
}
