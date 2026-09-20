/**
 * Types for the Fox Standard Test Suite
 *
 * Covers:
 * - 6 Golden Corpora: SWE-bench Mini, GitOps, Test Output, Diff, Shell Output, Document
 * - Core Invariant verifications (Lossless, Non-Expansion, Prefix Stability, Supersession, Escape Hatch, ROI)
 * - Baseline scoreboard calculation and reporting
 */

export type CorpusCategory =
  | "swe-bench-mini"
  | "gitops"
  | "test-output"
  | "diff"
  | "shell-output"
  | "document"

export type ToolType = "bash" | "read" | "grep" | "edit" | "write"

export interface CorpusFixture {
  readonly id: string
  readonly name: string
  readonly category: CorpusCategory
  readonly tool: ToolType
  readonly content: string
  readonly command?: string
  /**
   * Expected critical substrings or patterns that must be preserved
   * to guarantee zero-loss information retention.
   */
  readonly mustContain?: readonly string[]
  /**
   * Minimum expected reduction percentage (0 to 100) under full compression.
   */
  readonly minExpectedReductionPct?: number
  /**
   * Whether this fixture represents an escape hatch (e.g. raw git, # no-truncate).
   */
  readonly isEscapeHatch?: boolean
}

export interface SweMiniTask {
  readonly id: string
  readonly title: string
  readonly category: "bug-fix" | "refactor" | "patch-apply" | "concurrency" | "performance" | "formatting"
  readonly description: string
  readonly initialFiles: Record<string, string>
  readonly failingTestCommand: string
  readonly failingTestOutput: string
  readonly referencePatch: string
  readonly passingTestOutput: string
  readonly expectedAssertions: number
}

export interface InvariantResult {
  readonly lossless: boolean
  readonly nonExpansion: boolean
  readonly escapeHatchHonored: boolean
  readonly durationMs: number
  readonly roiScore: number
}

export interface ScoreboardEntry {
  readonly id: string
  readonly name: string
  readonly category: CorpusCategory
  readonly rawBytes: number
  readonly compressedBytes: number
  readonly rawTokens: number
  readonly compressedTokens: number
  readonly tokensSaved: number
  readonly pctSaved: number
  readonly durationMs: number
  readonly roi: number
  readonly invariantsPassed: boolean
}

export interface CategorySummary {
  readonly category: CorpusCategory
  readonly fixtureCount: number
  readonly totalRawTokens: number
  readonly totalCompressedTokens: number
  readonly tokensSaved: number
  readonly pctSaved: number
  readonly avgDurationMs: number
  readonly allInvariantsPassed: boolean
}

export interface ScoreboardSummary {
  readonly totalFixtures: number
  readonly totalRawTokens: number
  readonly totalCompressedTokens: number
  readonly totalTokensSaved: number
  readonly overallPctSaved: number
  readonly totalOverheadMs: number
  readonly overallROI: number
  readonly allInvariantsPassed: boolean
  readonly categories: readonly CategorySummary[]
  readonly entries: readonly ScoreboardEntry[]
}
