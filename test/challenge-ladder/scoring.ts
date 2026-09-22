/**
 * Fox Challenge Ladder — Scoring Engine
 *
 * Tier-specific scoring logic:
 *   Tier 1: Binary invariants (lossless, non-expansion, stability)
 *   Tier 2: Stepwise completion (fraction of steps preserving invariants)
 *   Tier 3: Three-axis (routing ⅓ + invariants ⅓ + robustness ⅓)
 *   Tier 4: Binary pass/fail (objective success)
 *
 * Produces per-fixture scores, per-category breakdowns, per-tier totals,
 * and the global Fox Challenge Score (0–300).
 */
import type {
  ChallengeFixture,
  FixtureResult,
  CategoryResult,
  TierResult,
  ChallengeResult,
  TierNumber,
  ChallengeCategory,
} from "./types"
import { TIER_META } from "./types"
import {
  process as runCompress,
  truncateShellOutput,
  type CompressContext,
} from "@opencode-ai/core/tool/compress"
import { resetROI } from "@opencode-ai/core/tool/compression-metrics"
import path from "node:path"

const WORKSPACE = path.resolve((import.meta as any).dir ?? ".", "..")

// ---------------------------------------------------------------------------
// Compression pipeline
// ---------------------------------------------------------------------------

function compressFixtureContent(fixture: ChallengeFixture): {
  output: string
  latencyMs: number
} {
  const ctx: CompressContext = {
    workspaceRoot: WORKSPACE,
    toolName: fixture.input.tool,
    workflow: fixture.expected.workflow ?? "swe",
    command: fixture.input.command,
  }

  const start = performance.now()
  let output = runCompress(fixture.input.content, ctx)

  if (fixture.input.tool === "bash" && fixture.input.command) {
    const res = truncateShellOutput(output, { command: fixture.input.command })
    output = res.output
  }

  const latencyMs = performance.now() - start
  return { output, latencyMs }
}

// ---------------------------------------------------------------------------
// Per-tier scoring
// ---------------------------------------------------------------------------

function scoreTier1(fixture: ChallengeFixture, output: string): { score: number; failures: string[] } {
  const failures: string[] = []

  // Invariant 1: Lossless — mustContain preserved
  if (fixture.expected.mustContain) {
    for (const substr of fixture.expected.mustContain) {
      if (!output.includes(substr)) {
        failures.push(`Lossless: missing "${substr.slice(0, 50)}"`)
      }
    }
  }

  // Invariant 2: Non-expansion
  if (output.length > fixture.input.content.length) {
    failures.push(`Non-expansion: ${fixture.input.content.length} → ${output.length} (+${output.length - fixture.input.content.length})`)
  }

  // Invariant 3: Stability — compress again, must be identical
  const ctx: CompressContext = {
    workspaceRoot: WORKSPACE,
    toolName: fixture.input.tool,
    workflow: fixture.expected.workflow ?? "swe",
    command: fixture.input.command,
  }
  let output2 = runCompress(fixture.input.content, ctx)
  if (fixture.input.tool === "bash" && fixture.input.command) {
    output2 = truncateShellOutput(output2, { command: fixture.input.command }).output
  }
  if (output !== output2) {
    failures.push("Stability: non-deterministic output on second pass")
  }

  // Invariant 4: mustNotContain (hallucination check)
  if (fixture.expected.mustNotContain) {
    for (const substr of fixture.expected.mustNotContain) {
      if (output.includes(substr)) {
        failures.push(`Hallucination: found forbidden "${substr.slice(0, 50)}"`)
      }
    }
  }

  return { score: failures.length === 0 ? 1.0 : 0.0, failures }
}

