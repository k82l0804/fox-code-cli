/**
 * Fox Challenge Ladder — JSON Results Exporter
 *
 * Run this to generate a JSON snapshot of the current challenge results
 * for historical tracking and automated comparison.
 *
 * Usage:
 *   bun run tools/challenge-snapshot.ts
 *
 * Output:
 *   docs/challenge-history/YYYY-MM-DD.json
 */
import { getAllChallengeFixtures } from "../test/challenge-ladder"
import { runChallengeLadder, runABComparison } from "../test/challenge-ladder/scoring"
import { writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"

// Enable compression
process.env.FOX_EXPERIMENTAL_COMPRESS = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_PATHS = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_GIT = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_DIFF = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_DATA = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE = "true"

const fixtures = getAllChallengeFixtures()

console.log(`Running Challenge Ladder on ${fixtures.length} fixtures...`)
const ladder = runChallengeLadder(fixtures)

console.log(`Running A/B Comparison...`)
const ab = runABComparison(fixtures)

const snapshot = {
  version: "1.0",
  date: new Date().toISOString().split("T")[0],
  timestamp: new Date().toISOString(),
  foxVersion: "0.1.0",
  fixtureCount: fixtures.length,
  ladder: {
    globalScore: ladder.globalScore,
    maxScore: ladder.maxScore,
    globalPct: ladder.globalPct,
    tiers: ladder.tiers.map((t) => ({
      tier: t.tier,
      name: t.name,
      score: t.score,
      maxScore: t.maxScore,
      pct: t.pct,
      categories: t.categories.map((c) => ({
        category: c.category,
        fixtureCount: c.fixtureCount,
        score: c.score,
        maxScore: c.maxScore,
        pct: c.pct,
        avgCompressionPct: c.avgCompressionPct,
      })),
    })),
    metrics: ladder.metrics,
    worstFixtures: ladder.worstFixtures,
  },
  ab: {
    totals: ab.totals,
    categories: ab.categories,
  },
}

const outDir = path.resolve(import.meta.dir ?? ".", "../docs/challenge-history")
mkdirSync(outDir, { recursive: true })

const dateStr = snapshot.date
const outPath = path.join(outDir, `${dateStr}.json`)
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n")

console.log(`\n✅ Snapshot saved: ${outPath}`)
console.log(`   Score: ${ladder.globalScore}/${ladder.maxScore} (${ladder.globalPct}%)`)
console.log(`   Token savings: ${ab.totals.totalTokenSavings} (${ab.totals.globalSavingsPct}%)`)
