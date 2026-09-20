import type { CorpusCategory, CorpusFixture, SweMiniTask } from "./types"
import { SWE_BENCH_MINI_TASKS } from "./swe-bench-mini/tasks"
import { GITOPS_FIXTURES } from "./gitops/fixtures"
import { TEST_OUTPUT_FIXTURES } from "./test-output/fixtures"
import { DIFF_FIXTURES } from "./diff/fixtures"
import { SHELL_OUTPUT_FIXTURES } from "./shell-output/fixtures"
import { DOCUMENT_FIXTURES } from "./document/fixtures"

export * from "./types"
export { SWE_BENCH_MINI_TASKS } from "./swe-bench-mini/tasks"
export { GITOPS_FIXTURES } from "./gitops/fixtures"
export { TEST_OUTPUT_FIXTURES } from "./test-output/fixtures"
export { DIFF_FIXTURES } from "./diff/fixtures"
export { SHELL_OUTPUT_FIXTURES } from "./shell-output/fixtures"
export { DOCUMENT_FIXTURES } from "./document/fixtures"

/**
 * Convert SWE-bench Mini tasks into standard CorpusFixture entries
 * so they can be processed and measured in the scoreboard alongside
 * the other golden corpora.
 */
export function getSweMiniCorpusFixtures(): readonly CorpusFixture[] {
  return SWE_BENCH_MINI_TASKS.flatMap((task) => [
    {
      id: `${task.id}-failing-test`,
      name: `${task.title} (Failing Test Log)`,
      category: "swe-bench-mini" as CorpusCategory,
      tool: "bash" as const,
      command: task.failingTestCommand,
      content: task.failingTestOutput,
      mustContain: [task.failingTestOutput.split("\n")[1] ?? "fail"],
      minExpectedReductionPct: 0,
    },
    {
      id: `${task.id}-patch`,
      name: `${task.title} (Unified Diff Fix)`,
      category: "swe-bench-mini" as CorpusCategory,
      tool: "bash" as const,
      command: "git diff",
      content: task.referencePatch,
      mustContain: task.referencePatch
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1).trim())
        .filter((l) => l.length > 5),
      minExpectedReductionPct: 0,
    },
  ])
}

/**
 * Get all fixtures across all 6 golden corpora.
 */
export function getAllCorporaFixtures(): readonly CorpusFixture[] {
  return [
    ...getSweMiniCorpusFixtures(),
    ...GITOPS_FIXTURES,
    ...TEST_OUTPUT_FIXTURES,
    ...DIFF_FIXTURES,
    ...SHELL_OUTPUT_FIXTURES,
    ...DOCUMENT_FIXTURES,
  ]
}

/**
 * Get fixtures filtered by category.
 */
export function getFixturesByCategory(category: CorpusCategory): readonly CorpusFixture[] {
  if (category === "swe-bench-mini") {
    return getSweMiniCorpusFixtures()
  }
  return getAllCorporaFixtures().filter((f) => f.category === category)
}

/**
 * Summary counts of the Golden Corpora.
 */
export function getCorporaStats() {
  const sweCount = SWE_BENCH_MINI_TASKS.length
  const gitopsCount = GITOPS_FIXTURES.length
  const testCount = TEST_OUTPUT_FIXTURES.length
  const diffCount = DIFF_FIXTURES.length
  const shellCount = SHELL_OUTPUT_FIXTURES.length
  const docCount = DOCUMENT_FIXTURES.length
  const totalFixtures = getAllCorporaFixtures().length

  return {
    sweTasks: sweCount,
    gitopsFixtures: gitopsCount,
    testFixtures: testCount,
    diffFixtures: diffCount,
    shellFixtures: shellCount,
    docFixtures: docCount,
    totalFixtures,
  }
}
