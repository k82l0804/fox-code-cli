/**
 * Fox Challenge Ladder — Core Types
 *
 * 300-fixture, 4-tier challenge suite for stress-testing Fox's compression
 * pipeline, workflow routing, long-horizon reasoning, and adversarial robustness.
 *
 * Global Fox Challenge Score: 0–300
 */
import type { ToolType, WorkflowType } from "@opencode-ai/core/tool/compress"

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------

export type TierNumber = 1 | 2 | 3 | 4

export type Tier1Category =
  | "swe-bench-mini"
  | "gitops"
  | "test-output"
  | "diff"
  | "shell-output"
  | "document"

export type Tier2Category =
  | "gitops-workflows"
  | "swe-multifile"
  | "shell-pipelines"
  | "multi-doc-research"

export type Tier3Category =
  | "malformed-diffs"
  | "corrupted-logs"
  | "partial-stacktraces"
  | "ambiguous-workflows"

export type Tier4Category =
  | "gaia-style"
  | "webarena-style"
  | "osworld-style"
  | "swe-bench-verified"

export type ChallengeCategory =
  | Tier1Category
  | Tier2Category
  | Tier3Category
  | Tier4Category

export type ExpectedType = "invariant" | "completion" | "robustness" | "objective"

/** A single step in a multi-step workflow fixture (Tier 2). */
export interface WorkflowStep {
  /** Tool that produced this step. */
  readonly tool: ToolType
  /** Command executed (for bash/grep tools). */
  readonly command?: string
  /** The raw output content of this step. */
  readonly content: string
  /** Timestamp (ISO-8601 or epoch ms) for realism. */
  readonly timestamp?: string
}

/** Core fixture type for the Challenge Ladder. */
export interface ChallengeFixture {
  /** Unique fixture ID, e.g. "gitops-t1-07" */
  readonly id: string
  /** Tier number (1–4). */
  readonly tier: TierNumber
  /** Category within the tier. */
  readonly category: ChallengeCategory
  /** Human-readable description. */
  readonly description: string
  /** Deterministic generator seed for reproducibility. */
  readonly seed: number

  /** Input content to process through Fox's compression pipeline. */
  readonly input: {
    /** Primary content to compress. */
    readonly content: string
    /** Which tool produced this content. */
    readonly tool: ToolType
    /** Shell command if applicable. */
    readonly command?: string
    /** Multi-file context (Tier 2/4). */
    readonly files?: Readonly<Record<string, string>>
    /** Multi-document context (Tier 2/4). */
    readonly documents?: readonly string[]
    /** Multi-step sequences (Tier 2). */
    readonly steps?: readonly WorkflowStep[]
  }

  /** Expected behavior / scoring criteria. */
  readonly expected: {
    /** Scoring type for this fixture. */
    readonly type: ExpectedType
    /** Substrings that MUST be preserved in compressed output. */
    readonly mustContain?: readonly string[]
    /** Substrings that must NOT appear (hallucination detection). */
    readonly mustNotContain?: readonly string[]
    /** Expected dominant workflow classification. */
    readonly workflow?: WorkflowType
    /** Minimum compression percentage target (0–100). */
    readonly minReductionPct?: number
    /** Maximum allowed expansion (e.g. 0 = non-expansion invariant). */
    readonly maxExpansionPct?: number
    /** Expected action sequence (Tier 4). */
    readonly actions?: readonly string[]
  }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface FixtureResult {
  readonly id: string
  readonly tier: TierNumber
  readonly category: ChallengeCategory
  /** Score for this fixture (0.0–1.0). */
  readonly score: number
  /** Raw input length in chars. */
  readonly rawLength: number
  /** Compressed output length in chars. */
  readonly compressedLength: number
  /** Approximate token count (chars / 4). */
  readonly rawTokens: number
  /** Approximate compressed token count. */
  readonly compressedTokens: number
  /** Compression ratio as percentage saved. */
  readonly compressionPct: number
  /** Processing latency in ms. */
  readonly latencyMs: number
  /** Whether all invariants passed. */
  readonly passed: boolean
  /** Failure reasons (empty if passed). */
  readonly failures: readonly string[]
}

export interface CategoryResult {
  readonly category: ChallengeCategory
  readonly fixtureCount: number
  readonly score: number
  readonly maxScore: number
  readonly pct: number
  readonly avgCompressionPct: number
  readonly avgLatencyMs: number
  readonly worstFixtures: readonly string[]
}

export interface TierResult {
  readonly tier: TierNumber
  readonly name: string
  readonly maxScore: number
  readonly score: number
  readonly pct: number
  readonly categories: readonly CategoryResult[]
  readonly fixtures: readonly FixtureResult[]
}

export interface ChallengeResult {
  /** Global Fox Challenge Score (0–300). */
  readonly globalScore: number
  /** Maximum possible score. */
  readonly maxScore: number
  /** Global percentage. */
  readonly globalPct: number
  /** Per-tier breakdowns. */
  readonly tiers: readonly TierResult[]
  /** Aggregate metrics. */
  readonly metrics: {
    readonly avgPrefillTokens: number
    readonly avgCompressionRatio: number
    readonly avgLatencyMs: number
    /** METR-style: max horizon length with ≥50% success. */
    readonly maxHorizonLength: number
    readonly totalFixtures: number
    readonly totalPassed: number
    readonly totalFailed: number
  }
  /** Worst-performing fixture IDs (top 10). */
  readonly worstFixtures: readonly string[]
  /** ISO-8601 timestamp. */
  readonly timestamp: string
}

// ---------------------------------------------------------------------------
// Tier metadata constants
// ---------------------------------------------------------------------------

export const TIER_META: Record<TierNumber, { name: string; maxScore: number }> = {
  1: { name: "Baseline", maxScore: 80 },
  2: { name: "Long-Horizon", maxScore: 100 },
  3: { name: "Adversarial", maxScore: 66 },
  4: { name: "External Benchmarks", maxScore: 88 },
}

export const EXPECTED_FIXTURE_COUNTS: Record<TierNumber, number> = {
  1: 80,
  2: 100,
  3: 66,
  4: 88,
}
