export * as TransactionConfidence from "./transaction-confidence"

/**
 * Match quality tiers, ordered from highest to lowest confidence.
 * These correspond to the multi-pass matching strategy in `patch.ts`:
 * exact → rstrip → trim → normalized.
 */
export type MatchTier = "exact" | "rstrip" | "trim" | "normalized"

/** Confidence score for the match tier. */
export const tierScore: Record<MatchTier, number> = {
  exact: 1.0,
  rstrip: 0.95,
  trim: 0.9,
  normalized: 0.8,
}

/**
 * Per-hunk confidence metadata produced during dry-run analysis.
 */
export interface HunkConfidence {
  readonly path: string
  readonly hunkIndex: number
  /** Overall score for this hunk (0.0–1.0). */
  readonly score: number
  /** Which matching pass succeeded. */
  readonly matchTier: MatchTier
  /** Number of context lines that contributed to the match. */
  readonly contextLines: number
}

/**
 * Aggregate confidence for an entire patch transaction.
 */
export interface TransactionConfidence {
  /** Minimum hunk score across all hunks (conservative). */
  readonly overall: number
  /** Per-hunk breakdown. */
  readonly hunks: ReadonlyArray<HunkConfidence>
  /** Recommended action based on thresholds. */
  readonly recommendation: "apply" | "review" | "reject"
}

/** Confidence thresholds for patch application gating. */
const APPLY_THRESHOLD = 0.9
const REVIEW_THRESHOLD = 0.7

/**
 * Compute the recommendation from a confidence score.
 */
export function recommend(score: number): "apply" | "review" | "reject" {
  if (score >= APPLY_THRESHOLD) return "apply"
  if (score >= REVIEW_THRESHOLD) return "review"
  return "reject"
}

/**
 * Aggregate per-hunk confidences into a transaction-level summary.
 */
export function aggregate(hunks: ReadonlyArray<HunkConfidence>): TransactionConfidence {
  if (hunks.length === 0) {
    return { overall: 1.0, hunks, recommendation: "apply" }
  }
  const overall = Math.min(...hunks.map((h) => h.score))
  return { overall, hunks, recommendation: recommend(overall) }
}

/**
 * Compute a single hunk's confidence score from its match tier and context.
 */
export function scoreHunk(
  path: string,
  hunkIndex: number,
  matchTier: MatchTier,
  contextLines: number,
): HunkConfidence {
  // Base score from match tier
  let score = tierScore[matchTier]

  // Bonus for context lines (up to +0.05 for 5+ context lines)
  const contextBonus = Math.min(contextLines, 5) * 0.01
  score = Math.min(1.0, score + contextBonus)

  return { path, hunkIndex, score, matchTier, contextLines }
}
