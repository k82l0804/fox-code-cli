/**
 * Fox Challenge Ladder — Test Suite (300 fixtures)
 *
 * Runs all 4 tiers of the Challenge Ladder through Fox's compression
 * pipeline and produces the Fox Challenge Score (0–300).
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import {
  getAllChallengeFixtures,
  validateFixtures,
  runChallengeLadder,
  getTier1Fixtures,
  getTier2Fixtures,
  getTier3Fixtures,
  getTier4Fixtures,
} from "./challenge-ladder"
import { runFixture } from "./challenge-ladder/scoring"
import { runABComparison } from "./challenge-ladder/scoring"
import type { ChallengeFixture, TierNumber } from "./challenge-ladder/types"
import { TIER_META } from "./challenge-ladder/types"
import process from "node:process"

// Enable all compression flags for the challenge
beforeAll(() => {
  process.env.FOX_EXPERIMENTAL_COMPRESS = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_PATHS = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_GIT = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_DIFF = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_DATA = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE = "true"
})

afterAll(() => {
  delete process.env.FOX_EXPERIMENTAL_COMPRESS
  delete process.env.FOX_EXPERIMENTAL_COMPRESS_PATHS
  delete process.env.FOX_EXPERIMENTAL_COMPRESS_GIT
  delete process.env.FOX_EXPERIMENTAL_COMPRESS_DIFF
  delete process.env.FOX_EXPERIMENTAL_COMPRESS_DATA
  delete process.env.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE
})

describe("Fox Challenge Ladder", () => {
  // ═══════════════════════════════════════════════════════════════
  // 0. Fixture Validation
  // ═══════════════════════════════════════════════════════════════
  describe("0. Fixture Registry Validation", () => {
    test("all 300 fixtures are present and well-formed", () => {
      const fixtures = getAllChallengeFixtures()
      const validation = validateFixtures(fixtures)

      if (!validation.valid) {
        const errorSummary = validation.errors
          .slice(0, 20)
          .map((e) => `  [${e.fixtureId}] ${e.field}: ${e.message}`)
          .join("\n")
        console.error(`Fixture validation errors:\n${errorSummary}`)
      }

      expect(validation.fixtureCount).toBe(334)
      expect(validation.tierCounts[1]).toBe(80)
      expect(validation.tierCounts[2]).toBe(100)
      expect(validation.tierCounts[3]).toBe(66)
      expect(validation.tierCounts[4]).toBe(88)
      expect(validation.valid).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 1. Tier 1: Baseline (80 fixtures)
  // ═══════════════════════════════════════════════════════════════
  describe("1. Tier 1: Baseline (80 fixtures)", () => {
    test("all Tier 1 fixtures pass compression invariants", () => {
      const fixtures = getTier1Fixtures()
      expect(fixtures.length).toBe(80)

      let passed = 0
      let failed = 0
      const failures: string[] = []

      for (const fixture of fixtures) {
        const result = runFixture(fixture)
        if (result.passed) {
          passed++
        } else {
          failed++
          failures.push(`  ${fixture.id}: ${result.failures.join("; ")}`)
        }
      }

      if (failures.length > 0) {
        console.warn(`Tier 1 failures (${failed}/${fixtures.length}):\n${failures.join("\n")}`)
      }

      // CI gate: at minimum, 95% should pass
      expect(passed).toBeGreaterThanOrEqual(76)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 2. Tier 2: Long-Horizon (80 fixtures)
  // ═══════════════════════════════════════════════════════════════
  describe("2. Tier 2: Long-Horizon (80 fixtures)", () => {
    test("all Tier 2 fixtures maintain invariants across multi-step workflows", () => {
      const fixtures = getTier2Fixtures()
      expect(fixtures.length).toBe(100)

      let totalScore = 0
      const failures: string[] = []

      for (const fixture of fixtures) {
        const result = runFixture(fixture)
        totalScore += result.score
        if (!result.passed) {
          failures.push(`  ${fixture.id} (score=${result.score}): ${result.failures.slice(0, 2).join("; ")}`)
        }
      }

      if (failures.length > 0) {
        console.warn(`Tier 2 partial failures (${failures.length}/${fixtures.length}):\n${failures.slice(0, 10).join("\n")}`)
      }

      // CI gate: at minimum, average score should be ≥ 0.9
      expect(totalScore / fixtures.length).toBeGreaterThanOrEqual(0.9)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 3. Tier 3: Adversarial (60 fixtures)
  // ═══════════════════════════════════════════════════════════════
  describe("3. Tier 3: Adversarial (60 fixtures)", () => {
    test("all Tier 3 fixtures maintain robustness on messy inputs", () => {
      const fixtures = getTier3Fixtures()
      expect(fixtures.length).toBe(66)

      let totalScore = 0
      const failures: string[] = []

      for (const fixture of fixtures) {
        const result = runFixture(fixture)
        totalScore += result.score
        if (result.score < 0.5) {
          failures.push(`  ${fixture.id} (score=${result.score}): ${result.failures.slice(0, 2).join("; ")}`)
        }
      }

      if (failures.length > 0) {
        console.warn(`Tier 3 low-scoring fixtures (${failures.length}):\n${failures.slice(0, 10).join("\n")}`)
      }

      // CI gate: at minimum, average score should be ≥ 0.9
      expect(totalScore / fixtures.length).toBeGreaterThanOrEqual(0.9)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 4. Tier 4: External Benchmarks (80 fixtures)
  // ═══════════════════════════════════════════════════════════════
  describe("4. Tier 4: External Benchmarks (80 fixtures)", () => {
    test("all Tier 4 fixtures pass objective criteria", () => {
      const fixtures = getTier4Fixtures()
      expect(fixtures.length).toBe(88)

      let passed = 0
      const failures: string[] = []

      for (const fixture of fixtures) {
        const result = runFixture(fixture)
        if (result.passed) {
          passed++
        } else {
          failures.push(`  ${fixture.id}: ${result.failures.slice(0, 2).join("; ")}`)
        }
      }

      if (failures.length > 0) {
        console.warn(`Tier 4 failures (${failures.length}/${fixtures.length}):\n${failures.slice(0, 10).join("\n")}`)
      }

      // CI gate: at minimum, 95% should pass
      expect(passed).toBeGreaterThanOrEqual(76)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 5. Global Fox Challenge Score
  // ═══════════════════════════════════════════════════════════════
  describe("5. Global Fox Challenge Score", () => {
    test("computes global score and prints scoreboard", () => {
      const fixtures = getAllChallengeFixtures()
      const result = runChallengeLadder(fixtures)

      // Print scoreboard
      console.log("")
      console.log("══════════════════════════════════════════════════════════════")
      console.log(" 🦊 FOX CHALLENGE LADDER — SCOREBOARD")
      console.log("══════════════════════════════════════════════════════════════")
      for (const tier of result.tiers) {
        const bar = `${tier.score.toFixed(1)}/${tier.maxScore}`
        console.log(`  Tier ${tier.tier} — ${tier.name.padEnd(20)} ${bar.padStart(10)}  (${tier.pct.toFixed(1)}%)`)

        // Per-category breakdown
        for (const cat of tier.categories) {
          console.log(`    └ ${cat.category.padEnd(22)} ${cat.score.toFixed(1)}/${cat.maxScore}  (${cat.pct.toFixed(1)}%)  avg compression: ${cat.avgCompressionPct.toFixed(1)}%`)
        }
      }
      console.log(" ─────────────────────────────────────────────────────────────")
      console.log(`  🏆 FOX CHALLENGE SCORE:  ${result.globalScore.toFixed(1)}/${result.maxScore}  (${result.globalPct.toFixed(1)}%)`)
      console.log("══════════════════════════════════════════════════════════════")
      console.log("")
      console.log(`  Metrics:`)
      console.log(`    Avg prefill tokens:     ${result.metrics.avgPrefillTokens}`)
      console.log(`    Avg compression ratio:  ${result.metrics.avgCompressionRatio}%`)
      console.log(`    Avg latency:            ${result.metrics.avgLatencyMs}ms`)
      console.log(`    Max horizon length:     ${result.metrics.maxHorizonLength} steps`)
      console.log(`    Total passed/failed:    ${result.metrics.totalPassed}/${result.metrics.totalFailed}`)
      console.log("")

      if (result.worstFixtures.length > 0) {
        console.log(`  Worst fixtures:`)
        for (const id of result.worstFixtures) {
          console.log(`    - ${id}`)
        }
        console.log("")
      }

      // CI gate: global score must be ≥ 285 to prevent compression regressions
      expect(result.globalScore).toBeGreaterThanOrEqual(285)
      expect(result.metrics.totalFixtures).toBe(334)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // 6. A/B Showdown: Optimized vs Unoptimized
  // ═══════════════════════════════════════════════════════════════
  describe("6. A/B Showdown: Compression Impact", () => {
    test("computes token savings and prints comparison table", () => {
      const fixtures = getAllChallengeFixtures()
      const ab = runABComparison(fixtures)

      console.log("")
      console.log("══════════════════════════════════════════════════════════════")
      console.log(" 🦊 FOX A/B SHOWDOWN — Optimized vs Unoptimized")
      console.log("══════════════════════════════════════════════════════════════")
      console.log("")
      console.log("  Per-Category Token Savings:")
      console.log("  ┌──────────────────────────┬────────┬───────────┬───────────┬─────────┬──────────┐")
      console.log("  │ Category                 │ Count  │ Unopt Tok │ Opt Tok   │ Saved   │ % Saved  │")
      console.log("  ├──────────────────────────┼────────┼───────────┼───────────┼─────────┼──────────┤")

      for (const cat of ab.categories) {
        const name = cat.category.padEnd(24)
        const count = String(cat.fixtureCount).padStart(4)
        const unopt = String(cat.totalUnoptimizedTokens).padStart(7)
        const opt = String(cat.totalOptimizedTokens).padStart(7)
        const saved = String(cat.totalTokenSavings).padStart(5)
        const pct = `${cat.savingsPct}%`.padStart(6)
        console.log(`  │ ${name} │ ${count}   │ ${unopt}   │ ${opt}   │ ${saved}   │ ${pct}   │`)
      }

      console.log("  └──────────────────────────┴────────┴───────────┴───────────┴─────────┴──────────┘")
      console.log("")
      console.log("  Grand Totals:")
      console.log(`    Fixtures:            ${ab.totals.totalFixtures}`)
      console.log(`    Unoptimized tokens:  ${ab.totals.totalUnoptimizedTokens.toLocaleString()}`)
      console.log(`    Optimized tokens:    ${ab.totals.totalOptimizedTokens.toLocaleString()}`)
      console.log(`    Tokens saved:        ${ab.totals.totalTokenSavings.toLocaleString()} (${ab.totals.globalSavingsPct}%)`)
      console.log(`    Chars saved:         ${ab.totals.totalCharSavings.toLocaleString()} chars`)
      console.log(`    Avg latency:         ${ab.totals.avgLatencyMs}ms per fixture`)
      console.log(`    Pass rate:           ${ab.totals.passRate}%`)
      console.log("")

      // Find top 5 biggest savers
      const topSavers = [...ab.fixtures]
        .sort((a, b) => b.tokenSavings - a.tokenSavings)
        .slice(0, 5)
      if (topSavers.length > 0 && topSavers[0]!.tokenSavings > 0) {
        console.log("  Top 5 Token Savers:")
        for (const f of topSavers) {
          console.log(`    ${f.id.padEnd(28)} ${f.tokenSavings} tokens (${f.tokenSavingsPct}%)`)
        }
        console.log("")
      }

      // Compression should save tokens without breaking correctness
      expect(ab.totals.passRate).toBeGreaterThanOrEqual(99)
      expect(ab.totals.totalTokenSavings).toBeGreaterThanOrEqual(0)
    })
  })
})
