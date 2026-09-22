/**
 * Diagnose the 2 failing Tier 3 fixtures to find exactly what's being lost.
 */
import { getAllChallengeFixtures } from "../test/challenge-ladder"
import { runFixture } from "../test/challenge-ladder/scoring"
import { process as runCompress, truncateShellOutput } from "@opencode-ai/core/tool/compress"
import { resetROI } from "@opencode-ai/core/tool/compression-metrics"

process.env.FOX_EXPERIMENTAL_COMPRESS = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_PATHS = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_GIT = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_DIFF = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_DATA = "true"
process.env.FOX_EXPERIMENTAL_COMPRESS_SUPERSEDE = "true"

const fixtures = getAllChallengeFixtures()
const targets = ["malformed-diff-t3-10", "adv-overlap-t3-01"]

for (const id of targets) {
  const fixture = fixtures.find((f) => f.id === id)
  if (!fixture) {
    console.log(`❌ Fixture ${id} not found`)
    continue
  }

  console.log(`\n${"=".repeat(70)}`)
  console.log(`FIXTURE: ${id}`)
  console.log(`Description: ${fixture.description}`)
  console.log(`${"=".repeat(70)}`)

  resetROI()
  const result = runFixture(fixture)
  console.log(`Score: ${result.score}`)
  console.log(`Passed: ${result.passed}`)
  console.log(`Failures: ${JSON.stringify(result.failures)}`)
  console.log(`Raw length: ${result.rawLength}`)
  console.log(`Compressed length: ${result.compressedLength}`)
  console.log(`Compression: ${result.compressionPct}%`)

  // Get compressed output
  resetROI()
  const ctx = {
    workspaceRoot: ".",
    toolName: fixture.input.tool,
    workflow: fixture.expected.workflow ?? "swe",
  }

  let output = runCompress(fixture.input.content, ctx)
  if (fixture.input.tool === "bash" && fixture.input.command) {
    const res = truncateShellOutput(output, { command: fixture.input.command })
    output = res.output
  }

  // Show the mustContain checks
  const mustContain = fixture.expected.mustContain ?? []
  console.log(`\nmustContain checks:`)
  for (const kw of mustContain) {
    const found = output.includes(kw)
    console.log(`  ${found ? "✅" : "❌"} "${kw}"`)
  }

  // Show what changed  
  if (fixture.input.content !== output) {
    console.log(`\n--- DIFF (what changed) ---`)
    const inLines = fixture.input.content.split("\n")
    const outLines = output.split("\n")
    const changes: string[] = []
    for (let i = 0; i < Math.max(inLines.length, outLines.length); i++) {
      if (inLines[i] !== outLines[i]) {
        changes.push(`  Line ${i + 1}:`)
        changes.push(`    IN:  ${(inLines[i] ?? "(missing)").slice(0, 120)}`)
        changes.push(`    OUT: ${(outLines[i] ?? "(missing)").slice(0, 120)}`)
      }
    }
    // Only show first 20 changed lines
    console.log(changes.slice(0, 60).join("\n"))
    if (changes.length > 60) console.log(`  ... ${changes.length - 60} more lines changed`)
  }
}