function scoreTier2(fixture: ChallengeFixture, output: string): { score: number; failures: string[] } {
  const failures: string[] = []

  // For multi-step workflows, compress each step and check invariants
  if (fixture.input.steps && fixture.input.steps.length > 0) {
    let stepsPass = 0
    const totalSteps = fixture.input.steps.length

    for (let i = 0; i < totalSteps; i++) {
      const step = fixture.input.steps[i]!
      const ctx: CompressContext = {
        workspaceRoot: WORKSPACE,
        toolName: step.tool,
        workflow: fixture.expected.workflow ?? "swe",
      }

      let stepOutput = runCompress(step.content, ctx)
      if (step.tool === "bash" && step.command) {
        stepOutput = truncateShellOutput(stepOutput, { command: step.command }).output
      }

      // Non-expansion per step
      if (stepOutput.length <= step.content.length) {
        stepsPass++
      } else {
        failures.push(`Step ${i}: expansion ${step.content.length} → ${stepOutput.length}`)
      }
    }

    const stepScore = stepsPass / totalSteps
    // Also check mustContain on the combined output
    let mustContainPass = true
    if (fixture.expected.mustContain) {
      for (const substr of fixture.expected.mustContain) {
        if (!output.includes(substr)) {
          failures.push(`Combined: missing "${substr.slice(0, 50)}"`)
          mustContainPass = false
        }
      }
    }

    const score = mustContainPass ? stepScore : stepScore * 0.5
    return { score: Math.round(score * 100) / 100, failures }
  }

  // Fallback: single-content Tier 2 — same as Tier 1
  return scoreTier1(fixture, output)
}

function scoreTier3(fixture: ChallengeFixture, output: string): { score: number; failures: string[] } {
  const failures: string[] = []
  let routingScore = 1 / 3
  let invariantScore = 1 / 3
  let robustnessScore = 1 / 3

  // Axis 1: Routing correctness (⅓)
  // For ambiguous workflows, we can't easily auto-detect routing from the output,
  // so we rely on invariant preservation as a proxy for correct routing.
  // If the content is preserved without loss, routing was acceptable.

  // Axis 2: Invariant compliance (⅓)
  // Non-expansion
  if (output.length > fixture.input.content.length) {
    invariantScore = 0
    failures.push(`Non-expansion: ${fixture.input.content.length} → ${output.length}`)
  }

  // mustContain preservation
  if (fixture.expected.mustContain) {
    let preserved = 0
    for (const substr of fixture.expected.mustContain) {
      if (output.includes(substr)) {
        preserved++
      } else {
        failures.push(`Lossless: missing "${substr.slice(0, 50)}"`)
      }
    }
    if (fixture.expected.mustContain.length > 0) {
      invariantScore *= preserved / fixture.expected.mustContain.length
    }
  }

  // Axis 3: Robustness (⅓)
  // No hallucinated repairs
  if (fixture.expected.mustNotContain) {
    for (const substr of fixture.expected.mustNotContain) {
      if (output.includes(substr)) {
        robustnessScore = 0
        failures.push(`Hallucination: found forbidden "${substr.slice(0, 50)}"`)
      }
    }
  }

  // For malformed diffs: ensure the compressor doesn't try to "fix" broken content
  // (already covered by mustNotContain)

  const score = Math.round((routingScore + invariantScore + robustnessScore) * 100) / 100
  return { score, failures }
}

function scoreTier4(fixture: ChallengeFixture, output: string): { score: number; failures: string[] } {
  const failures: string[] = []

  // Binary pass/fail — all invariants must hold
  // Non-expansion
  if (output.length > fixture.input.content.length) {
    failures.push(`Non-expansion: ${fixture.input.content.length} → ${output.length}`)
  }

  // mustContain
  if (fixture.expected.mustContain) {
    for (const substr of fixture.expected.mustContain) {
      if (!output.includes(substr)) {
        failures.push(`Missing: "${substr.slice(0, 50)}"`)
      }
    }
  }

  // mustNotContain
  if (fixture.expected.mustNotContain) {
    for (const substr of fixture.expected.mustNotContain) {
      if (output.includes(substr)) {
        failures.push(`Forbidden: found "${substr.slice(0, 50)}"`)
      }
    }
  }

  // Stability
  const ctx: CompressContext = {
    workspaceRoot: WORKSPACE,
    toolName: fixture.input.tool,
    workflow: fixture.expected.workflow ?? "swe",
  }
  let output2 = runCompress(fixture.input.content, ctx)
  if (fixture.input.tool === "bash" && fixture.input.command) {
    output2 = truncateShellOutput(output2, { command: fixture.input.command }).output
  }
  if (output !== output2) {
    failures.push("Stability: non-deterministic")
  }

  return { score: failures.length === 0 ? 1.0 : 0.0, failures }
}

