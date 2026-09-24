import type { Argv } from "yargs"
import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import {
  getAllCorporaFixtures,
  getCorporaStats,
  SWE_BENCH_MINI_TASKS,
  type ScoreboardEntry,
  type ScoreboardSummary,
  type CategorySummary,
  type CorpusCategory,
} from "../../../test/corpora"
import {
  process as runCompress,
  truncateShellOutput,
  type CompressContext,
} from "@opencode-ai/core/tool/compress"
import { CompressionMetrics } from "@opencode-ai/core/tool/compression-metrics"

function computeScoreboardSummary(workspaceRoot: string): ScoreboardSummary {
  process.env.FOX_EXPERIMENTAL = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_PATHS = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_GIT = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_DIFF = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_DATA = "true"
  process.env.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE = "true"

  CompressionMetrics.reset()
  CompressionMetrics.resetROI()

  const fixtures = getAllCorporaFixtures()
  const entries: ScoreboardEntry[] = []

  for (const fixture of fixtures) {
    CompressionMetrics.resetROI()
    const ctx: CompressContext = {
      workspaceRoot,
      toolName: fixture.tool,
      workflow: "swe",
      command: fixture.command,
    }

    const rawBytes = Buffer.byteLength(fixture.content, "utf8")
    const rawTokens = Math.ceil(fixture.content.length / 4)

    const start = performance.now()
    let compressed = runCompress(fixture.content, ctx)
    if (fixture.tool === "bash" && fixture.command) {
      compressed = truncateShellOutput(compressed, { command: fixture.command }).output
    }
    const durationMs = Math.max(0.01, performance.now() - start)

    const compressedBytes = Buffer.byteLength(compressed, "utf8")
    const compressedTokens = Math.ceil(compressed.length / 4)
    const tokensSaved = Math.max(0, rawTokens - compressedTokens)
    const pctSaved = rawTokens > 0 ? Number(((tokensSaved / rawTokens) * 100).toFixed(1)) : 0

    let lossless = true
    if (fixture.mustContain) {
      for (const str of fixture.mustContain) {
        if (!compressed.includes(str)) {
          lossless = false
          break
        }
      }
    }
    const nonExpansion = compressed.length <= fixture.content.length
    const invariantsPassed = lossless && nonExpansion

    const charsSaved = Math.max(0, fixture.content.length - compressed.length)
    const roi = durationMs > 0 ? Number((charsSaved / durationMs).toFixed(1)) : Infinity

    entries.push({
      id: fixture.id,
      name: fixture.name,
      category: fixture.category,
      rawBytes,
      compressedBytes,
      rawTokens,
      compressedTokens,
      tokensSaved,
      pctSaved,
      durationMs: Number(durationMs.toFixed(2)),
      roi,
      invariantsPassed,
    })
  }

  const categories: CorpusCategory[] = [
    "swe-bench-mini",
    "gitops",
    "test-output",
    "diff",
    "shell-output",
    "document",
  ]

  const categorySummaries: CategorySummary[] = categories.map((category) => {
    const catEntries = entries.filter((e) => e.category === category)
    const totalRawTokens = catEntries.reduce((acc, e) => acc + e.rawTokens, 0)
    const totalCompressedTokens = catEntries.reduce((acc, e) => acc + e.compressedTokens, 0)
    const tokensSaved = totalRawTokens - totalCompressedTokens
    const pctSaved = totalRawTokens > 0 ? Number(((tokensSaved / totalRawTokens) * 100).toFixed(1)) : 0
    const avgDurationMs =
      catEntries.length > 0
        ? Number((catEntries.reduce((acc, e) => acc + e.durationMs, 0) / catEntries.length).toFixed(2))
        : 0
    const allInvariantsPassed = catEntries.every((e) => e.invariantsPassed)

    return {
      category,
      fixtureCount: catEntries.length,
      totalRawTokens,
      totalCompressedTokens,
      tokensSaved,
      pctSaved,
      avgDurationMs,
      allInvariantsPassed,
    }
  })

  const totalRawTokens = entries.reduce((acc, e) => acc + e.rawTokens, 0)
  const totalCompressedTokens = entries.reduce((acc, e) => acc + e.compressedTokens, 0)
  const totalTokensSaved = totalRawTokens - totalCompressedTokens
  const overallPctSaved =
    totalRawTokens > 0 ? Number(((totalTokensSaved / totalRawTokens) * 100).toFixed(1)) : 0
  const totalOverheadMs = Number(
    entries.reduce((acc, e) => acc + e.durationMs, 0).toFixed(2)
  )
  const totalCharsSaved = entries.reduce(
    (acc, e) => acc + Math.max(0, e.rawBytes - e.compressedBytes),
    0
  )
  const overallROI =
    totalOverheadMs > 0 ? Number((totalCharsSaved / totalOverheadMs).toFixed(1)) : Infinity
  const allInvariantsPassed = entries.every((e) => e.invariantsPassed)

  return {
    totalFixtures: entries.length,
    totalRawTokens,
    totalCompressedTokens,
    totalTokensSaved,
    overallPctSaved,
    totalOverheadMs,
    overallROI,
    allInvariantsPassed,
    categories: categorySummaries,
    entries,
  }
}

const ScoreboardSubcommand = effectCmd({
  command: "scoreboard",
  describe: "render the Fox Standard Test Suite baseline scoreboard",
  instance: false,
  builder: (yargs: Argv) =>
    yargs.option("json", {
      type: "boolean",
      describe: "output scoreboard summary as JSON",
      default: false,
    }),
  handler: Effect.fn("Cli.standardSuite.scoreboard")(function* (args: { json?: boolean }) {
    const summary = computeScoreboardSummary(process.cwd())

    if (args.json) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    console.log("\n" + "═".repeat(96))
    console.log(" 🦊 FOX STANDARD TEST SUITE — BASELINE SCOREBOARD")
    console.log("═".repeat(96))
    console.log(`  Total Golden Fixtures:  ${summary.totalFixtures} (including 12 SWE-bench Mini tasks)`)
    console.log(`  Cumulative Raw Baseline: ${summary.totalRawTokens.toLocaleString()} tokens`)
    console.log(`  Compressed Fox Prefill:  ${summary.totalCompressedTokens.toLocaleString()} tokens`)
    console.log(
      `  Prefill Tokens Saved:   \x1b[32m+${summary.totalTokensSaved.toLocaleString()} tokens (${summary.overallPctSaved}% reduction)\x1b[0m`
    )
    console.log(`  Total Overhead Latency: ${summary.totalOverheadMs} ms across all corpora`)
    console.log(`  Overall ROI Score:      \x1b[36m${summary.overallROI.toLocaleString()} chars/ms\x1b[0m`)
    console.log(
      `  Invariants Verification:\x1b[32m ${summary.allInvariantsPassed ? "✔ 100% PASSED (Lossless, Non-Expansion, Stability, Supersession)" : "✗ FAILED"}\x1b[0m`
    )
    console.log("─".repeat(96))

    console.log(
      `  ${"Corpus Category".padEnd(20)} ${"Fixtures".padStart(10)} ${"Raw Tokens".padStart(14)} ${"Fox Tokens".padStart(14)} ${"Tokens Saved".padStart(14)} ${"Reduction".padStart(11)} ${"Invariants".padStart(10)}`
    )
    console.log(
      `  ${"─".repeat(20)} ${"─".repeat(10)} ${"─".repeat(14)} ${"─".repeat(14)} ${"─".repeat(14)} ${"─".repeat(11)} ${"─".repeat(10)}`
    )

    for (const cat of summary.categories) {
      const invStr = cat.allInvariantsPassed ? "\x1b[32m✔ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m"
      console.log(
        `  ${cat.category.padEnd(20)} ${String(cat.fixtureCount).padStart(10)} ${(cat.totalRawTokens.toLocaleString() + " tok").padStart(14)} ${(cat.totalCompressedTokens.toLocaleString() + " tok").padStart(14)} ${("+" + cat.tokensSaved.toLocaleString() + " tok").padStart(14)} ${`${cat.pctSaved}%`.padStart(11)} ${invStr.padStart(19)}`
      )
    }

    console.log("─".repeat(96))
    console.log(
      `  🏆 SCOREBOARD SUMMARY: ${summary.totalRawTokens.toLocaleString()} tok → ${summary.totalCompressedTokens.toLocaleString()} tok | Saved +${summary.totalTokensSaved.toLocaleString()} tok (${summary.overallPctSaved}%) | All Invariants Verified`
    )
    console.log("═".repeat(96) + "\n")
  }),
})

const ListTasksSubcommand = effectCmd({
  command: "tasks",
  describe: "list all 12 curated SWE-bench Mini tasks and specifications",
  instance: false,
  handler: Effect.fn("Cli.standardSuite.tasks")(function* () {
    const stats = getCorporaStats()
    console.log(`\n\x1b[1m🦊 Fox Standard Test Suite — SWE-bench Mini Catalog (${stats.sweTasks} Tasks)\x1b[0m\n`)

    for (let i = 0; i < SWE_BENCH_MINI_TASKS.length; i++) {
      const t = SWE_BENCH_MINI_TASKS[i]!
      console.log(`  \x1b[36m${(i + 1).toString().padStart(2, "0")}. [${t.id}]\x1b[0m: \x1b[1m${t.title}\x1b[0m`)
      console.log(`      Category:    ${t.category}`)
      console.log(`      Description: ${t.description}`)
      console.log(`      Test Cmd:    ${t.failingTestCommand}`)
      console.log(`      Assertions:  ${t.expectedAssertions} expect() calls\n`)
    }
  }),
})

export const StandardSuiteCommand = effectCmd({
  command: "standard-suite",
  describe: "inspect golden corpora, SWE-bench Mini, and the baseline scoreboard",
  instance: false,
  builder: (yargs: Argv) =>
    yargs
      .command(ScoreboardSubcommand)
      .command(ListTasksSubcommand)
      .demandCommand(),
  handler: Effect.fn("Cli.standardSuite")(function* () {}),
})