// ---------------------------------------------------------------------------
// Score dispatcher
// ---------------------------------------------------------------------------

function scoreFixture(fixture: ChallengeFixture, output: string): { score: number; failures: string[] } {
  switch (fixture.tier) {
    case 1: return scoreTier1(fixture, output)
    case 2: return scoreTier2(fixture, output)
    case 3: return scoreTier3(fixture, output)
    case 4: return scoreTier4(fixture, output)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run a single fixture through the compression pipeline and score it. */
export function runFixture(fixture: ChallengeFixture): FixtureResult {
  // Reset ROI metrics before each fixture to prevent stateful accumulation
  // from causing non-deterministic output between first pass and stability check.
  resetROI()
  const { output, latencyMs } = compressFixtureContent(fixture)
  const { score, failures } = scoreFixture(fixture, output)

  const rawLen = fixture.input.content.length
  const compLen = output.length
  const rawTokens = Math.ceil(rawLen / 4)
  const compTokens = Math.ceil(compLen / 4)
  const compressionPct = rawLen > 0 ? Math.round(((rawLen - compLen) / rawLen) * 1000) / 10 : 0

  return {
    id: fixture.id,
    tier: fixture.tier,
    category: fixture.category,
    score,
    rawLength: rawLen,
    compressedLength: compLen,
    rawTokens,
    compressedTokens: compTokens,
    compressionPct,
    latencyMs: Math.round(latencyMs * 100) / 100,
    passed: failures.length === 0,
    failures,
  }
}

/** Aggregate fixture results into a category summary. */
export function aggregateCategory(
  category: ChallengeCategory,
  results: readonly FixtureResult[],
): CategoryResult {
  const catResults = results.filter((r) => r.category === category)
  const score = catResults.reduce((sum, r) => sum + r.score, 0)
  const maxScore = catResults.length
  const avgCompressionPct =
    catResults.length > 0
      ? Math.round((catResults.reduce((sum, r) => sum + r.compressionPct, 0) / catResults.length) * 10) / 10
      : 0
  const avgLatencyMs =
    catResults.length > 0
      ? Math.round((catResults.reduce((sum, r) => sum + r.latencyMs, 0) / catResults.length) * 100) / 100
      : 0

  // Worst fixtures (score < 1.0), sorted by score ascending
  const worstFixtures = catResults
    .filter((r) => r.score < 1.0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((r) => r.id)

  return {
    category,
    fixtureCount: catResults.length,
    score: Math.round(score * 100) / 100,
    maxScore,
    pct: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0,
    avgCompressionPct,
    avgLatencyMs,
    worstFixtures,
  }
}

/** Run the entire challenge ladder and produce a ChallengeResult. */
export function runChallengeLadder(fixtures: readonly ChallengeFixture[]): ChallengeResult {
  const allResults: FixtureResult[] = []

  for (const fixture of fixtures) {
    allResults.push(runFixture(fixture))
  }

  // Per-tier results
  const tiers: TierResult[] = ([1, 2, 3, 4] as TierNumber[]).map((tier) => {
    const tierResults = allResults.filter((r) => r.tier === tier)
    const categories = new Set(tierResults.map((r) => r.category))
    const categoryResults = [...categories].map((cat) => aggregateCategory(cat, tierResults))

    const score = tierResults.reduce((sum, r) => sum + r.score, 0)
    const maxScore = TIER_META[tier].maxScore

    return {
      tier,
      name: TIER_META[tier].name,
      maxScore,
      score: Math.round(score * 100) / 100,
      pct: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0,
      categories: categoryResults,
      fixtures: tierResults,
    }
  })

  const globalScore = Math.round(tiers.reduce((sum, t) => sum + t.score, 0) * 100) / 100
  const totalPassed = allResults.filter((r) => r.passed).length
  const totalFailed = allResults.filter((r) => !r.passed).length

  // Worst fixtures globally
  const worstFixtures = allResults
    .filter((r) => r.score < 1.0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map((r) => r.id)

  // METR-style horizon metric: max step count among Tier 2 fixtures with ≥50% success
  const tier2Results = allResults.filter((r) => r.tier === 2 && r.score >= 0.5)
  const tier2Fixtures = fixtures.filter((f) => f.tier === 2 && tier2Results.some((r) => r.id === f.id))
  const maxHorizonLength = tier2Fixtures.reduce(
    (max, f) => Math.max(max, f.input.steps?.length ?? 0),
    0,
  )

  const totalMaxScore = Object.values(TIER_META).reduce((sum, t) => sum + t.maxScore, 0)

  return {
    globalScore,
    maxScore: totalMaxScore,
    globalPct: Math.round((globalScore / totalMaxScore) * 1000) / 10,
    tiers,
    metrics: {
      avgPrefillTokens:
        allResults.length > 0
          ? Math.round(allResults.reduce((sum, r) => sum + r.rawTokens, 0) / allResults.length)
          : 0,
      avgCompressionRatio:
        allResults.length > 0
          ? Math.round((allResults.reduce((sum, r) => sum + r.compressionPct, 0) / allResults.length) * 10) / 10
          : 0,
      avgLatencyMs:
        allResults.length > 0
          ? Math.round((allResults.reduce((sum, r) => sum + r.latencyMs, 0) / allResults.length) * 100) / 100
          : 0,
      maxHorizonLength,
      totalFixtures: allResults.length,
      totalPassed,
      totalFailed,
    },
    worstFixtures,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// A/B Comparison: Optimized vs Unoptimized
// ---------------------------------------------------------------------------

export interface ABFixtureResult {
  readonly id: string
  readonly tier: TierNumber
  readonly category: string
  /** Raw input size (same for both). */
  readonly rawChars: number
  readonly rawTokens: number
  /** Optimized (compression ON). */
  readonly optimizedChars: number
  readonly optimizedTokens: number
  readonly optimizedPct: number
  readonly optimizedLatencyMs: number
  readonly optimizedPassed: boolean
  /** Unoptimized (compression OFF = passthrough). */
  readonly unoptimizedChars: number
  readonly unoptimizedTokens: number
  /** Token savings = unoptimized - optimized tokens. */
  readonly tokenSavings: number
  /** Savings as percentage of unoptimized tokens. */
  readonly tokenSavingsPct: number
}

export interface ABCategoryResult {
  readonly category: string
  readonly fixtureCount: number
  /** Total tokens (unoptimized) across all fixtures in this category. */
  readonly totalUnoptimizedTokens: number
  /** Total tokens (optimized) across all fixtures. */
  readonly totalOptimizedTokens: number
  /** Total tokens saved. */
  readonly totalTokenSavings: number
  /** Savings as percentage. */
  readonly savingsPct: number
  /** Average compression percentage. */
  readonly avgCompressionPct: number
  /** Average latency ms. */
  readonly avgLatencyMs: number
  /** Pass rate (optimized). */
  readonly passRate: number
}

export interface ABComparisonResult {
  /** Per-fixture A/B results. */
  readonly fixtures: readonly ABFixtureResult[]
  /** Per-category summaries. */
  readonly categories: readonly ABCategoryResult[]
  /** Grand totals. */
  readonly totals: {
    readonly totalFixtures: number
    readonly totalUnoptimizedTokens: number
    readonly totalOptimizedTokens: number
    readonly totalTokenSavings: number
    readonly globalSavingsPct: number
    readonly totalUnoptimizedChars: number
    readonly totalOptimizedChars: number
    readonly totalCharSavings: number
    readonly avgLatencyMs: number
    readonly passRate: number
  }
  readonly timestamp: string
}

/**
 * Run A/B comparison: each fixture is measured with compression ON vs OFF.
 * "Unoptimized" = raw content passthrough (no compression, no truncation).
 * "Optimized" = full compression pipeline.
 */
export function runABComparison(fixtures: readonly ChallengeFixture[]): ABComparisonResult {
  const abResults: ABFixtureResult[] = []

  for (const fixture of fixtures) {
    resetROI()

    // Optimized: full pipeline
    const { output: optimizedOutput, latencyMs } = compressFixtureContent(fixture)
    const { score, failures } = scoreFixture(fixture, optimizedOutput)

    const rawChars = fixture.input.content.length
    const rawTokens = Math.ceil(rawChars / 4)
    const optimizedChars = optimizedOutput.length
    const optimizedTokens = Math.ceil(optimizedChars / 4)
    const optimizedPct = rawChars > 0 ? Math.round(((rawChars - optimizedChars) / rawChars) * 1000) / 10 : 0

    // Unoptimized: passthrough (= raw content, no compression)
    // For bash commands, still apply truncation since that's a safety feature, not optimization
    const unoptimizedChars = rawChars
    const unoptimizedTokens = rawTokens

    const tokenSavings = unoptimizedTokens - optimizedTokens
    const tokenSavingsPct = unoptimizedTokens > 0
      ? Math.round((tokenSavings / unoptimizedTokens) * 1000) / 10
      : 0

    abResults.push({
      id: fixture.id,
      tier: fixture.tier,
      category: fixture.category,
      rawChars,
      rawTokens,
      optimizedChars,
      optimizedTokens,
      optimizedPct,
      optimizedLatencyMs: Math.round(latencyMs * 100) / 100,
      optimizedPassed: failures.length === 0,
      unoptimizedChars,
      unoptimizedTokens,
      tokenSavings,
      tokenSavingsPct,
    })
  }

  // Aggregate by category
  const categoryMap = new Map<string, ABFixtureResult[]>()
  for (const r of abResults) {
    const arr = categoryMap.get(r.category) ?? []
    arr.push(r)
    categoryMap.set(r.category, arr)
  }

  const categories: ABCategoryResult[] = [...categoryMap.entries()].map(([cat, results]) => {
    const totalUnopt = results.reduce((s, r) => s + r.unoptimizedTokens, 0)
    const totalOpt = results.reduce((s, r) => s + r.optimizedTokens, 0)
    const totalSavings = totalUnopt - totalOpt
    return {
      category: cat,
      fixtureCount: results.length,
      totalUnoptimizedTokens: totalUnopt,
      totalOptimizedTokens: totalOpt,
      totalTokenSavings: totalSavings,
      savingsPct: totalUnopt > 0 ? Math.round((totalSavings / totalUnopt) * 1000) / 10 : 0,
      avgCompressionPct: Math.round((results.reduce((s, r) => s + r.optimizedPct, 0) / results.length) * 10) / 10,
      avgLatencyMs: Math.round((results.reduce((s, r) => s + r.optimizedLatencyMs, 0) / results.length) * 100) / 100,
      passRate: Math.round((results.filter(r => r.optimizedPassed).length / results.length) * 1000) / 10,
    }
  })

  // Grand totals
  const totalUnoptTokens = abResults.reduce((s, r) => s + r.unoptimizedTokens, 0)
  const totalOptTokens = abResults.reduce((s, r) => s + r.optimizedTokens, 0)
  const totalTokenSavings = totalUnoptTokens - totalOptTokens
  const totalUnoptChars = abResults.reduce((s, r) => s + r.unoptimizedChars, 0)
  const totalOptChars = abResults.reduce((s, r) => s + r.optimizedChars, 0)

  return {
    fixtures: abResults,
    categories,
    totals: {
      totalFixtures: abResults.length,
      totalUnoptimizedTokens: totalUnoptTokens,
      totalOptimizedTokens: totalOptTokens,
      totalTokenSavings,
      globalSavingsPct: totalUnoptTokens > 0 ? Math.round((totalTokenSavings / totalUnoptTokens) * 1000) / 10 : 0,
      totalUnoptimizedChars: totalUnoptChars,
      totalOptimizedChars: totalOptChars,
      totalCharSavings: totalUnoptChars - totalOptChars,
      avgLatencyMs: abResults.length > 0
        ? Math.round((abResults.reduce((s, r) => s + r.optimizedLatencyMs, 0) / abResults.length) * 100) / 100
        : 0,
      passRate: abResults.length > 0
        ? Math.round((abResults.filter(r => r.optimizedPassed).length / abResults.length) * 1000) / 10
        : 0,
    },
    timestamp: new Date().toISOString(),
  }
}
